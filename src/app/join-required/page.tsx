import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kooks — Invite only",
};

/**
 * Where middleware sends unauthenticated visitors. Deliberately contains no sign-up form
 * and no path to one (FR-22) — the only way in is an invite link from someone's crew.
 */
export default function JoinRequiredPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center px-7">
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
    </main>
  );
}
