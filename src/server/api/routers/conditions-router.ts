import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { assertCrewMember } from "~/server/auth/assert-crew-member";
import { conditionsRawDataSchema } from "~/lib/swellcloud";

export const conditionsRouter = createTRPCRouter({
  /**
   * FR-7. Reads the conditions cached on the `Break` row by the `poll-conditions` job.
   *
   * Never calls SwellCloud: a page load must not depend on a third-party API being up, and
   * the poll already guarantees the data is no more than 30 minutes old.
   *
   * `break.list` already carries the verdict and timestamp for the whole swipe stack in one
   * query, so nothing calls this yet — Story 3.3's `RawDataPanel` does, lazily, for the one
   * Break whose panel is expanded.
   */
  getForBreak: protectedProcedure
    .input(z.object({ breakId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertCrewMember(ctx, input.breakId);

      const surfBreak = await ctx.db.break.findUnique({
        where: { id: input.breakId },
        select: {
          id: true,
          conditionsVerdict: true,
          rawData: true,
          conditionsUpdatedAt: true,
        },
      });

      if (!surfBreak) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Break not found" });
      }

      // Re-validated on read, not trusted: `rawData` is an untyped Json column, and a row
      // written before a shape change would otherwise reach the client as garbage. A row
      // that no longer parses reads as "no data yet" and the next poll overwrites it.
      const parsed = conditionsRawDataSchema.safeParse(surfBreak.rawData);

      return {
        breakId: surfBreak.id,
        verdict: surfBreak.conditionsVerdict,
        rawData: parsed.success ? parsed.data : null,
        updatedAt: surfBreak.conditionsUpdatedAt,
      };
    }),
});
