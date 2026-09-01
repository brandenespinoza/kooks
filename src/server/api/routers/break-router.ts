import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  assertCrewMember,
  listCrewUserIds,
} from "~/server/auth/assert-crew-member";
import { emitter, type PresenceEvent } from "~/server/events";
import { conditionsRawDataSchema } from "~/lib/swellcloud";
import { webcamUrlFor } from "~/lib/webcams";

export const createBreakSchema = z.object({
  label: z.string().trim().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const breakIdSchema = z.object({ breakId: z.string().min(1) });

export const breakRouter = createTRPCRouter({
  /**
   * Every Break the caller can see (FR-16), each flagged with whether it is in their own
   * stack.
   *
   * **The swipe stack is still saved Breaks only.** The Story 5.2 AC reads "return all
   * Breaks created by or saved by any direct crew member ... visible in the requesting
   * user's swipe stack", but the PRD is explicit in the other direction — FR-2 swipes
   * between "their saved Breaks", and FR-4b says unsaving "removes it from the user's swipe
   * stack". Auto-filling the stack would make `break.save`/`unsave` meaningless. So this
   * query widens to everything visible, `isSaved` marks what belongs in the stack, and
   * `BreakSwipeStack` filters on it. That folds the 2.3 `crewBreaks` stopgap into one query,
   * which is what the sprint plan actually asked for.
   *
   * **"or saved by a crew member" is deliberately not implemented.** A Break your friend
   * saved but did not create belongs to someone you have no connection to — surfacing it is
   * friend-of-friend access, which NFR-7 forbids and `assertCrewMember` already refuses.
   * Returning rows that every subsequent procedure rejects would be worse than not
   * returning them. Visibility here is exactly `assertCrewMember`'s rule, in list form.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const crewIds = await listCrewUserIds(ctx.db, userId);

    const breaks = await ctx.db.break.findMany({
      where: {
        OR: [
          { createdById: { in: crewIds } },
          { savedBy: { some: { userId } } },
        ],
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        label: true,
        lat: true,
        lng: true,
        createdById: true,
        conditionsVerdict: true,
        conditionsUpdatedAt: true,
        rawData: true,
        savedBy: {
          where: { userId },
          select: { sortOrder: true },
        },
        createdBy: { select: { displayName: true } },
        // NFR-7. Presence is scoped to people, not places: two crew members can share a
        // Break without sharing a connection, and neither should see the other's check-in.
        checkIns: {
          where: { userId: { in: crewIds } },
          orderBy: [{ eta: "asc" }, { id: "asc" }],
          select: {
            id: true,
            userId: true,
            eta: true,
            user: { select: { displayName: true } },
          },
        },
      },
    });

    return breaks
      .map((surfBreak) => {
        const saved = surfBreak.savedBy[0] ?? null;

        return {
          id: surfBreak.id,
          label: surfBreak.label,
          lat: surfBreak.lat,
          lng: surfBreak.lng,
          isSaved: saved !== null,
          sortOrder: saved?.sortOrder ?? null,
          isHomeBreak: ctx.user.homeBreakId === surfBreak.id,
          isMine: surfBreak.createdById === userId,
          createdByName: surfBreak.createdBy.displayName,
          conditionsVerdict: surfBreak.conditionsVerdict,
          conditionsUpdatedAt: surfBreak.conditionsUpdatedAt,
          rawData: parseRawData(surfBreak.rawData),
          webcamUrl: webcamUrlFor(surfBreak.label),
          checkIns: surfBreak.checkIns.map((checkIn) => ({
            id: checkIn.id,
            displayName: checkIn.user.displayName,
            eta: checkIn.eta,
            isMe: checkIn.userId === userId,
          })),
        };
      })
      // Saved Breaks first, in the order the user arranged them (FR-2); everything else
      // after, oldest first, for the discovery list in the drawer.
      .sort((a, b) => {
        if (a.isSaved !== b.isSaved) return a.isSaved ? -1 : 1;
        if (a.isSaved && b.isSaved) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        return 0;
      });
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
   * FR-3. Only the creator may delete; everyone else uses `unsave` (FR-4b).
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

  /**
   * FR-4b. Saves a Break someone else created into the caller's own stack.
   *
   * Idempotent — saving twice is a no-op rather than a unique-constraint error, because the
   * button can be tapped again before the invalidated `list` query settles.
   *
   * Inherits the first-Break rule from `create` (FR-4a): if this is the only Break the user
   * has, it becomes their Home Break. The dawn patrol push has nowhere to point otherwise.
   */
  save: protectedProcedure
    .input(breakIdSchema)
    .mutation(async ({ ctx, input }) => {
      await assertCrewMember(ctx, input.breakId);

      const userId = ctx.user.id;

      return ctx.db.$transaction(async (tx) => {
        const existing = await tx.userSavedBreak.findUnique({
          where: { userId_breakId: { userId, breakId: input.breakId } },
          select: { breakId: true },
        });

        if (existing) {
          return { id: input.breakId, alreadySaved: true };
        }

        const last = await tx.userSavedBreak.findFirst({
          where: { userId },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });

        await tx.userSavedBreak.create({
          data: {
            userId,
            breakId: input.breakId,
            sortOrder: last ? last.sortOrder + 1 : 0,
          },
        });

        if (last === null) {
          await tx.user.update({
            where: { id: userId },
            data: { homeBreakId: input.breakId },
          });
        }

        return { id: input.breakId, alreadySaved: false };
      });
    }),

  /**
   * FR-4b. Removes a Break from the caller's stack. The `Break` row itself is untouched —
   * everyone else who saved it keeps it.
   *
   * Creators are sent to `break.delete` instead: `crewBreaks` only surfaces Breaks *other*
   * people created, so unsaving your own would drop it out of your stack with no way back.
   *
   * `homeBreakId` is not a foreign key, so an unsaved Home Break has to be cleared by hand
   * here exactly as it is in `delete`, or it dangles at a Break no longer in the stack.
   */
  unsave: protectedProcedure
    .input(breakIdSchema)
    .mutation(async ({ ctx, input }) => {
      const surfBreak = await assertCrewMember(ctx, input.breakId);
      const userId = ctx.user.id;

      if (surfBreak.createdById === userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You created this break — delete it instead of removing it.",
        });
      }

      const saved = await ctx.db.userSavedBreak.findUnique({
        where: { userId_breakId: { userId, breakId: input.breakId } },
        select: { breakId: true },
      });

      if (!saved) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That break is not in your list.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.userSavedBreak.delete({
          where: { userId_breakId: { userId, breakId: input.breakId } },
        }),
        ctx.db.user.updateMany({
          where: { id: userId, homeBreakId: input.breakId },
          data: { homeBreakId: null },
        }),
      ]);

      return { id: input.breakId };
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

/** `Prisma.JsonValue` in, a typed snapshot or `null` out. */
function parseRawData(rawData: unknown) {
  const parsed = conditionsRawDataSchema.safeParse(rawData);
  return parsed.success ? parsed.data : null;
}

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
