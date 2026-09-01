import { TRPCError } from "@trpc/server";
import { type PrismaClient } from "@prisma/client";
import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { createSession, serializeSessionCookie } from "~/server/auth/session";

export const joinViaInviteSchema = z.object({
  inviteToken: z.string().min(1),
  /**
   * Required only for a brand-new account. An already-authenticated user tapping an invite
   * link is just forming a crew connection and is never asked to re-enter a name (AC 8).
   */
  displayName: z.string().trim().min(1).max(50).optional(),
});

/**
 * Writes the bidirectional crew pair. Storing both directions keeps every read a single
 * indexed lookup instead of an OR across two columns.
 *
 * `createMany` + `skipDuplicates` makes re-tapping a link a no-op rather than an error.
 */
async function connectCrew(
  db: PrismaClient,
  userId: string,
  friendId: string
) {
  if (userId === friendId) return;

  await db.crewMember.createMany({
    data: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
    skipDuplicates: true,
  });
}

export const crewRouter = createTRPCRouter({
  /**
   * The sole account-creation path (FR-22). Public by necessity — the caller has no session yet.
   *
   * Three cases:
   *   - unauthenticated + valid token -> create User, NotificationPref, Session, crew pair; set cookie
   *   - authenticated + someone else's token -> create crew pair only
   *   - authenticated + own token -> no-op (AC 9)
   */
  joinViaInvite: publicProcedure
    .input(joinViaInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const inviter = await ctx.db.user.findUnique({
        where: { inviteToken: input.inviteToken },
        select: { id: true, displayName: true },
      });

      if (!inviter) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "This invite link is not valid.",
        });
      }

      // Already signed in: form the connection, never re-onboard.
      if (ctx.user) {
        await connectCrew(ctx.db, ctx.user.id, inviter.id);
        return {
          userId: ctx.user.id,
          displayName: ctx.user.displayName,
          createdAccount: false,
          connectedTo: ctx.user.id === inviter.id ? null : inviter.displayName,
        };
      }

      const displayName = input.displayName?.trim();
      if (!displayName) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A display name is required.",
        });
      }

      const user = await ctx.db.user.create({
        data: {
          displayName,
          // All three notification types default to true (Story 6.4 AC).
          notificationPrefs: { create: {} },
        },
        select: { id: true, displayName: true },
      });

      await connectCrew(ctx.db, user.id, inviter.id);

      const session = await createSession(user.id);

      // resHeaders is absent for the RSC caller; this procedure is only reached over HTTP.
      if (!ctx.resHeaders) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Cannot establish a session outside an HTTP request.",
        });
      }
      ctx.resHeaders.append(
        "Set-Cookie",
        serializeSessionCookie(session.token)
      );

      return {
        userId: user.id,
        displayName: user.displayName,
        createdAccount: true,
        connectedTo: inviter.displayName,
      };
    }),

  /** Smallest possible proof that the session cookie resolves to a user (AC 4, AC 6). */
  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      displayName: ctx.user.displayName,
      homeBreakId: ctx.user.homeBreakId,
    };
  }),
});
