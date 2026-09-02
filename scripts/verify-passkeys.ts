/**
 * Verification for the passkey path. Run with:
 *   npx tsx --env-file=.env --conditions=react-server scripts/verify-passkeys.ts
 *
 * There is no test runner in this project, so this exercises the real server module against
 * the real database using a virtual authenticator — an ES256 keypair plus hand-built
 * attestation/assertion structures, which is all a platform authenticator actually is.
 *
 * The assertion that matters: sign-in returns a session for an EXISTING user and the `users`
 * table does not grow. That is the whole feature.
 */
import { createHash, createSign, generateKeyPairSync } from "node:crypto";

import { isoCBOR } from "@simplewebauthn/server/helpers";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { generateToken } from "~/server/auth/tokens";
import {
  PasskeyError,
  registrationOptions,
  signInOptions,
  verifyRegistration,
  verifySignIn,
} from "~/server/auth/passkeys";

const RP_ID = env.PASSKEY_RP_ID;
const ORIGIN = env.PASSKEY_ORIGIN.split(",")[0]!.trim();

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const sha256 = (b: Uint8Array) => new Uint8Array(createHash("sha256").update(b).digest());

/** A virtual platform authenticator: one ES256 keypair and one credential id. */
function makeAuthenticator() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" }) as { x: string; y: string };
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");

  const credentialId = new Uint8Array(
    Buffer.from(generateToken(), "base64url").subarray(0, 32),
  );

  // COSE_Key for ES256: kty=EC2(2), alg=-7, crv=P-256(1), plus the raw coordinates.
  const cosePublicKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, new Uint8Array(x)],
      [-3, new Uint8Array(y)],
    ]) as never,
  );

  function authData(flags: number, includeAttestedData: boolean) {
    const rpIdHash = sha256(new Uint8Array(Buffer.from(RP_ID, "utf8")));
    const flagsBuf = Buffer.from([flags]);
    // Counter stays 0 for every ceremony, exactly like a real synced passkey — which is
    // why `verifySignIn` records the counter but never enforces an increment.
    const counter = Buffer.alloc(4);

    if (!includeAttestedData) {
      return new Uint8Array(Buffer.concat([rpIdHash, flagsBuf, counter]));
    }

    const aaguid = Buffer.alloc(16);
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(credentialId.length, 0);

    return new Uint8Array(
      Buffer.concat([
        rpIdHash,
        flagsBuf,
        counter,
        aaguid,
        credIdLen,
        Buffer.from(credentialId),
        Buffer.from(cosePublicKey),
      ]),
    );
  }

  function clientData(type: string, challenge: string) {
    return new Uint8Array(
      Buffer.from(JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false })),
    );
  }

  return {
    credentialId,

    /** Flags 0x45 = UP | UV | AT (attested credential data present). */
    register(challenge: string): RegistrationResponseJSON {
      const clientDataJSON = clientData("webauthn.create", challenge);
      const attestationObject = isoCBOR.encode(
        new Map<string, unknown>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", authData(0x45, true)],
        ]) as never,
      );

      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(clientDataJSON),
          attestationObject: b64url(new Uint8Array(attestationObject)),
          transports: ["internal", "hybrid"],
        },
      } as RegistrationResponseJSON;
    },

    /** Flags 0x05 = UP | UV. No attested data on an assertion. */
    authenticate(challenge: string, userHandle: string): AuthenticationResponseJSON {
      const clientDataJSON = clientData("webauthn.get", challenge);
      const data = authData(0x05, false);
      const signed = Buffer.concat([Buffer.from(data), Buffer.from(sha256(clientDataJSON))]);
      const signature = createSign("SHA256").update(signed).sign(privateKey);

      return {
        id: b64url(credentialId),
        rawId: b64url(credentialId),
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64url(clientDataJSON),
          authenticatorData: b64url(data),
          signature: b64url(new Uint8Array(signature)),
          userHandle,
        },
      } as AuthenticationResponseJSON;
    },
  };
}

