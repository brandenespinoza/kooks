import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { createSession } from "~/server/auth/session";

/**
 * Passkeys are the only way an existing user gets a session on a device that has never had
 * one. Everything else in this app's auth is account *creation*: `joinViaInvite` mints a
 * `User` and a `Session` together, so before this module the sole way to obtain a cookie was
 * to become somebody new — which is why tapping your own invite link on a new phone forked
 * you into a duplicate account instead of signing you in.
 *
 * Two design points here are load-bearing and should not be "simplified":
 *
 * 1. **Credentials are discoverable (resident), always.** There is no email, username or
 *    password anywhere in Kooks, so a returning user has nothing to type and sign-in has
 *    nothing to look an account up by. The credential itself has to carry the user handle.
 *    Downgrade `residentKey` to "preferred" and sign-in silently stops working on whichever
 *    authenticator takes the hint.
 * 2. **`authenticatorAttachment` is deliberately unset.** Pinning it to "platform" would
 *    block WebAuthn's cross-device flow — the QR code a desktop shows and the phone scans —
 *    which is how a device that holds no passkey of its own signs in.
 */
export class PasskeyError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PasskeyError";
  }
}

/** Shown in the OS passkey prompt ("Save a passkey for Kooks?"). */
const RP_NAME = "Kooks";

/** Matches SimpleWebAuthn's default 60s ceremony timeout — a challenge outlives nothing. */
const CHALLENGE_TTL_MS = 60_000;

/**
 * Allowed ceremony origins. Comma-separated so a deployment can accept more than one
 * (a bare domain and a `www.`, say) without a second env var.
 */
function expectedOrigins(): string[] {
  return env.PASSKEY_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Persists a challenge for the length of one ceremony.
 *
 * Server-side rather than a signed cookie because this app has no signing secret —
 * `SESSION_SECRET` was deliberately deleted as decorative — and Postgres is already here.
 *
 * The sweep is why this needs no pg-boss job: every ceremony pays for the expired rows of
 * the ceremonies before it, and the table is indexed on `expiresAt`.
 */
async function storeChallenge(challenge: string, userId: string | null) {
  await db.webAuthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  await db.webAuthnChallenge.create({
    data: {
      challenge,
      userId,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
}

/**
 * Redeems a challenge exactly once, returning the row or null.
 *
 * The `deleteMany` is the atomic claim: two verifications racing on one challenge both
 * reach it, and only the one whose delete reports a row proceeds. A replayed challenge
 * therefore fails on the second attempt rather than on a timestamp comparison.
 */
async function consumeChallenge(challenge: string) {
  const row = await db.webAuthnChallenge.findUnique({ where: { challenge } });
  if (!row) return null;

  const { count } = await db.webAuthnChallenge.deleteMany({ where: { id: row.id } });
  if (count === 0) return null;

  if (row.expiresAt.getTime() < Date.now()) return null;

  return row;
}

/**
 * The user handle a passkey carries is our `User.id`, stored as its UTF-8 bytes.
 *
 * Copied into a freshly allocated buffer rather than returned straight from `TextEncoder`:
 * that yields `Uint8Array<ArrayBufferLike>`, and SimpleWebAuthn's signatures require the
 * narrower `Uint8Array<ArrayBuffer>`.
 */
function encodeUserHandle(userId: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(userId);
  const handle = new Uint8Array(encoded.length);
  handle.set(encoded);
  return handle;
}

function decodeUserHandle(handle: string): string {
  return Buffer.from(handle, "base64url").toString("utf8");
}

/**
 * Step 1 of enrolment. The caller must already be signed in — registration adds a way back
 * into an account that is currently reachable, it never opens one that is not.
 */
export async function registrationOptions(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      credentials: { select: { credentialId: true, transports: true } },
    },
  });

  if (!user) throw new PasskeyError("That account no longer exists.");

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: env.PASSKEY_RP_ID,
    userID: encodeUserHandle(user.id),
    // `displayName` is not unique, so two crew members called "Dave" would be one
    // indistinguishable pair in the browser's account picker — and picking the wrong one is
    // an unrecoverable dead end for someone trying to get back in. The id fragment is only
    // ever seen inside that picker.
    userName: `${user.displayName} (${user.id.slice(-4)})`,
    userDisplayName: user.displayName,
    attestationType: "none",
    // Registering an authenticator that is already on this account would shadow the first
    // row with a second. The browser refuses up front instead.
    excludeCredentials: user.credentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      requireResidentKey: true,
      userVerification: "required",
    },
  });

  await storeChallenge(options.challenge, user.id);

  return options;
}

