import "server-only";

import type { PgBoss } from "pg-boss";

import { db } from "~/server/db";
import { logger } from "~/server/logger";
import { emitter, type PresenceEvent } from "~/server/events";

/** FR-13. A check-in is stale two hours after the ETA it declared. */
export const CHECKIN_EXPIRY_QUEUE = "checkin-expiry";
const CHECKIN_EXPIRY_CRON = "*/5 * * * *";
const EXPIRY_GRACE_MS = 2 * 60 * 60 * 1000;

/**
 * Registers the check-in expiry sweep (FR-13).
 *
 * A scheduled delete rather than a "hide rows older than X" read filter: the presence layer
 * is read on every screen and written rarely, so paying for the filter on every read — in
 * `break.list`, in the SSE scoping, in every future push job — would be both slower and
 * easy to forget in one of those places. One job, one source of truth, and the row is
 * genuinely gone.
 */
export async function registerCheckInJobs(boss: PgBoss) {
  await boss.createQueue(CHECKIN_EXPIRY_QUEUE);

  await boss.work(CHECKIN_EXPIRY_QUEUE, async () => {
    await expireStaleCheckIns();
  });

  await boss.schedule(CHECKIN_EXPIRY_QUEUE, CHECKIN_EXPIRY_CRON);
}

/**
 * Deletes every check-in whose ETA is more than two hours old and tells connected clients.
 *
 * Rows are read before they are deleted because the SSE event needs the `breakId` that is
 * about to disappear — a `deleteMany` alone would leave every open Break screen showing
 * someone who is no longer there until the next refetch.
 */
export async function expireStaleCheckIns() {
  const cutoff = new Date(Date.now() - EXPIRY_GRACE_MS);

  const stale = await db.checkIn.findMany({
    where: { eta: { lt: cutoff } },
    select: { id: true, userId: true, breakId: true },
  });

  if (stale.length === 0) return;

  // Deleted by id, not by re-running the time filter: a row that arrived between the read
  // and the write is not this sweep's business.
  const { count } = await db.checkIn.deleteMany({
    where: { id: { in: stale.map((checkIn) => checkIn.id) } },
  });

  for (const checkIn of stale) {
    const event: PresenceEvent = {
      type: "checkIn.removed",
      breakId: checkIn.breakId,
      payload: { checkInId: checkIn.id, userId: checkIn.userId },
    };
    emitter.emit(event.type, event);
  }

  logger.info({ count, cutoff }, "checkin-expiry: removed stale check-ins");
}
