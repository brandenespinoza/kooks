/**
 * Break position indicator, rendered inside the VerdictBand (UX-DR9).
 *
 * Decorative and hidden from assistive tech — the URL does not change on swipe, so there is
 * nothing to navigate to and nothing to label. `BreakSwipeStack` announces the position
 * once in a live region instead; every panel is mounted at the same time, so an
 * announcement in here would be rendered once per Break.
 */
export function SwipeDots({
  count,
  activeIndex,
}: {
  count: number;
  activeIndex: number;
}) {
  if (count < 2) return null;

  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={
            i === activeIndex
              ? "size-1.5 rounded-full bg-action-fg"
              : "size-1.5 rounded-full bg-action-fg/20"
          }
        />
      ))}
    </div>
  );
}
