import "server-only";

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";

import { env } from "~/env";
import { db } from "~/server/db";
import { logger } from "~/server/logger";

/**
 * Web Push delivery (FR-18). Server-only: the private VAPID key signs every request and must
 * never reach a browser.
 *
 * Configured lazily so the module can be imported during `next build`, where
 * `SKIP_ENV_VALIDATION` leaves the keys undefined and configuring at module scope would
 * throw.
 */
let configured = false;

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    env.WEB_PUSH_EMAIL,
    env.WEB_PUSH_PUBLIC_KEY,
    env.WEB_PUSH_PRIVATE_KEY,
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where a tap should land. Always in-app; there is only one screen worth opening. */
  url: string;
  /** Collapses repeats: a second check-in from the same person replaces the first. */
  tag: string;
};

/** The notification preference a payload belongs to, so a user's opt-out is respected. */
export type PushKind = "friendCheckIn" | "nightBefore" | "dawnPatrol";

/**
 * Sends to every device belonging to the given users, minus anyone who has turned this kind
 * of notification off.
 *
 * Failures are per-endpoint and never thrown: a push service returning 410 for a browser
 * someone uninstalled must not stop the other three people hearing that the crew is going.
 * Those dead endpoints are deleted — the `push_subscriptions` row is worthless once the
 * service has disowned it, and keeping it means retrying forever.
 */
export async function sendToUsers(
  userIds: string[],
  kind: PushKind,
  payload: PushPayload,
) {
  if (userIds.length === 0) return;

  configure();

  const subscriptions = await db.pushSubscription.findMany({
    where: {
      userId: { in: userIds },
      // A missing prefs row is treated as opted in, matching the column defaults.
      user: { notificationPrefs: { isNot: { [kind]: false } } },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true, userId: true },
  });

  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const target: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };

      try {
        await webpush.sendNotification(target, body);
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;

        // 404/410 mean the subscription is gone for good — anything else may be transient.
        if (statusCode === 404 || statusCode === 410) {
          dead.push(subscription.id);
          return;
        }

        logger.error(
          { err: error, statusCode, userId: subscription.userId },
          "push: delivery failed",
        );
      }
    }),
  );

  if (dead.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: dead } } });
    logger.info({ count: dead.length }, "push: pruned expired subscriptions");
  }
}

/**
 * FR-18. Notifies the actor's crew about a check-in.
 *
 * Two filters, and both matter:
 *
 * - **Direct crew of the actor only** (NFR-7). Sharing a Break is not enough — the same
 *   friend-of-friend rule Story 5.2 applied to `break.list` and the SSE stream.
 * - **Only people who can see that Break.** Someone in your crew who has never heard of this
 *   spot should not get a push about it, and would see nothing if they opened the app.
 *
 * Never sent to the actor: a push telling you what you just did is noise.
 */
export async function sendToCrewMembers(
  actorId: string,
  breakId: string,
  payload: PushPayload,
) {
  const [crew, surfBreak] = await Promise.all([
    db.crewMember.findMany({
      where: { userId: actorId },
      select: { friendId: true },
    }),
    db.break.findUnique({
      where: { id: breakId },
      select: { createdById: true },
    }),
  ]);

  if (crew.length === 0 || !surfBreak) return;

  const crewIds = crew.map((member) => member.friendId);

  // Visible to a recipient if they saved it, created it, or are crew with whoever did —
  // the same rule as `assertCrewMember`, applied to a list of candidates at once.
  const [savers, creatorCrew] = await Promise.all([
    db.userSavedBreak.findMany({
      where: { breakId, userId: { in: crewIds } },
      select: { userId: true },
    }),
    db.crewMember.findMany({
      where: { userId: { in: crewIds }, friendId: surfBreak.createdById },
      select: { userId: true },
    }),
  ]);

  const recipients = new Set<string>();
  for (const row of savers) recipients.add(row.userId);
  for (const row of creatorCrew) recipients.add(row.userId);
  if (crewIds.includes(surfBreak.createdById)) recipients.add(surfBreak.createdById);
  recipients.delete(actorId);

  await sendToUsers([...recipients], "friendCheckIn", payload);
}
