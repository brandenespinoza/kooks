import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Primary tRPC router for Kooks.
 * Routers are added here as they are implemented in each epic.
 */
export const appRouter = createTRPCRouter({});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
