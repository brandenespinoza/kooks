import "server-only";

import { randomBytes } from "node:crypto";

/**
 * 32 bytes — 256 bits of CSPRNG output. Overkill for a four-person crew, and that is the
 * point: these tokens never expire and never rotate, so the entropy is the only thing
 * standing between a guess and someone else's account.
 */
const TOKEN_BYTES = 32;

/**
 * Generates a bearer secret: a session token or a user's invite token.
 *
 * **Replaces `@default(cuid())` on both columns.** A cuid is a timestamp, a per-process
 * counter, a host fingerprint and roughly 41 bits of randomness — its own author deprecated
 * it for exactly this use. Sessions here never expire and invite tokens never rotate, and
 * nothing in the app is rate limited, so a token that leaks structure is the wrong shape of
 * secret no matter how small the crew is.
 *
 * `base64url` rather than hex: same entropy in 43 characters instead of 64, and the alphabet
 * (`A-Za-z0-9-_`) is safe in a cookie value and in a URL path segment without escaping —
 * the two places these actually appear.
 *
 * The schema deliberately declares no default for these columns, so Prisma types them as
 * required on create and a call site that forgets to generate one fails `npm run typecheck`
 * rather than silently minting a weak token.
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}
