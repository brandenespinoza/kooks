import type { Metadata } from "next";

import { PasskeySignInButton } from "~/components/PasskeySignInButton";

export const metadata: Metadata = {
  title: "Kooks — Invite only",
};

/**
 * Where middleware sends unauthenticated visitors. Deliberately contains no sign-up form and
 * no path to one (FR-22) — the only way to *create* an account is an invite link from
 * someone's crew.
 *
 * The passkey button below is not a second door into that. It cannot create anything: it
 * resolves an existing credential to the account that already owns it, which is what makes
 * a new phone recoverable at all. Without it, the only affordance on this page is the invite
 * link — and tapping your own while signed out forks you into a duplicate account.
 */
export default function JoinRequiredPage() {
  return (
    <main className="flex flex-1 flex-col justify-center px-7 pt-safe pb-safe">
      <p className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        Kooks
      </p>

      <h1 className="mt-2 text-[28px] font-bold leading-[1.18] tracking-tight text-text-primary">
        You need an invite.
      </h1>

      <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">
        Kooks is invite-only. Ask someone in your crew to send you their invite
        link — tapping it is all it takes to get in.
      </p>

      <PasskeySignInButton />
    </main>
  );
}
