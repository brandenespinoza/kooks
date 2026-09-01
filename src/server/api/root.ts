import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { crewRouter } from "~/server/api/routers/crew-router";
import { breakRouter } from "~/server/api/routers/break-router";

/**
 * Primary tRPC router for Kooks.
 * Routers are added here as they are implemented in each epic.
 */
export const appRouter = createTRPCRouter({
  crew: crewRouter,
  break: breakRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
