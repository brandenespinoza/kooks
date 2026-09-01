import "server-only";

import type { PgBoss } from "pg-boss";

import { env } from "~/env";
import { db } from "~/server/db";
import { logger } from "~/server/logger";
import { sendToUsers, type PushKind } from "~/server/push/web-push";
import {
  dawnPatrolMessage,
  nightBeforeMessage,
} from "~/server/push/notification-templates";

/** FR-19: ~9pm. FR-20: between 5:00 and 5:30. Both in the crew's timezone, not UTC. */
export const NIGHT_BEFORE_QUEUE = "night-before-nudge";
export const DAWN_PATROL_QUEUE = "dawn-patrol";
const NIGHT_BEFORE_CRON = "0 21 * * *";
const DAWN_PATROL_CRON = "5 5 * * *";

/**
 * Registers both scheduled pushes.
 *
 * The `tz` option is the whole reason `APP_TIMEZONE` exists: pg-boss schedules in UTC, so
 * without it "9pm" would drift an hour twice a year and land at 4pm or 5pm in summer — a
 * night-before nudge that arrives before dinner is worse than none.
 */
export async function registerPushJobs(boss: PgBoss) {
  for (const [queue, cron, run] of [
    [NIGHT_BEFORE_QUEUE, NIGHT_BEFORE_CRON, sendNightBeforeNudges],
    [DAWN_PATROL_QUEUE, DAWN_PATROL_CRON, sendDawnPatrolNudges],
  ] as const) {
    await boss.createQueue(queue);
    await boss.work(queue, async () => {
      await run();
    });
    await boss.schedule(queue, cron, null, { tz: env.APP_TIMEZONE });
  }
}

/** FR-19. */
export async function sendNightBeforeNudges() {
  await sendHomeBreakNudges("nightBefore", nightBeforeMessage, "Tomorrow’s surf");
}

/** FR-20. */
export async function sendDawnPatrolNudges() {
  await sendHomeBreakNudges("dawnPatrol", dawnPatrolMessage, "Dawn patrol");
}

/**
 * The shared sweep: every user with a Home Break gets one push about that Break.
 *
 * Users with no `homeBreakId` are skipped silently — it is a normal state for someone who
 * has just joined and saved nothing, not a failure worth logging every night.
 *
 * `homeBreakId` is deliberately not a foreign key (it would create a `User` <-> `Break`
 * cycle), so a dangling id is possible in principle and the Break is looked up rather than
 * joined. A user pointing at a Break that no longer exists is skipped too.
 *
 * Per-user, not one bulk send, because the message names *their* Home Break. Preference
 * filtering and per-endpoint failure handling both live in `sendToUsers`.
 */
async function sendHomeBreakNudges(
  kind: Extract<PushKind, "nightBefore" | "dawnPatrol">,
  message: (verdict: string | null, breakLabel: string) => string,
  title: string,
) {
  const users = await db.user.findMany({
    where: { homeBreakId: { not: null } },
    select: { id: true, homeBreakId: true },
  });

  if (users.length === 0) return;

  const breakIds = [...new Set(users.map((user) => user.homeBreakId!))];
  const breaks = await db.break.findMany({
    where: { id: { in: breakIds } },
    select: { id: true, label: true, conditionsVerdict: true },
  });
  const byId = new Map(breaks.map((surfBreak) => [surfBreak.id, surfBreak]));

  // Candidates, not deliveries: `sendToUsers` drops anyone who has turned this kind off or
  // has no registered device, and does not report back. A log line saying "sent" when
  // nothing left the building is the kind of thing you believe at 5am and regret later.
  let candidates = 0;

  for (const user of users) {
    const surfBreak = byId.get(user.homeBreakId!);
    if (!surfBreak) continue;

    await sendToUsers([user.id], kind, {
      title,
      body: message(surfBreak.conditionsVerdict, surfBreak.label),
      url: "/",
      // One per kind per user: tonight's nudge replaces last night's on the lock screen.
      tag: `${kind}-${user.id}`,
    });

    candidates += 1;
  }

  logger.info({ kind, candidates }, "scheduled push: sweep complete");
}
