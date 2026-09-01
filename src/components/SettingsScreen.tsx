"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { signOutAction } from "~/app/settings/actions";
import { SettingsBreaks } from "~/components/SettingsBreaks";
import { SettingsCrew } from "~/components/SettingsCrew";
import { SettingsInvite } from "~/components/SettingsInvite";
import { SettingsNotifications } from "~/components/SettingsNotifications";

/**
 * FR-17. Everything that is not the Break screen, in one place.
 *
 * This screen owns its own safe-area insets: `layout.tsx` deliberately has none so the navy
 * `VerdictBand` can paint behind the iOS status bar (UX-DR1), which means every top-level
 * page has to declare its own.
 *
 * Story 5.1's `InviteDrawer` and Story 2.2's `BreaksDrawer` are both gone — their contents
 * are the Invite and Breaks sections here. Two surfaces offering the same mutations is the
 * duplication this screen exists to end.
 */
export function SettingsScreen() {
  return (
    <main className="flex flex-1 flex-col px-7 pt-safe pb-safe">
      <header className="flex items-center gap-1 pt-4">
        <Link
          href="/"
          aria-label="Back to your breaks"
          className="-ml-3 grid size-12 shrink-0 place-items-center rounded-full"
        >
          <ChevronLeft className="size-5 text-text-secondary" aria-hidden="true" />
        </Link>
        <h1 className="text-[16px] font-bold text-text-primary">Settings</h1>
      </header>

      <div className="flex-1 pb-8">
        <Section title="Breaks">
          <SettingsBreaks />
        </Section>

        <Section title="Crew">
          <SettingsCrew />
        </Section>

        <Section title="Notifications">
          <SettingsNotifications />
        </Section>

        <Section title="Invite link">
          <SettingsInvite />
        </Section>

        <Section title="Account">
          {/* A Server Action, not a mutation: this app's tRPC transport cannot clear a
              cookie. A plain form means it also works with JavaScript disabled. */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="min-h-[48px] w-full rounded-2xl border border-divider px-4 text-[16px] font-bold text-destructive"
            >
              Sign out
            </button>
          </form>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
