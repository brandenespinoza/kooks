import "server-only";

import { TRPCError } from "@trpc/server";

import { type PrismaClient } from "@prisma/client";

type CrewAuthContext = {
  db: PrismaClient;
  user: { id: string } | null;
};

/**
 * Authorizes access to a Break. Call at the top of every procedure that reads or writes
 * break-specific data (enforcement rule 2).
 *
 * Access is granted when the requesting user:
 *   1. created the Break, or
 *   2. shares a direct crew connection with the Break's creator, or
 *   3. has the Break saved to their own list.
 *
 * Rule 3 covers the case where a Break's creator is later removed from your crew but the
 * Break remains in your swipe stack — without it, `break.list` could return Breaks that
 * every subsequent procedure then rejects.
 *
 * Crew connections are stored bidirectionally (a mutual pair is written on join), so a
 * single-direction lookup is sufficient. Friend-of-friend access is never granted (NFR-7).
 *
 * Returns the Break's id and creator so callers do not need to re-query.
 */
export async function assertCrewMember(ctx: CrewAuthContext, breakId: string) {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const surfBreak = await ctx.db.break.findUnique({
    where: { id: breakId },
    select: { id: true, createdById: true },
  });

  if (!surfBreak) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Break not found" });
  }

  if (surfBreak.createdById === ctx.user.id) return surfBreak;

  const [crewLink, saved] = await Promise.all([
    ctx.db.crewMember.findUnique({
      where: {
        userId_friendId: {
          userId: ctx.user.id,
          friendId: surfBreak.createdById,
        },
      },
      select: { userId: true },
    }),
    ctx.db.userSavedBreak.findUnique({
      where: { userId_breakId: { userId: ctx.user.id, breakId } },
      select: { userId: true },
    }),
  ]);

  if (crewLink ?? saved) return surfBreak;

  throw new TRPCError({
    code: "FORBIDDEN",
    message: "You are not connected to this Break's crew",
  });
}

/**
 * The user plus their direct crew — the set whose presence they are allowed to see (NFR-7).
 *
 * Includes the caller, so it can be used directly as an `in` filter without a second
 * condition for "my own check-in". Direct connections only: a friend of a friend is never
 * in this set, which is what stops one crew member's check-in from being visible to another
 * who happens to share a Break but not a connection.
 */
export async function listCrewUserIds(
  db: PrismaClient,
  userId: string,
): Promise<string[]> {
  const crew = await db.crewMember.findMany({
    where: { userId },
    select: { friendId: true },
  });

  return [userId, ...crew.map((member) => member.friendId)];
}

/**
 * Every Break the user is allowed to see, by the same three rules `assertCrewMember`
 * enforces one Break at a time: created by them, created by someone in their crew, or saved
 * to their own list.
 *
 * Used by the SSE stream, which needs the whole set up front — asking `assertCrewMember` per
 * event would be a database round trip per event per open connection.
 */
export async function listVisibleBreakIds(
  db: PrismaClient,
  userId: string,
): Promise<string[]> {
  const [crew, breaks, saved] = await Promise.all([
    db.crewMember.findMany({ where: { userId }, select: { friendId: true } }),
    db.break.findMany({ where: { createdById: userId }, select: { id: true } }),
    db.userSavedBreak.findMany({ where: { userId }, select: { breakId: true } }),
  ]);

  const ids = new Set<string>();
  for (const row of breaks) ids.add(row.id);
  for (const row of saved) ids.add(row.breakId);

  if (crew.length > 0) {
    const crewBreaks = await db.break.findMany({
      where: { createdById: { in: crew.map((member) => member.friendId) } },
      select: { id: true },
    });
    for (const row of crewBreaks) ids.add(row.id);
  }

  return [...ids];
}
