import "server-only";

import type { PgBoss } from "pg-boss";

import { env } from "~/env";
import { db } from "~/server/db";
import { logger } from "~/server/logger";
import { fetchConditions, type ConditionsRawData } from "~/lib/swellcloud";
import { generateVerdict } from "~/lib/openai";

/** FR-7: conditions are never older than 30 minutes. */
export const POLL_CONDITIONS_QUEUE = "poll-conditions";
const POLL_CONDITIONS_CRON = "*/30 * * * *";

/**
 * FR-8's ceiling — one verdict per SwellCloud model update, ~4x daily. Only used when
 * SwellCloud omits its model-run timestamp; see `resolveModelRun`.
 */
const VERDICT_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Registers the SwellCloud poll (FR-7) and, riding on it, verdict generation (FR-8).
 *
 * pg-boss v12 requires a queue to exist before anything can be scheduled onto it or worked
 * off it — `send` throws `Queue poll-conditions does not exist` otherwise — so the order
 * here is create, work, schedule. `schedule` upserts on (queue, key), so re-running this on
 * every boot does not accumulate duplicate cron entries.
 */
export async function registerConditionsJobs(boss: PgBoss) {
  await boss.createQueue(POLL_CONDITIONS_QUEUE);

  // v12 hands the handler a *batch* of jobs, not one. Every job in this queue is the same
  // "go poll everything" trigger with no payload, so the batch is collapsed into one sweep.
  await boss.work(POLL_CONDITIONS_QUEUE, async () => {
    await pollAllBreaks();
  });

  await boss.schedule(POLL_CONDITIONS_QUEUE, POLL_CONDITIONS_CRON);

  // Cron alone leaves a freshly deployed container with no conditions for up to 30 minutes,
  // which fails FR-7 from a cold start. One immediate poll closes that window.
  await boss.send(POLL_CONDITIONS_QUEUE, {});
}

/**
 * Polls SwellCloud for every Break and caches the result on the row (rule: the `Break` table
 * *is* the conditions cache — there is no separate cache layer).
 *
 * Sequential with a per-Break `try/catch`: one Break's failure must not cost the others their
 * refresh, and at crew scale there is nothing to gain from bursting an API whose rate limit we
 * do not know.
 *
 * The verdict is regenerated only when the model run changes, which is the whole point of
 * `conditionsModelRunAt`: the poll runs 48x a day and FR-8 allows 4 LLM calls a day.
 */
export async function pollAllBreaks() {
  const breaks = await db.break.findMany({
    select: {
      id: true,
      label: true,
      lat: true,
      lng: true,
      conditionsModelRunAt: true,
    },
  });

  if (breaks.length === 0) {
    logger.debug("poll-conditions: no breaks to poll");
    return;
  }

  if (env.CONDITIONS_SOURCE === "mock") {
    // Loud on every sweep, not once at boot: a container that has been up for a month
    // should still be saying that the surf report on screen is invented.
    logger.warn(
      { breaks: breaks.length },
      "poll-conditions: CONDITIONS_SOURCE=mock — conditions are synthetic, not real",
    );
  }

  let refreshed = 0;
  let regenerated = 0;
  let failed = 0;

  for (const surfBreak of breaks) {
    try {
      const snapshot = await fetchConditions(surfBreak.lat, surfBreak.lng);
      const modelRun = resolveModelRun(snapshot.modelRunAt);

      const isSameModelRun =
        surfBreak.conditionsModelRunAt !== null &&
        surfBreak.conditionsModelRunAt.getTime() === modelRun.getTime();

      if (isSameModelRun) {
        // Same forecast, fresher fetch: FR-7 is satisfied by the timestamp alone. Calling
        // the LLM here would be 48 calls a day per Break for data that has not changed.
        await db.break.update({
          where: { id: surfBreak.id },
          data: {
            rawData: snapshot.rawData,
            conditionsUpdatedAt: new Date(),
          },
        });
        refreshed += 1;
        continue;
      }

      const verdict = await generateVerdictOrNull(snapshot.rawData, surfBreak);

      await db.break.update({
        where: { id: surfBreak.id },
        data: {
          rawData: snapshot.rawData,
          conditionsUpdatedAt: new Date(),
          // Explicitly null on failure (FR-8's fallback): the band drops to raw data rather
          // than showing a confident verdict written for a forecast run that has since moved
          // on.
          conditionsVerdict: verdict,
          // Advance the gate only when a verdict was actually produced. Leaving it after a
          // failure means the next poll retries in 30 minutes instead of waiting out the
          // full model-run interval with an empty band.
          ...(verdict !== null ? { conditionsModelRunAt: modelRun } : {}),
        },
      });

      if (verdict === null) {
        failed += 1;
      } else {
        regenerated += 1;
      }
    } catch (error) {
      // Logged, not rethrown: a thrown error fails the whole pg-boss job and retries every
      // Break, including the ones that just succeeded.
      failed += 1;
      logger.error(
        { err: error, breakId: surfBreak.id, label: surfBreak.label },
        "poll-conditions: SwellCloud fetch failed for break",
      );
    }
  }

  logger.info(
    { refreshed, regenerated, failed, total: breaks.length },
    "poll-conditions: sweep complete",
  );
}

/**
 * The timestamp the verdict gate compares against.
 *
 * SwellCloud's own model-run timestamp when it sends one. When it does not, the clock is
 * bucketed into 6-hour windows instead — that keeps generation at FR-8's 4x daily whether or
 * not the upstream field exists, using the same single comparison rather than a second code
 * path. (The SwellCloud response shape is an assumed contract; `modelRunAt` may well not be
 * there. See `src/lib/swellcloud.ts`.)
 */
function resolveModelRun(modelRunAt: Date | null): Date {
  if (modelRunAt) return modelRunAt;
  return new Date(
    Math.floor(Date.now() / VERDICT_INTERVAL_MS) * VERDICT_INTERVAL_MS,
  );
}

/**
 * FR-8's fallback path. An LLM failure must not cost the Break its fresh raw data, and must
 * not stop the sweep — so it is logged and downgraded to `null`, which the `VerdictBand`
 * renders as raw values.
 */
async function generateVerdictOrNull(
  rawData: ConditionsRawData,
  surfBreak: { id: string; label: string },
): Promise<string | null> {
  try {
    return await generateVerdict(rawData);
  } catch (error) {
    logger.error(
      { err: error, breakId: surfBreak.id, label: surfBreak.label },
      "poll-conditions: verdict generation failed; falling back to raw data",
    );
    return null;
  }
}
