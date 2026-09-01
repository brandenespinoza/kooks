import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertCrewMember } from "~/server/auth/assert-crew-member";
import { emitter, type PresenceEvent } from "~/server/events";
import { logger } from "~/server/logger";
import { sendToCrewMembers } from "~/server/push/web-push";

/** Furthest ahead a check-in may be declared. Dawn patrol is tomorrow at the latest. */
const MAX_ETA_AHEAD_MS = 24 * 60 * 60 * 1000;
/** Slack for a slow tap on the current 15-minute slot. */
const ETA_PAST_GRACE_MS = 60 * 1000;

export const checkInSchema = z.object({
  breakId: z.string().min(1),
  eta: z.date(),
});

export const checkInRouter = createTRPCRouter({
  /**
   * FR-10. Declares intent to surf at a Break at an ETA.
   *
   * An **upsert on `userId`**, not a plain create. `CheckIn.userId` is `@unique` — one active
   * check-in per user is a schema-level invariant — so a second create would throw a
   * constraint error, and the CTA's "Edit" affordance would be a button that always fails.
   * Confirming from another Break therefore *moves* the check-in, which is the only reading
   * of FR-10 that leaves the user somewhere sensible.
   */
  create: protectedProcedure
    .input(checkInSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCrewMember(ctx, input.breakId);

      assertEtaInWindow(input.eta);

      const userId = ctx.user.id;

      // Read before write: the previous Break's crew needs a removal event when a check-in
      // moves, or that screen keeps showing someone who is no longer coming.
      const existing = await ctx.db.checkIn.findUnique({
        where: { userId },
        select: { id: true, breakId: true },
      });

      const checkIn = await ctx.db.checkIn.upsert({
        where: { userId },
        create: { userId, breakId: input.breakId, eta: input.eta },
        update: { breakId: input.breakId, eta: input.eta },
        select: { id: true, breakId: true, eta: true },
      });

      const payload = {
        checkInId: checkIn.id,
        userId,
        displayName: ctx.user.displayName,
        eta: checkIn.eta.toISOString(),
      };

      if (existing && existing.breakId !== checkIn.breakId) {
        emit("checkIn.removed", existing.breakId, {
          checkInId: existing.id,
          userId,
        });
      }

      emit(
        existing && existing.breakId === checkIn.breakId
          ? "checkIn.updated"
          : "checkIn.created",
        checkIn.breakId,
        payload,
      );

      const surfBreak = await ctx.db.break.findUnique({
        where: { id: checkIn.breakId },
        select: { label: true },
      });

      notify(ctx.user.id, checkIn.breakId, {
        title: `${ctx.user.displayName} is going`,
        body: `${surfBreak?.label ?? "a break"} at ${formatEta(checkIn.eta)}`,
        url: "/",
        tag: `check-in-${ctx.user.id}`,
      });

      return checkIn;
    }),

  /**
   * FR-11. Changes the ETA of an existing check-in, at the Break it is already on.
   *
   * Distinct from `create` despite the upsert: this one **refuses to create**. Editing is
   * reached from the "You're in at … · Edit" CTA, where a missing row means the check-in
   * expired or was removed on another device — silently recreating it would put someone
   * back on a beach they had left.
   */
  update: protectedProcedure
    .input(z.object({ eta: z.date() }))
    .mutation(async ({ ctx, input }) => {
      assertEtaInWindow(input.eta);

      const existing = await ctx.db.checkIn.findUnique({
        where: { userId: ctx.user.id },
        select: { id: true, breakId: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "You don't have an active check-in.",
        });
      }

      const checkIn = await ctx.db.checkIn.update({
        where: { userId: ctx.user.id },
        data: { eta: input.eta },
        select: { id: true, breakId: true, eta: true },
      });

      emit("checkIn.updated", checkIn.breakId, {
        checkInId: checkIn.id,
        userId: ctx.user.id,
        displayName: ctx.user.displayName,
        eta: checkIn.eta.toISOString(),
      });

      const surfBreak = await ctx.db.break.findUnique({
        where: { id: checkIn.breakId },
        select: { label: true },
      });

      notify(ctx.user.id, checkIn.breakId, {
        title: `${ctx.user.displayName} changed their time`,
        body: `${surfBreak?.label ?? "a break"} at ${formatEta(checkIn.eta)}`,
        url: "/",
        tag: `check-in-${ctx.user.id}`,
      });

      return checkIn;
    }),

  /**
   * FR-12. Cancels the caller's check-in.
   *
   * Keyed on `userId` rather than a check-in id: one active check-in per user is the schema
   * invariant, so there is nothing to disambiguate and nothing another user could target.
   */
  remove: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.checkIn.findUnique({
      where: { userId: ctx.user.id },
      select: { id: true, breakId: true },
    });

    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "You don't have an active check-in.",
      });
    }

    await ctx.db.checkIn.delete({ where: { userId: ctx.user.id } });

    emit("checkIn.removed", existing.breakId, {
      checkInId: existing.id,
      userId: ctx.user.id,
    });

    const surfBreak = await ctx.db.break.findUnique({
      where: { id: existing.breakId },
      select: { label: true },
    });

    notify(ctx.user.id, existing.breakId, {
      title: `${ctx.user.displayName} isn't going`,
      body: `No longer heading to ${surfBreak?.label ?? "that break"}`,
      url: "/",
      tag: `check-in-${ctx.user.id}`,
    });

    return { id: existing.id, breakId: existing.breakId };
  }),
});

/** Shared by `create` and `update` — the client can only offer valid slots, but says who. */
function assertEtaInWindow(eta: Date) {
  const now = Date.now();
  const value = eta.getTime();

  if (value < now - ETA_PAST_GRACE_MS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "That time has already passed.",
    });
  }
  if (value > now + MAX_ETA_AHEAD_MS) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Check in for the next 24 hours, not further out.",
    });
  }
}

/** Emitted only after a successful write (rule 5). Story 4.2 adds the listener. */
function emit(
  type: PresenceEvent["type"],
  breakId: string,
  payload: Record<string, unknown>,
) {
  const event: PresenceEvent = { type, breakId, payload };
  emitter.emit(type, event);
}

/**
 * FR-18, fire-and-forget.
 *
 * Deliberately **not** awaited: a check-in is a one-tap action and must not wait on Apple's
 * or Google's push service to answer. NFR-3 allows 30 seconds; the mutation should answer in
 * milliseconds. This is a long-running Node server, not a serverless function, so the
 * promise survives the response.
 *
 * Errors are swallowed after logging for the same reason `sendToUsers` swallows per-endpoint
 * failures: a push service having a bad day must never fail somebody's check-in.
 */
function notify(
  actorId: string,
  breakId: string,
  payload: Parameters<typeof sendToCrewMembers>[2],
) {
  void sendToCrewMembers(actorId, breakId, payload).catch((error) => {
    logger.error({ err: error, actorId, breakId }, "push: notify failed");
  });
}

/** Matches the ETA formatting on the crew rows — "6:45 am". */
function formatEta(eta: Date): string {
  return eta
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}
