import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { env } from "~/env";

export const notificationRouter = createTRPCRouter({
  /**
   * The VAPID public key, for `pushManager.subscribe`.
   *
   * Served from a procedure rather than a `NEXT_PUBLIC_` variable: it is public by design —
   * it ships to every browser either way — but routing it through tRPC keeps `src/env.js`
   * server-only, so there is exactly one place env vars are declared and no client block to
   * keep in step.
   */
  publicKey: protectedProcedure.query(() => {
    return { publicKey: env.WEB_PUSH_PUBLIC_KEY };
  }),

  /**
   * FR-18. Stores a browser's push subscription.
   *
   * Upsert on `endpoint`, which is unique: a browser hands back the same endpoint when it
   * re-subscribes, and a permission re-grant should update the row rather than collide with
   * it. The `userId` is rewritten too, so a shared device that changes hands does not keep
   * notifying the previous person.
   */
  subscribe: protectedProcedure
    .input(
      z.object({
        endpoint: z.string().url(),
        p256dh: z.string().min(1),
        auth: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const subscription = await ctx.db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          userId: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        update: {
          userId: ctx.user.id,
          p256dh: input.p256dh,
          auth: input.auth,
        },
        select: { id: true },
      });

      return subscription;
    }),

  /**
   * Removes a subscription — used when a browser reports its own is gone, or when someone
   * turns notifications off. Scoped to the caller's own rows so an endpoint cannot be
   * unsubscribed by whoever guesses it.
   */
  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.user.id },
      });

      return { removed: count };
    }),

  /**
   * FR-21. The caller's notification preferences.
   *
   * Falls back to all-on rather than erroring when the row is missing. Every user gets one on
   * join and on seed, so absence means someone deleted it by hand — and the column defaults
   * say all-on, so reporting anything else would misrepresent what the app will actually do.
   */
  prefs: protectedProcedure.query(async ({ ctx }) => {
    const prefs = await ctx.db.notificationPref.findUnique({
      where: { userId: ctx.user.id },
      select: { friendCheckIn: true, nightBefore: true, dawnPatrol: true },
    });

    return prefs ?? { friendCheckIn: true, nightBefore: true, dawnPatrol: true };
  }),

  /**
   * FR-21. Updates one or more preferences.
   *
   * An upsert, so a user whose row is missing gets one written on first toggle rather than
   * a `NOT_FOUND` they can do nothing about. Partial input: the UI sends only what changed.
   */
  updatePrefs: protectedProcedure
    .input(
      z
        .object({
          friendCheckIn: z.boolean(),
          nightBefore: z.boolean(),
          dawnPatrol: z.boolean(),
        })
        .partial()
        .refine((value) => Object.keys(value).length > 0, {
          message: "Nothing to update.",
        }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.notificationPref.upsert({
        where: { userId: ctx.user.id },
        create: { userId: ctx.user.id, ...input },
        update: input,
        select: { friendCheckIn: true, nightBefore: true, dawnPatrol: true },
      });
    }),

  /** Whether this user has any device registered — drives the prompt's state. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.db.pushSubscription.count({
      where: { userId: ctx.user.id },
    });

    return { subscribed: count > 0 };
  }),
});
