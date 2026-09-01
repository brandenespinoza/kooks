import "server-only";

import { z } from "zod";

import { env } from "~/env";

/**
 * SwellCloud API client (FR-7). Server-only: `SWELLCLOUD_API_KEY` must never reach a client
 * bundle, and the `server-only` import makes that a build error rather than a leak.
 *
 * ---
 * **The response shape below is an assumed contract.** No live key or published schema was
 * available when this was written, so it encodes exactly what epics.md Story 3.1 describes.
 * Everything that would need to change after seeing one real response is in this block:
 * the URL, the auth header, the query parameter names, and `pointResponseSchema`.
 *
 * Units are whatever SwellCloud returns — they are stored and displayed as-is. If the real
 * API is configurable, pin it here so the numbers on screen never silently change meaning.
 */
const SWELLCLOUD_ENDPOINT = "https://api.swellcloud.net/v1/point";
const REQUEST_TIMEOUT_MS = 10_000;

const authHeaders = () => ({
  Authorization: `Bearer ${env.SWELLCLOUD_API_KEY}`,
  Accept: "application/json",
});

const pointResponseSchema = z.object({
  swellHeight: z.number(),
  swellPeriod: z.number(),
  waveDirection: z.number(),
  windSpeed: z.number(),
  windDirection: z.number(),
  /**
   * When the forecast model that produced these numbers last ran (~4x daily). Story 3.2
   * regenerates the LLM verdict only when this changes, satisfying FR-8's ceiling without
   * giving up FR-7's 30-minute freshness. Optional: if SwellCloud does not return it, 3.2
   * has to fall back to regenerating on a fixed cadence of its own.
   */
  modelRunAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * The normalised snapshot stored in `Break.rawData` and read by `conditionsRouter`.
 *
 * Deliberately *not* the upstream body. Normalising at this boundary means a SwellCloud
 * rename lands in one file instead of reaching the `RawDataPanel` (3.3) and the LLM prompt
 * (3.2), and it lets the router re-validate a stored row before handing it to a client.
 */
export const conditionsRawDataSchema = z.object({
  swellHeight: z.number(),
  swellPeriod: z.number(),
  waveDirection: z.number(),
  windSpeed: z.number(),
  windDirection: z.number(),
});

export type ConditionsRawData = z.infer<typeof conditionsRawDataSchema>;

export type ConditionsSnapshot = {
  rawData: ConditionsRawData;
  /** Null when SwellCloud omits it. Story 3.2 owns `Break.conditionsModelRunAt`, not 3.1. */
  modelRunAt: Date | null;
};

/** Every failure mode of a poll — network, HTTP status, non-JSON body, unexpected shape. */
export class SwellCloudError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SwellCloudError";
  }
}

/**
 * Fetches current conditions for one coordinate pair.
 *
 * Throws `SwellCloudError` rather than returning a partial result: the caller's contract is
 * "either I have a snapshot worth storing, or I leave the last good row alone". A shape
 * mismatch must never be written into `rawData`, or the UI renders nonsense instead of
 * simply going stale.
 */
export async function fetchConditions(
  lat: number,
  lng: number,
): Promise<ConditionsSnapshot> {
  if (env.CONDITIONS_SOURCE === "mock") return mockConditions(lat, lng);

  const url = new URL(SWELLCLOUD_ENDPOINT);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));

  let response: Response;
  try {
    response = await fetch(url, {
      headers: authHeaders(),
      // Jobs are not requests; nothing here should land in Next's fetch cache.
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw new SwellCloudError("SwellCloud request failed", { cause });
  }

  if (!response.ok) {
    throw new SwellCloudError(
      `SwellCloud responded ${response.status} ${response.statusText}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new SwellCloudError("SwellCloud returned a non-JSON body", { cause });
  }

  const parsed = pointResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new SwellCloudError(
      `Unexpected SwellCloud response shape: ${parsed.error.message}`,
    );
  }

  const { modelRunAt, ...rawData } = parsed.data;

  return {
    rawData,
    modelRunAt: modelRunAt ? new Date(modelRunAt) : null,
  };
}

/**
 * Synthetic conditions for when there is no working upstream (`CONDITIONS_SOURCE=mock`).
 *
 * **These numbers are invented.** Never enable this in production — the whole product is a
 * go/no-go signal for paddling out, and a plausible-looking lie is worse than an empty
 * screen. `src/env.js` defaults to the real API so this cannot be reached by omission, and
 * the poll job warns on every sweep while it is on.
 *
 * Two properties make it useful rather than merely non-empty:
 *
 * - **Deterministic per Break and model run.** The same coordinates return the same numbers
 *   until the model run changes, so a refresh does not reshuffle the surf.
 * - **A real `modelRunAt`, bucketed to 6 hours.** That is what the verdict gate in Story 3.2
 *   compares against, so mock mode exercises the 4x-daily regeneration path exactly as the
 *   real API would rather than routing around it.
 */
const MOCK_MODEL_RUN_MS = 6 * 60 * 60 * 1000;

function mockConditions(lat: number, lng: number): ConditionsSnapshot {
  const modelRunAt = new Date(
    Math.floor(Date.now() / MOCK_MODEL_RUN_MS) * MOCK_MODEL_RUN_MS,
  );

  const random = seeded(
    `${lat.toFixed(3)},${lng.toFixed(3)},${modelRunAt.getTime()}`,
  );
  const between = (min: number, max: number, decimals = 0) => {
    const value = min + random() * (max - min);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  };

  return {
    rawData: {
      swellHeight: between(0.4, 2.6, 1),
      swellPeriod: between(6, 15, 0),
      waveDirection: between(0, 359, 0),
      windSpeed: between(2, 22, 1),
      windDirection: between(0, 359, 0),
    },
    modelRunAt,
  };
}

/** mulberry32 over an FNV-1a hash — small, dependency-free, and stable across runs. */
function seeded(key: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
