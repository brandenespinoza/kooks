"use server";

import { cookies, headers } from "next/headers";

import { joinViaInvite } from "~/server/auth/join";
import {
  SESSION_COOKIE_NAME,
  getSessionFromHeaders,
  sessionCookieOptions,
} from "~/server/auth/session";

/**
 * Onboarding runs as a Server Action, not a tRPC mutation.
 *
 * A tRPC procedure cannot reliably set a cookie in this app: the client uses
 * httpBatchStreamLink, so response headers are flushed before a procedure resolves, and
 * tRPC's fetch handler constructs its own Response, which bypasses Next's cookie
 * collection. Both `ctx.resHeaders.append("Set-Cookie", …)` and `cookies().set()` inside a
 * procedure are silently dropped — the account is created but the browser never receives a
 * session. Server Actions are the supported place to set cookies, and they work regardless
 * of the tRPC transport.
 */
export async function joinViaInviteAction(input: {
  inviteToken: string;
  displayName?: string;
}) {
  const session = await getSessionFromHeaders(new Headers(await headers()));

  const result = await joinViaInvite({
    inviteToken: input.inviteToken,
    displayName: input.displayName,
    currentUserId: session?.userId ?? null,
  });

  if (result.ok && result.token) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions());
  }

  return result;
}
