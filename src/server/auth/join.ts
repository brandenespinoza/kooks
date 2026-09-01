import "server-only";

import { type PrismaClient } from "@prisma/client";

import { db } from "~/server/db";
import { createSession } from "~/server/auth/session";
import { emitter, type PresenceEvent } from "~/server/events";

export type JoinResult =
  | { ok: true; createdAccount: boolean; connectedTo: string | null; token: string | null }
  | { ok: false; error: string };

/**
 * Writes the bidirectional crew pair. Storing both directions keeps every read a single
 * indexed lookup instead of an OR across two columns.
 *
 * `createMany` + `skipDuplicates` makes re-tapping a link a no-op rather than an error.
 */
async function connectCrew(tx: PrismaClient, userId: string, friendId: string) {
  if (userId === friendId) return;

  const { count } = await tx.crewMember.createMany({
    data: [
      { userId, friendId },
      { userId: friendId, friendId: userId },
    ],
    skipDuplicates: true,
  });

  // Only when the pair is genuinely new — re-tapping a link should not wake every open
  // screen. Both parties' streams widen their visible set on this and refetch, so a new
  // crew member's Breaks and check-ins appear without a refresh (FR-16).
  if (count > 0) {
    const event: PresenceEvent = {
      type: "crew.joined",
      breakId: null,
      payload: { userIds: [userId, friendId] },
    };
    emitter.emit(event.type, event);
  }
}

/**
 * The sole account-creation path (FR-22). Transport-agnostic: returns the session token
 * for the caller to set as a cookie, rather than setting one itself.
 *
 * Three cases:
 *   - not signed in + valid token -> create User, NotificationPref, Session, crew pair
 *   - signed in + someone else's token -> crew pair only
 *   - signed in + own token -> no-op
 */
export async function joinViaInvite({
  inviteToken,
  displayName,
  currentUserId,
}: {
  inviteToken: string;
  displayName?: string;
  currentUserId: string | null;
}): Promise<JoinResult> {
  const inviter = await db.user.findUnique({
    where: { inviteToken },
    select: { id: true, displayName: true },
  });

  if (!inviter) return { ok: false, error: "This invite link is not valid." };

  if (currentUserId) {
    await connectCrew(db, currentUserId, inviter.id);
    return {
      ok: true,
      createdAccount: false,
      connectedTo: currentUserId === inviter.id ? null : inviter.displayName,
      token: null,
    };
  }

  const name = displayName?.trim();
  if (!name) return { ok: false, error: "A display name is required." };
  if (name.length > 50) return { ok: false, error: "That name is a bit long." };

  const user = await db.user.create({
    data: {
      displayName: name,
      // All three notification types default to true (Story 6.4 AC).
      notificationPrefs: { create: {} },
    },
    select: { id: true },
  });

  await connectCrew(db, user.id, inviter.id);
  const session = await createSession(user.id);

  return {
    ok: true,
    createdAccount: true,
    connectedTo: inviter.displayName,
    token: session.token,
  };
}
