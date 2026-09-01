"use client";

import { formatEta } from "~/components/CrewMemberRow";

/**
 * The primary action of the whole app (FR-10) — one tap to declare you are going.
 *
 * Two states, and the checked-in one is deliberately quieter: once you are in, the button
 * has done its job and should stop shouting. It keeps the same tap target either way so the
 * transition does not move anything underneath it.
 */
export function CheckInCTA({
  eta,
  onOpen,
}: {
  eta: Date | null;
  onOpen: () => void;
}) {
  const checkedIn = eta !== null;

  return (
    <button
      type="button"
      onClick={onOpen}
      // UX-DR12: the scale is the "satisfying action" feedback. `motion-reduce` states the
      // requirement on the element instead of relying on the global duration clamp — the
      // state change is then genuinely instant, which is what the AC asks for.
      className={`min-h-[48px] w-full rounded-2xl px-4 text-[16px] font-bold transition-transform active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 ${
        checkedIn
          ? "border border-present bg-surface text-text-primary"
          : "bg-action text-action-fg"
      }`}
    >
      {checkedIn ? (
        <span>
          <span aria-hidden="true">✓ </span>
          You&rsquo;re in at {formatEta(eta)}
          <span className="text-text-secondary"> · Edit</span>
        </span>
      ) : (
        <span>I&rsquo;m in</span>
      )}
    </button>
  );
}
