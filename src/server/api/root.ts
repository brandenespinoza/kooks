import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { crewRouter } from "~/server/api/routers/crew-router";

/**
 * Primary tRPC router for Kooks.
 * Routers are added here as they are implemented in each epic.
 */
export const appRouter = createTRPCRouter({
  crew: crewRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