/**
 * Step 2 of enrolment. Stores the credential; mints no session, because the caller already
 * has one.
 */
export async function verifyRegistration({
  userId,
  response,
  deviceLabel,
}: {
  userId: string;
  response: RegistrationResponseJSON;
  deviceLabel?: string;
}) {
  const verification = await verifyRegistrationResponse({
    response,
    // The callback form is what lets the challenge live in Postgres instead of in a cookie:
    // SimpleWebAuthn hands us the value it parsed out of `clientDataJSON` and we decide.
    expectedChallenge: async (challenge) => {
      const row = await consumeChallenge(challenge);
      if (!row) return false;
      // A challenge minted for one account must not be redeemable against another.
      return row.userId === userId;
    },
    expectedOrigin: expectedOrigins(),
    expectedRPID: env.PASSKEY_RP_ID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new PasskeyError("We couldn't verify that passkey. Try again.");
  }

  const { credential } = verification.registrationInfo;

  await db.credential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceLabel: deviceLabel?.trim().slice(0, 50) ?? null,
    },
  });

  return { credentialId: credential.id };
}

/**
 * Step 1 of sign-in, for a visitor with no session.
 *
 * `allowCredentials` is omitted, not empty: left undefined the browser offers every passkey
 * it holds for this RP and reports which one the user chose. Listing credentials here would
 * mean already knowing who is signing in, which is precisely what we do not know.
 */
export async function signInOptions() {
  const options = await generateAuthenticationOptions({
    rpID: env.PASSKEY_RP_ID,
    userVerification: "required",
  });

  await storeChallenge(options.challenge, null);

  return options;
}

/**
 * Step 2 of sign-in. Resolves the credential to its owner and mints a session for that
 * **existing** user — no `user.create` anywhere on this path, which is the entire point.
 *
 * Returns the raw session token; the caller sets the cookie, because only a Server Action or
 * Route Handler can (this app's tRPC transport drops `Set-Cookie`).
 */
export async function verifySignIn(response: AuthenticationResponseJSON) {
  const credential = await db.credential.findUnique({
    where: { credentialId: response.id },
  });

  if (!credential) {
    throw new PasskeyError("That passkey isn't registered on this account.");
  }

  // Two independent claims about who this is — the credential row we looked up, and the
  // handle the authenticator returned. Cross-check rather than trusting either alone.
  const handle = response.response.userHandle;
  if (handle && decodeUserHandle(handle) !== credential.userId) {
    throw new PasskeyError("That passkey doesn't match the account it points at.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: async (challenge) => {
      const row = await consumeChallenge(challenge);
      // Sign-in challenges are stored with a null userId because no user was known when
      // they were minted. A row carrying one came from a registration ceremony, and
      // accepting it here would let an enrolment challenge be replayed as a login.
      return row !== null && row.userId === null;
    },
    expectedOrigin: expectedOrigins(),
    expectedRPID: env.PASSKEY_RP_ID,
    credential: {
      id: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new PasskeyError("We couldn't verify that passkey. Try again.");
  }

  // Recorded, never enforced. Synced passkeys report a counter of 0 for their whole life,
  // so refusing a non-increment would reject every ordinary iCloud or Google credential —
  // the exact users this feature exists for.
  await db.credential.update({
    where: { id: credential.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  const session = await createSession(credential.userId);

  return { userId: credential.userId, token: session.token };
}
