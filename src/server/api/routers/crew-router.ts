
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { emitter, type PresenceEvent } from "~/server/events";

/**
 * Onboarding is NOT here. `joinViaInvite` lives in the Server Action at
 * `src/app/join/[inviteToken]/actions.ts` because it must set a session cookie, which a
 * tRPC procedure cannot do over this app's streaming transport — see that file.
 *
 * Story 5.1 added `getInviteLink`; 5.3 adds `remove` and sign-out.
 */
export const crewRouter = createTRPCRouter({
  /**
   * FR-14. The caller's own invite link.
   *
   * Returns a **path**, not an absolute URL. The origin is the browser's to supply
   * (`window.location.origin`): the alternative is either trusting the `Host` header or
   * adding an `APP_URL` env var, and a path composed client-side is correct in every
   * deployment without either. The token is read from the session's user — no query.
   *
   * The token never rotates in V1 (logged in deferred-work), so anyone who has ever held
   * this link can still join the crew with it.
   */
  getInviteLink: protectedProcedure.query(({ ctx }) => {
    return {
      inviteToken: ctx.user.inviteToken,
      path: `/join/${ctx.user.inviteToken}`,
    };
  }),

  /** FR-17. The caller's crew, for the Settings screen. Direct connections only (NFR-7). */
  list: protectedProcedure.query(async ({ ctx }) => {
    const crew = await ctx.db.crewMember.findMany({
      where: { userId: ctx.user.id },
      select: { friend: { select: { id: true, displayName: true } } },
    });

    return crew
      .map((member) => member.friend)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }),

  /**
   * FR-17. Severs a crew connection.
   *
   * **Both directions, always.** The pair is written mutually on join, so deleting one row
   * would leave the other person still seeing you while you no longer see them — a
   * one-sided connection the rest of the app has no concept of.
   *
   * Saved Breaks are deliberately left alone. Removing someone from your crew ends the
   * *presence* relationship — `listCrewUserIds` stops including them, so neither side sees
   * the other's check-ins — but a Break you saved is a place you surf, not a friendship.
   * `assertCrewMember`'s third rule (you saved it) keeps it reachable on purpose.
   */
  remove: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't remove yourself from your own crew.",
        });
      }

      const { count } = await ctx.db.crewMember.deleteMany({
        where: {
          OR: [
            { userId: ctx.user.id, friendId: input.userId },
            { userId: input.userId, friendId: ctx.user.id },
          ],
        },
      });

      if (count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That person isn't in your crew.",
        });
      }

      // Both parties' streams rebuild their crew set on this and refetch, so the severed
      // connection stops carrying check-ins without either side reloading.
      const event: PresenceEvent = {
        type: "crew.removed",
        breakId: null,
        payload: { userIds: [ctx.user.id, input.userId] },
      };
      emitter.emit(event.type, event);

      return { userId: input.userId };
    }),

  /**
   * Smallest possible proof that the session cookie resolves to a user (AC 4, AC 6).
   *
   * Also carries `hasPasskey`, which is the mandatory-enrolment gate. It rides here rather
   * than in middleware because middleware runs on the Edge Runtime and cannot reach Prisma
   * (enforcement rule 15) — and `/` and `/settings` already call this procedure as their
   * auth guard, so the gate costs no extra round trip.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const credentialCount = await ctx.db.credential.count({
      where: { userId: ctx.user.id },
    });

    return {
      id: ctx.user.id,
      displayName: ctx.user.displayName,
      homeBreakId: ctx.user.homeBreakId,
      hasPasskey: credentialCount > 0,
    };
  }),
});
