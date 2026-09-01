import "server-only";

import { db } from "~/server/db";
import { env } from "~/env";

export const SESSION_COOKIE_NAME = "kooks-session";

/** Sessions have no expiry in V1 — tracked in deferred-work.md. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type SessionWithUser = NonNullable<
  Awaited<ReturnType<typeof getSessionByToken>>
>;

/**
 * Minimal cookie-header parser. Avoids a dependency for the one header we read.
 * Values are not URL-decoded: session tokens are cuids, which are already safe.
 */
function readCookie(headers: Headers, name: string): string | null {
  const header = headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export async function getSessionByToken(token: string) {
  if (!token) return null;

  return db.session.findUnique({
    where: { token },
    include: { user: true },
  });
}

/** Resolves the session from a request's cookie header. Returns null when absent or unknown. */
export async function getSessionFromHeaders(headers: Headers) {
  const token = readCookie(headers, SESSION_COOKIE_NAME);
  if (!token) return null;

  return getSessionByToken(token);
}

export async function createSession(userId: string) {
  return db.session.create({ data: { userId } });
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { token } });
}

/**
 * Builds the Set-Cookie value for a session token.
 *
 * `Secure` is omitted in development so the cookie survives plain-HTTP localhost;
 * in production TLS is terminated by Nginx Proxy Manager upstream.
 */
export function serializeSessionCookie(token: string): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearedSessionCookie(): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ];
  if (env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}
