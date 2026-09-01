"use client";

import Link from "next/link";

/**
 * Shown when the user has no saved Breaks (Story 2.1 AC 5).
 *
 * Every empty state carries an action — never a dead end. The CTA's handler is wired to
 * the pin-drop map flow in Story 2.2.
 *
 * Not in architecture.md's component list; added because "no breaks saved" is a distinct
 * full-screen state that has nowhere sensible to live inside the two-zone layout.
 */
export function EmptyBreaksState({
  onAddBreak,
  crewBreakCount = 0,
}: {
  onAddBreak: () => void;
  /** Unsaved Breaks the caller's crew created — 0 hides the secondary route entirely. */
  crewBreakCount?: number;
}) {

  return (
    <main className="flex flex-1 flex-col justify-center px-7 pt-[max(3.5rem,calc(env(safe-area-inset-top)+1rem))] pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      <p className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        No breaks yet
      </p>

      <h1 className="mt-2 text-[28px] font-bold leading-[1.18] tracking-tight text-text-primary">
        Add your first break.
      </h1>

      <p className="mt-4 text-[13px] font-normal leading-relaxed text-text-secondary">
        Drop a pin on the spot you surf. Your crew sees it straight away, and
        conditions start showing up here.
      </p>

      <button
        type="button"
        onClick={onAddBreak}
        className="mt-8 min-h-[48px] w-full rounded-2xl bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity active:opacity-90"
      >
        Add a break
      </button>

      {/* Someone who just joined a crew has no Breaks of their own but usually has several
          to save. Without this the only route to them is a drawer reachable from the
          CrewZone header, which this state replaces — a dead end for exactly the person the
          invite flow just brought in. */}
      {crewBreakCount > 0 && (
        <Link
          href="/settings"
          className="mt-3 grid min-h-[48px] w-full place-items-center rounded-2xl border border-divider px-4 text-[16px] font-bold text-text-primary transition-opacity active:opacity-90"
        >
          {crewBreakCount === 1
            ? "See your crew\u2019s 1 break"
            : `See your crew\u2019s ${crewBreakCount} breaks`}
        </Link>
      )}
    </main>
  );
}
