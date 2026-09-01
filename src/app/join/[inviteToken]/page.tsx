import { notFound } from "next/navigation";

import { db } from "~/server/db";
import { getSessionFromHeaders } from "~/server/auth/session";
import { headers } from "next/headers";
import { JoinFlow } from "~/components/JoinFlow";

export const dynamic = "force-dynamic";

/**
 * The only account-creation entry point (FR-22). The token is validated server-side before
 * anything renders, so an unknown token yields a 404 and never a sign-up form.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;

  const inviter = await db.user.findUnique({
    where: { inviteToken },
    select: { id: true, displayName: true },
  });

  if (!inviter) notFound();

  const session = await getSessionFromHeaders(new Headers(await headers()));

  return (
    <JoinFlow
      inviteToken={inviteToken}
      inviterName={inviter.displayName}
      isAuthenticated={session !== null}
      isSelfInvite={session?.userId === inviter.id}
    />
  );
}
