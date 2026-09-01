import "server-only";

import { PgBoss } from "pg-boss";

import { env } from "~/env";
import { logger } from "~/server/logger";
import { registerConditionsJobs } from "~/server/jobs/conditions-jobs";
import { registerCheckInJobs } from "~/server/jobs/check-in-jobs";
import { registerPushJobs } from "~/server/jobs/push-jobs";

/**
 * The one `PgBoss` instance (enforcement rule 3 — never `new PgBoss()` anywhere else).
 * `src/instrumentation.ts` starts it on server boot; later stories register their jobs by
 * adding a call to `registerJobs` below, not by constructing their own boss.
 *
 * Held on `globalThis` for the same reason `db` and `emitter` are: a dev HMR reload
 * re-evaluates this module, and a second boss would mean two workers racing for the same
 * cron jobs.
 */
const globalForJobs = globalThis as unknown as {
  bossPromise: Promise<PgBoss | null> | undefined;
};

/**
 * Starts pg-boss and registers every scheduled job. Idempotent — the in-flight promise is
 * cached, so concurrent callers share one boss.
 *
 * Resolves to `null` rather than throwing when the database is unreachable. A scheduler that
 * cannot start is a real problem, but it is not a reason to refuse to serve the app; the
 * failure is logged loudly and the cache is cleared so a later call can retry.
 */
export function startJobs(): Promise<PgBoss | null> {
  globalForJobs.bossPromise ??= start();
  return globalForJobs.bossPromise;
}

/** The running boss, or `null` if it has not started (or failed to). */
export async function getBoss(): Promise<PgBoss | null> {
  return (await globalForJobs.bossPromise) ?? null;
}

async function start(): Promise<PgBoss | null> {
  try {
    const boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      // pg-boss opens its own pool alongside Prisma's. Two connections is plenty for a
      // handful of cron jobs and keeps the total well inside Postgres' default 100.
      max: 2,
    });

    // pg-boss is an EventEmitter: an unhandled 'error' event takes the process down.
    boss.on("error", (error) => {
      logger.error({ err: error }, "pg-boss emitted an error");
    });

    await boss.start();
    await registerJobs(boss);

    logger.info("pg-boss started; scheduled jobs registered");
    return boss;
  } catch (error) {
    globalForJobs.bossPromise = undefined;
    logger.error(
      { err: error },
      "pg-boss failed to start — scheduled jobs are NOT running",
    );
    return null;
  }
}

/** Every job group in the app. Epics 4 and 6 add their registrations here. */
async function registerJobs(boss: PgBoss) {
  await registerConditionsJobs(boss);
  await registerCheckInJobs(boss);
  await registerPushJobs(boss);
}
