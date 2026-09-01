import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertCrewMember } from "~/server/auth/assert-crew-member";
import { emitter, type PresenceEvent } from "~/server/events";

export const createBreakSchema = z.object({
  label: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const breakIdSchema = z.object({ breakId: z.string().min(1) });

export const breakRouter = createTRPCRouter({
  /**
   * The Breaks in the user's own swipe stack, in their saved order.
   *
   * No `assertCrewMember` here: this reads the caller's own `UserSavedBreak` rows rather
   * than a specific Break, so there is no break-scoped resource to authorize (rule 2).
   *
   * Story 2.3 adds reordering; 5.2 widens visibility to Breaks created by crew members.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const saved = await ctx.db.userSavedBreak.findMany({
      where: { userId: ctx.user.id },
      orderBy: [{ sortOrder: "asc" }, { breakId: "asc" }],
      select: {
        sortOrder: true,
        break: {
          select: {
            id: true,
            label: true,
            lat: true,
            lng: true,
            createdById: true,
            conditionsVerdict: true,
            conditionsUpdatedAt: true,
          },
        },
      },
    });

    return saved.map(({ break: surfBreak, sortOrder }) => ({
      id: surfBreak.id,
      label: surfBreak.label,
      lat: surfBreak.lat,
      lng: surfBreak.lng,
      sortOrder,
      isHomeBreak: ctx.user.homeBreakId === surfBreak.id,
      isMine: surfBreak.createdById === ctx.user.id,
      conditionsVerdict: surfBreak.conditionsVerdict,
      conditionsUpdatedAt: surfBreak.conditionsUpdatedAt,
    }));
  }),

  /** FR-1. Creates the Break and saves it to the creator's own stack in one transaction. */
  create: protectedProcedure
    .input(createBreakSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      const created = await ctx.db.$transaction(async (tx) => {
        const last = await tx.userSavedBreak.findFirst({
          where: { userId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        const surfBreak = await tx.break.create({
          data: {
            label: input.label,
            lat: input.lat,
            lng: input.lng,
            createdById: userId,
          },
          select: { id: true, label: true, lat: true, lng: true },
        });

        await tx.userSavedBreak.create({
          data: {
            userId,
            breakId: surfBreak.id,
            sortOrder: last ? last.sortOrder + 1 : 0,
          },
        });

        // FR-4a: the first Break a user saves becomes their Home Break automatically —
        // the dawn patrol and night-before pushes have nowhere to point otherwise.
        const isFirst = last === null;
        if (isFirst) {
          await tx.user.update({
            where: { id: userId },
            data: { homeBreakId: surfBreak.id },
          });
        }

        return { ...surfBreak, isHomeBreak: isFirst };
      });

      emitBreakEvent("break.created", created.id, {
        label: created.label,
        createdById: userId,
      });

      return created;
    }),

  /**
   * FR-3. Only the creator may delete; crew members unsave instead (Story 2.3).
   *
   * `UserSavedBreak` and `CheckIn` rows cascade from the Break's foreign keys, but
   * `User.homeBreakId` is deliberately not a foreign key (it would create a User <-> Break
   * cycle), so it has to be cleared by hand or it dangles.
   */
  delete: protectedProcedure
    .input(breakIdSchema)
    .mutation(async ({ ctx, input }) => {
      const surfBreak = await ctx.db.break.findUnique({
        where: { id: input.breakId },
        select: { id: true, createdById: true, label: true },
      });

      if (!surfBreak) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Break not found" });
      }
      if (surfBreak.createdById !== ctx.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the person who created a break can delete it.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.user.updateMany({
          where: { homeBreakId: surfBreak.id },
          data: { homeBreakId: null },
        }),
        ctx.db.break.delete({ where: { id: surfBreak.id } }),
      ]);

      emitBreakEvent("break.deleted", surfBreak.id, { label: surfBreak.label });

      return { id: surfBreak.id };
    }),

  /** FR-4a. Exactly one Home Break per user — a scalar column, so setting one clears the last. */
  setHomeBreak: protectedProcedure
    .input(breakIdSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCrewMember(ctx, input.breakId);

      const saved = await ctx.db.userSavedBreak.findUnique({
        where: { userId_breakId: { userId: ctx.user.id, breakId: input.breakId } },
        select: { breakId: true },
      });

      if (!saved) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Save this break to your list before making it your home break.",
        });
      }

      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { homeBreakId: input.breakId },
      });

      return { homeBreakId: input.breakId };
    }),
});

/**
 * Emitted after the DB write, never speculatively (rule 5). Nothing listens yet — the SSE
 * route arrives in Story 4.2 — but emitting now means that route works without revisiting
 * these mutations, and an emitter with no listeners is a no-op.
 */
function emitBreakEvent(
  type: Extract<PresenceEvent["type"], "break.created" | "break.deleted">,
  breakId: string,
  payload: Record<string, unknown>
) {
  const event: PresenceEvent = { type, breakId, payload };
  emitter.emit(type, event);
}
