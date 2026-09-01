import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const breakRouter = createTRPCRouter({
  /**
   * The Breaks in the user's own swipe stack, in their saved order.
   *
   * No `assertCrewMember` here: this reads the caller's own `UserSavedBreak` rows rather
   * than a specific Break, so there is no break-scoped resource to authorize (rule 2).
   *
   * Story 2.2 adds creation, 2.3 adds reordering, and 5.2 widens visibility to Breaks
   * created by crew members.
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
            conditionsVerdict: true,
            conditionsUpdatedAt: true,
          },
        },
      },
    });

    return saved.map(({ break: surfBreak, sortOrder }) => ({
      id: surfBreak.id,
      label: surfBreak.label,
      conditionsVerdict: surfBreak.conditionsVerdict,
      conditionsUpdatedAt: surfBreak.conditionsUpdatedAt,
      sortOrder,
      isHomeBreak: ctx.user.homeBreakId === surfBreak.id,
    }));
  }),
});
