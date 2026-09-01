
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

/**
 * Onboarding is NOT here. `joinViaInvite` lives in the Server Action at
 * `src/app/join/[inviteToken]/actions.ts` because it must set a session cookie, which a
 * tRPC procedure cannot do over this app's streaming transport — see that file.
 *
 * Story 5.1 adds `getInviteLink`; 5.3 adds `remove`.
 */
export const crewRouter = createTRPCRouter({
  /** Smallest possible proof that the session cookie resolves to a user (AC 4, AC 6). */
  me: protectedProcedure.query(({ ctx }) => {
    return {
      id: ctx.user.id,
      displayName: ctx.user.displayName,
      homeBreakId: ctx.user.homeBreakId,
    };
  }),
});
