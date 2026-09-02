"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import { PasskeyError, signInOptions, verifySignIn } from "~/server/auth/passkeys";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "~/server/auth/session";

/**
 * Passkey sign-in, as Server Actions rather than tRPC procedures.
 *
 * Same constraint as onboarding, for the same reason: this app's tRPC transport cannot set a
 * cookie. `httpBatchStreamLink` flushes response headers before a procedure resolves, and
 * tRPC's fetch handler builds its own `Response`, so a `Set-Cookie` from a mutation is
 * silently dropped — the session row would be created and the browser would never receive
 * it. Enrolment, which sets no cookie, stays in `passkeyRouter`.
 *
 * These are the only endpoints in the app that hand a session to someone who arrived
 * without one and is *not* becoming a new user.
 */

/**
 * Structural check only — SimpleWebAuthn does the real work (base64url decode, signature
 * verification against the stored public key). This is a public endpoint, so it rejects
 * malformed input before the ceremony rather than after.
 */
const authenticationResponseSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  type: z.literal("public-key"),
  // `z.unknown()`, not a record: the DOM type for this is an interface, and TypeScript does
  // not give interfaces an implicit index signature, so a `Record<string, unknown>` input
  // would reject the very object the browser produces. It carries extension metadata
  // SimpleWebAuthn re-derives from the attestation anyway.
  clientExtensionResults: z.unknown(),
  authenticatorAttachment: z.string().optional(),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.string().optional(),
  }),
});

export type PasskeySignInResult = { ok: true } | { ok: false; error: string };

/** Step 1: the challenge. No session required — nobody is signed in yet, by definition. */
export async function passkeySignInOptionsAction() {
  return signInOptions();
}

/**
 * Step 2: verify and set the cookie.
 *
 * On success the caller navigates; the session belongs to the **existing** user the
 * credential resolves to, and no `User` row is created anywhere on this path.
 */
export async function passkeySignInAction(
  response: AuthenticationResponseJSON,
): Promise<PasskeySignInResult> {
  const parsed = authenticationResponseSchema.safeParse(response);
  if (!parsed.success) {
    return { ok: false, error: "That sign-in response wasn't valid. Try again." };
  }

  try {
    const { token } = await verifySignIn(response);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

    return { ok: true };
  } catch (error) {
    if (error instanceof PasskeyError) {
      return { ok: false, error: error.message };
    }
    // A database outage must not read as "wrong passkey" — the same distinction `/` draws
    // between an auth failure and an infrastructure one.
    throw error;
  }
}
