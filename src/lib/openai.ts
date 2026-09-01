import "server-only";

import OpenAI from "openai";

import { env } from "~/env";
import type { ConditionsRawData } from "~/lib/swellcloud";

/**
 * Conditions Verdict generation (FR-5, FR-8). Server-only: `OPENAI_API_KEY` must never reach
 * a client bundle.
 *
 * Called once per SwellCloud model run per Break — roughly 4x daily — never per request and
 * never per user. The verdict is cached on the `Break` row and served to the whole crew.
 */
const VERDICT_MODEL = "gpt-5.4-nano";
const MAX_WORDS = 10;
/**
 * Generous relative to ten words: on a reasoning-capable model the reasoning tokens are drawn
 * from this same budget, and a tight cap comes back as an empty string rather than a short
 * verdict.
 */
const MAX_OUTPUT_TOKENS = 200;
const REQUEST_TIMEOUT_MS = 15_000;
/** Below this, backing off to a clause boundary would leave a fragment, not a verdict. */
const MIN_KEPT_CHARS = 16;

const SYSTEM_PROMPT = `You are the stoked best friend of a surf crew, reading this morning's conditions for them.

Reply with ONE verdict of ${MAX_WORDS} words or fewer. Nothing else — no preamble, no quotation marks, no emoji, no bullet points.

Voice: surfer dude. Genuinely fired up when it is good. Honest and safety-aware when it is not — never hype conditions that are big, blown out, or dangerous, and say plainly when it is not worth paddling out.

The numbers are in the forecast provider's native units, which you do not know. NEVER write a unit — no ft, m, kt, mph, knots or feet. "1.9" may be metres or feet and guessing wrong is the difference between knee-high and overhead. Describe size in body terms (knee-high, chest-high, overhead) or leave the number bare.`;

/** A verdict could not be generated. The caller decides what to do with the Break. */
export class VerdictGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "VerdictGenerationError";
  }
}

let client: OpenAI | null = null;

/**
 * Lazy so the module can be imported during `next build`, where `SKIP_ENV_VALIDATION` leaves
 * the key undefined and constructing a client at module scope would throw.
 */
function getClient(): OpenAI {
  client ??= new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
  return client;
}

/**
 * Turns one Break's raw conditions into a plain-language verdict.
 *
 * Throws `VerdictGenerationError` on any failure — network, auth, empty completion. The poll
 * job catches it and nulls the Break's verdict, which drops the UI to the raw-data fallback
 * (FR-8). Nothing here retries beyond the SDK's own single retry: the next poll is 30 minutes
 * away and a verdict is not worth blocking the sweep for.
 */
export async function generateVerdict(
  rawData: ConditionsRawData,
): Promise<string> {
  let response;
  try {
    response = await getClient().responses.create({
      model: VERDICT_MODEL,
      instructions: SYSTEM_PROMPT,
      input: formatConditions(rawData),
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });
  } catch (cause) {
    throw new VerdictGenerationError("OpenAI request failed", { cause });
  }

  const verdict = enforceWordCeiling(response.output_text ?? "");

  if (verdict.length === 0) {
    throw new VerdictGenerationError("OpenAI returned an empty verdict");
  }

  return verdict;
}

/** Labelled lines rather than JSON — the model reads them, it does not parse them. */
function formatConditions(rawData: ConditionsRawData): string {
  return [
    `Swell height: ${rawData.swellHeight}`,
    `Swell period: ${rawData.swellPeriod}`,
    `Wave direction: ${rawData.waveDirection} degrees`,
    `Wind speed: ${rawData.windSpeed}`,
    `Wind direction: ${rawData.windDirection} degrees`,
  ].join("\n");
}

/**
 * Exported for direct exercise — it is the one piece of verdict handling that does not need
 * the API to test, and its failure mode (a verdict cut mid-phrase) reaches the user.
 *
 * The prompt asks for ten words; this guarantees it, because FR-8's ceiling is also a layout
 * constraint — the band renders at 28px and a rambling verdict pushes the crew zone off
 * screen. Truncating beats discarding: nine words of a good read is still a usable verdict.
 */
export function enforceWordCeiling(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, " ")
    // Models like to wrap a one-liner in quotes despite being told not to.
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= MAX_WORDS) return cleaned;

  const truncated = words.slice(0, MAX_WORDS).join(" ");
  if (/[.!?]$/.test(truncated)) return truncated;

  // A hard cut lands mid-phrase and reads as broken — an observed verdict ended
  // "...should be clean—go get". Back off to the last clause boundary so the line always
  // finishes a thought, even if that costs a word or two.
  const boundary = Math.max(
    ...[",", ";", ":", "\u2014", "\u2013"].map((mark) => truncated.lastIndexOf(mark)),
  );

  // Only worth doing if a usable verdict survives; otherwise the hard cut is the lesser evil.
  if (boundary >= MIN_KEPT_CHARS) return truncated.slice(0, boundary).trimEnd();

  return truncated;
}
