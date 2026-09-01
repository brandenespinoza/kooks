import { SwipeDots } from "~/components/SwipeDots";

/**
 * Navy top zone of the D3 Verdict Band layout (UX-DR1).
 *
 * Purely presentational — all data arrives as props from BreakScreen; nothing below
 * BreakScreen makes tRPC calls.
 *
 * The band paints behind the iOS status bar, so it owns the top safe-area inset rather
 * than the app shell. `max()` keeps a sensible 56px clearance on desktop where the inset
 * resolves to 0, without stacking 56px on top of a real notch inset on device.
 *
 * Colour note: the UX spec assigns `--text-secondary` to the break name, but that is
 * 2.93:1 on navy and fails WCAG AA (NFR-9). `action-fg` at 70% composites to 5.88:1 and
 * carries the same muted intent, so it is used for all secondary text on this band.
 */
export function VerdictBand({
  label,
  verdict,
  isLoading,
  breakCount,
  activeIndex,
  isHomeBreak = false,
}: {
  label: string;
  verdict: string | null;
  isLoading: boolean;
  breakCount: number;
  activeIndex: number;
  isHomeBreak?: boolean;
}) {
  return (
    <header className="bg-action px-7 pt-[max(3.5rem,calc(env(safe-area-inset-top)+1rem))] pb-9">
      <div className="flex items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-2 text-[11px] font-normal uppercase tracking-[0.14em] text-action-fg/70">
          <span className="truncate">{label}</span>
          {/* FR-4a: the Home Break is distinguished by a word, not by colour alone. */}
          {isHomeBreak && (
            <span className="shrink-0 rounded-full border border-action-fg/30 px-1.5 py-0.5 text-[9px] leading-none text-action-fg/70">
              Home
            </span>
          )}
        </p>
        <SwipeDots count={breakCount} activeIndex={activeIndex} />
      </div>

      {/* aria-live so a verdict refresh is announced without interrupting (UX-DR14) */}
      <div className="mt-4 min-h-[68px]" aria-live="polite">
        {isLoading ? (
          <VerdictSkeleton />
        ) : verdict ? (
          <p className="text-[28px] font-bold leading-[1.18] tracking-tight text-action-fg">
            {verdict}
          </p>
        ) : (
          <p className="text-[15px] font-normal leading-[1.4] text-action-fg/70">
            No conditions yet — the forecast starts flowing in Epic 3.
          </p>
        )}
      </div>
    </header>
  );
}

/** Two lines, matching the verdict's rhythm. Never a spinner (UX-DR8). */
function VerdictSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-[22px] w-11/12 animate-pulse rounded bg-action-fg/15" />
      <div className="h-[22px] w-2/3 animate-pulse rounded bg-action-fg/15" />
    </div>
  );
}
