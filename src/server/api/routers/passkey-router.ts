import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  PasskeyError,
  registrationOptions,
  verifyRegistration,
} from "~/server/auth/passkeys";

/**
 * Enrolment only. **Sign-in is not here** — it mints a session cookie, and this app's tRPC
 * transport silently drops `Set-Cookie` (`httpBatchStreamLink` flushes headers before a
 * procedure resolves). That half lives in the Server Action at
 * `src/app/join-required/actions.ts`, the same reason onboarding does.
 *
 * Everything in this router is `protectedProcedure`: registering a passkey adds a way back
 * into an account that is currently reachable. It never opens one that is not.
 */

/**
 * Structural check on the browser's registration response.
 *
 * Deliberately shallow. The real validation is SimpleWebAuthn's — base64url decoding, CBOR
 * parsing, attestation and signature checks — and duplicating the WebAuthn spec in Zod would
 * be a second source of truth that can only drift. This rejects obvious junk before it
 * reaches the ceremony and gives tRPC a typed input.
 */
const registrationResponseSchema = z.object({
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
    attestationObject: z.string().min(1),
    transports: z.array(z.string()).optional(),
    publicKeyAlgorithm: z.number().optional(),
    publicKey: z.string().optional(),
    authenticatorData: z.string().optional(),
  }),
});

export const passkeyRouter = createTRPCRouter({
  /** The caller's registered passkeys, for the Settings list. */
  list: protectedProcedure.query(async ({ ctx }) => {
    const credentials = await ctx.db.credential.findMany({
      where: { userId: ctx.user.id },
      select: {
        credentialId: true,
        deviceLabel: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return credentials.map((credential) => ({
      credentialId: credential.credentialId,
      deviceLabel: credential.deviceLabel,
      createdAt: credential.createdAt.toISOString(),
      lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
    }));
  }),

  /**
   * Step 1 of enrolment.
   *
   * A mutation rather than a query despite reading like one: it writes a challenge row, and
   * a cached query would hand the same single-use challenge to two ceremonies.
   */
  registrationOptions: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await registrationOptions(ctx.user.id);
    } catch (error) {
      if (error instanceof PasskeyError) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
      }
      throw error;
    }
  }),

  /** Step 2 of enrolment. */
  verifyRegistration: protectedProcedure
    .input(
      z.object({
        response: registrationResponseSchema,
        deviceLabel: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await verifyRegistration({
          userId: ctx.user.id,
          // The schema above validates shape, not the WebAuthn spec's literal unions, so
          // its inferred type is deliberately looser than the library's.
          response: input.response as RegistrationResponseJSON,
          deviceLabel: input.deviceLabel,
        });
      } catch (error) {
        if (error instanceof PasskeyError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message, cause: error });
        }
        throw error;
      }
    }),

  /**
   * Removes a passkey — but never the last one.
   *
   * There is no recovery path in this app by design: no email, no password, no crew-vouched
   * reset. Deleting a lone credential would therefore be a one-tap, permanent lockout, so it
   * is refused rather than confirmed.
   */
  remove: protectedProcedure
    .input(z.object({ credentialId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const credentials = await ctx.db.credential.findMany({
        where: { userId: ctx.user.id },
        select: { id: true, credentialId: true },
      });

      const target = credentials.find(
        (credential) => credential.credentialId === input.credentialId,
      );

      if (!target) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That passkey isn't on your account.",
        });
      }

      if (credentials.length === 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That's your only passkey. Add another device first — removing this one would lock you out for good.",
        });
      }

      await ctx.db.credential.delete({ where: { id: target.id } });

      return { credentialId: input.credentialId };
    }),
});
