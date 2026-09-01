import "server-only";

import { z } from "zod";

import { env } from "~/env";
import { logger } from "~/server/logger";

/**
 * Webcam links (FR-9). Curator-supplied via `WEBCAM_URLS_JSON`, keyed by Break label —
 * static, not user-editable, and deliberately not a database column (the `Break.webcamUrls`
 * column was dropped in the replan for exactly that reason).
 *
 * Server-only: the map is read from env and travels to the client on `break.list`, one
 * resolved URL per Break, rather than shipping the whole config to every browser.
 */
const webcamMapSchema = z.record(z.string(), z.string());

/**
 * Keys are matched case- and whitespace-insensitively. A curator typing "the point" into a
 * JSON file should not have to match `Break.label` byte for byte to make the link appear.
 */
function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

let cache: Map<string, string> | null = null;

function loadWebcams(): Map<string, string> {
  if (cache) return cache;

  const map = new Map<string, string>();

  try {
    const parsed = webcamMapSchema.safeParse(JSON.parse(env.WEBCAM_URLS_JSON));

    if (!parsed.success) {
      // Valid JSON, wrong shape — an array, or values that are not strings. `src/env.js`
      // only checks that the string parses, so this is the first place that would notice.
      logger.warn(
        { issues: parsed.error.issues },
        "WEBCAM_URLS_JSON is not a map of label -> URL; treating as empty",
      );
      cache = map;
      return map;
    }

    for (const [label, url] of Object.entries(parsed.data)) {
      // Only http(s). This value ends up in an anchor's href, and `javascript:` in a config
      // file is a script injection with extra steps.
      if (!/^https?:\/\//i.test(url)) {
        logger.warn(
          { label },
          "WEBCAM_URLS_JSON entry is not an http(s) URL; skipping",
        );
        continue;
      }
      map.set(normalizeLabel(label), url);
    }
  } catch (error) {
    // Unreachable in practice — `src/env.js` refuses to boot on unparseable JSON — but the
    // AC is explicit that a bad value degrades to an empty map rather than crashing, and
    // this module should hold that line on its own.
    logger.warn({ err: error }, "WEBCAM_URLS_JSON could not be parsed; treating as empty");
  }

  cache = map;
  return map;
}

/** The configured webcam URL for a Break label, or `null` — never an empty row (FR-9). */
export function webcamUrlFor(label: string): string | null {
  return loadWebcams().get(normalizeLabel(label)) ?? null;
}