async function main() {
  console.log(`\nRP ID: ${RP_ID}   origin: ${ORIGIN}\n`);

  const user = await db.user.create({
    data: {
      displayName: "Verify Script",
      inviteToken: generateToken(),
      notificationPrefs: { create: {} },
    },
    select: { id: true, displayName: true },
  });

  const usersBefore = await db.user.count();
  const auth = makeAuthenticator();

  try {
    // --- 1. Registration options --------------------------------------------------
    console.log("1. Registration options");
    const regOpts = await registrationOptions(user.id);
    check(
      "residentKey required (discoverable — sign-in has no username to look up)",
      regOpts.authenticatorSelection?.residentKey === "required",
      String(regOpts.authenticatorSelection?.residentKey),
    );
    check(
      "userVerification required",
      regOpts.authenticatorSelection?.userVerification === "required",
    );
    check(
      "authenticatorAttachment unset (keeps the cross-device QR flow available)",
      regOpts.authenticatorSelection?.authenticatorAttachment === undefined,
    );
    check(
      "user handle decodes to the User.id",
      Buffer.from(regOpts.user.id, "base64url").toString("utf8") === user.id,
    );

    // --- 2. Registration ------------------------------------------------------------
    console.log("\n2. Registration");
    const regResponse = auth.register(regOpts.challenge);
    const registered = await verifyRegistration({
      userId: user.id,
      response: regResponse,
      deviceLabel: "Virtual iPhone",
    });
    check("credential stored", Boolean(registered.credentialId));

    const stored = await db.credential.findUnique({
      where: { credentialId: registered.credentialId },
    });
    check("credential belongs to the right user", stored?.userId === user.id);
    check("transports persisted", (stored?.transports.length ?? 0) === 2);

    // --- 3. Registration challenge is single-use ------------------------------------
    console.log("\n3. Registration replay");
    let replayRejected = false;
    try {
      await verifyRegistration({ userId: user.id, response: regResponse });
    } catch {
      replayRejected = true;
    }
    check("replaying a consumed registration challenge is rejected", replayRejected);

    // --- 4. Sign-in options ---------------------------------------------------------
    console.log("\n4. Sign-in options");
    const signInOpts = await signInOptions();
    check(
      "allowCredentials omitted (browser picks, then tells us who it was)",
      signInOpts.allowCredentials === undefined,
    );
    check("userVerification required", signInOpts.userVerification === "required");

    // --- 5. Sign-in: the core assertion ---------------------------------------------
    console.log("\n5. Sign-in");
    const handle = Buffer.from(user.id, "utf8").toString("base64url");
    const authResponse = auth.authenticate(signInOpts.challenge, handle);
    const result = await verifySignIn(authResponse);

    check("resolves to the EXISTING user", result.userId === user.id);
    check("returns a session token", Boolean(result.token));

    const session = await db.session.findUnique({ where: { token: result.token } });
    check("session row exists and points at that user", session?.userId === user.id);

    const usersAfter = await db.user.count();
    check(
      "NO new user was created by signing in",
      usersAfter === usersBefore,
      `${usersBefore} -> ${usersAfter}`,
    );

    const used = await db.credential.findUnique({
      where: { credentialId: registered.credentialId },
    });
    check("lastUsedAt recorded", used?.lastUsedAt !== null);

    // --- 6. Sign-in replay ----------------------------------------------------------
    console.log("\n6. Sign-in replay");
    let signInReplayRejected = false;
    try {
      await verifySignIn(authResponse);
    } catch {
      signInReplayRejected = true;
    }
    check("replaying a consumed sign-in challenge is rejected", signInReplayRejected);

    // --- 7. A registration challenge cannot be used to sign in ----------------------
    console.log("\n7. Challenge cross-use");
    const regOpts2 = await registrationOptions(user.id);
    let crossUseRejected = false;
    try {
      await verifySignIn(auth.authenticate(regOpts2.challenge, handle));
    } catch {
      crossUseRejected = true;
    }
    check(
      "an enrolment challenge cannot be replayed as a login",
      crossUseRejected,
    );

    // --- 8. Expired challenge -------------------------------------------------------
    console.log("\n8. Expiry");
    const expiredOpts = await signInOptions();
    await db.webAuthnChallenge.updateMany({
      where: { challenge: expiredOpts.challenge },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    let expiryRejected = false;
    try {
      await verifySignIn(auth.authenticate(expiredOpts.challenge, handle));
    } catch {
      expiryRejected = true;
    }
    check("an expired challenge is rejected", expiryRejected);

    // --- 9. Unknown credential ------------------------------------------------------
    console.log("\n9. Unknown credential");
    const stranger = makeAuthenticator();
    const strangerOpts = await signInOptions();
    let unknownRejected = false;
    try {
      await verifySignIn(stranger.authenticate(strangerOpts.challenge, handle));
    } catch (error) {
      unknownRejected = error instanceof PasskeyError;
    }
    check("an unregistered passkey is rejected", unknownRejected);

    // --- 10. Mismatched user handle -------------------------------------------------
    console.log("\n10. Handle mismatch");
    const mismatchOpts = await signInOptions();
    const wrongHandle = Buffer.from("some-other-user-id", "utf8").toString("base64url");
    let mismatchRejected = false;
    try {
      await verifySignIn(auth.authenticate(mismatchOpts.challenge, wrongHandle));
    } catch (error) {
      mismatchRejected = error instanceof PasskeyError;
    }
    check("a handle that disagrees with the credential is rejected", mismatchRejected);
  } finally {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.credential.deleteMany({ where: { userId: user.id } });
    await db.notificationPref.deleteMany({ where: { userId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.webAuthnChallenge.deleteMany({});
    console.log("\n(cleaned up)");
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
