"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE_NAME,
  deleteSession,
  getSessionFromHeaders,
} from "~/server/auth/session";

/**
 * Sign out (deferred from Story 1.3, parked for this story).
 *
 * A Server Action, not a tRPC mutation, for the same reason onboarding is one: this app's
 * tRPC transport cannot set or clear a cookie — `httpBatchStreamLink` flushes headers before
 * a procedure resolves and tRPC's fetch handler builds its own `Response`, so the
 * `Set-Cookie` is silently dropped.
 *
 * The session row is deleted as well as the cookie. Clearing only the cookie would leave a
 * valid token in the database that anyone holding a copy could keep using — and V1 sessions
 * never expire, so it would be valid forever.
 */
export async function signOutAction() {
  const session = await getSessionFromHeaders(new Headers(await headers()));

  if (session) {
    await deleteSession(session.token);
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  redirect("/join-required");
}
