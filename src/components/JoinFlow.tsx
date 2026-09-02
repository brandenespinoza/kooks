"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { joinViaInviteAction } from "~/app/join/[inviteToken]/actions";
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
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  function submit(displayName?: string) {
    setSubmitting(true);
    startTransition(async () => {
      const result = await joinViaInviteAction({ inviteToken, displayName });
      if (!result.ok) {
        setSubmitting(false);
        toast.error(result.error);
        return;
      }
      if (result.connectedTo) {
        toast.success(`You're connected with ${result.connectedTo}`);
      }
      // A brand-new account has no passkey yet, and a passkey is the only thing that can
      // return it to a different device later. Straight to enrolment; the gate on `/` would
      // bounce them there anyway, this just saves the hop.
      // replace(), not push() — the invite URL should not sit in the back stack.
      router.replace(result.createdAccount ? "/passkey-setup" : "/");
      router.refresh();
    });
  }

  // Fires once. A ref rather than a dependency list because React StrictMode
  // double-invokes effects in dev, and this one performs a write.
  const autoJoinFired = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || autoJoinFired.current) return;
    autoJoinFired.current = true;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (isAuthenticated) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 px-7 pt-safe pb-safe text-center">
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
      isPending={submitting || isPending}
      onSubmit={(displayName) => submit(displayName)}
    />
  );
}
