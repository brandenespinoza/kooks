"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { OnboardingForm } from "~/components/OnboardingForm";

/**
 * Branches the invite-link flow on auth state.
 *
 * Already signed in -> silently form the crew connection and go home (AC 8), including the
 * self-invite no-op (AC 9). Otherwise -> collect a display name (AC 2).
 */
export function JoinFlow({
  inviteToken,
  inviterName,
  isAuthenticated,
  isSelfInvite,
}: {
  inviteToken: string;
  inviterName: string;
  isAuthenticated: boolean;
  isSelfInvite: boolean;
}) {
  const router = useRouter();

  const join = api.crew.joinViaInvite.useMutation({
    onSuccess: (result) => {
      if (result.connectedTo) {
        toast.success(`You're connected with ${result.connectedTo}`);
      }
      // replace(), not push() — the invite URL should not sit in the back stack.
      router.replace("/");
      router.refresh();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Fires once. A ref rather than a dependency list because React 18 StrictMode
  // double-invokes effects in dev, and this one performs a write.
  const autoJoinFired = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || autoJoinFired.current) return;
    autoJoinFired.current = true;
    join.mutate({ inviteToken });
  }, [isAuthenticated, inviteToken, join]);

  if (isAuthenticated) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-7 text-center">
        <p
          className="text-[16px] font-bold text-text-primary"
          aria-live="polite"
        >
          {isSelfInvite ? "That's your own invite link" : "Connecting you…"}
        </p>
        <p className="text-[13px] text-text-secondary">
          Taking you back to your breaks.
        </p>
      </main>
    );
  }

  return (
    <OnboardingForm
      inviterName={inviterName}
      isPending={join.isPending}
      onSubmit={(displayName) => join.mutate({ inviteToken, displayName })}
    />
  );
}
