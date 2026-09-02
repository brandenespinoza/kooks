import "server-only";

import { db } from "~/server/db";
import { env } from "~/env";
import { generateToken } from "~/server/auth/tokens";

export const SESSION_COOKIE_NAME = "kooks-session";

/** Sessions have no expiry in V1 — tracked in deferred-work.md. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type SessionWithUser = NonNullable<
  Awaited<ReturnType<typeof getSessionByToken>>
>;

/**
 * Minimal cookie-header parser. Avoids a dependency for the one header we read.
 * Values are not URL-decoded, and do not need to be: tokens are base64url, whose alphabet
 * (`A-Za-z0-9-_`) contains nothing a cookie value would have escaped.
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
  return db.session.create({ data: { userId, token: generateToken() } });
}

export async function deleteSession(token: string) {
  await db.session.deleteMany({ where: { token } });
}

/**
 * Cookie attributes for the session, shaped for `cookies().set()` from next/headers.
 *
 * `secure` is omitted in development so the cookie survives plain-HTTP localhost; in
 * production TLS is terminated by Nginx Proxy Manager upstream.
 */
export function sessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Builds a raw Set-Cookie value. Retained for any non-Next context (a plain Response, a
 * test); the app itself sets the cookie through `cookies()` — see sessionCookieOptions.
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
