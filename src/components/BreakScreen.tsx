import type { SavedBreak } from "~/components/BreakSwipeStack";
import { VerdictBand } from "~/components/VerdictBand";
import { CrewZone } from "~/components/CrewZone";

/**
 * One Break's panel in the D3 Verdict Band layout (UX-DR1) — a navy `VerdictBand` over a
 * parchment `CrewZone`, filling the viewport with no scroll.
 *
 * Presentational. `BreakSwipeStack` renders one of these per saved Break and owns the
 * query, the active index and the drawers; nothing from here down calls tRPC.
 *
 * `surfBreak` is null only in the loading state, where the two zones render skeletons.
 */
export function BreakScreen({
  surfBreak,
  isLoading = false,
  breakCount,
  activeIndex,
  onCheckIn,
  onAddBreak,
}: {
  surfBreak: SavedBreak | null;
  isLoading?: boolean;
  breakCount: number;
  activeIndex: number;
  onCheckIn?: () => void;
  onAddBreak?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <VerdictBand
        label={surfBreak?.label ?? " "}
        verdict={surfBreak?.conditionsVerdict ?? null}
        rawData={surfBreak?.rawData ?? null}
        webcamUrl={surfBreak?.webcamUrl ?? null}
        isLoading={isLoading}
        breakCount={breakCount}
        activeIndex={activeIndex}
        isHomeBreak={surfBreak?.isHomeBreak ?? false}
      />
      <CrewZone
        isLoading={isLoading}
        updatedAt={surfBreak?.conditionsUpdatedAt ?? null}
        checkIns={surfBreak?.checkIns ?? []}
        onCheckIn={onCheckIn}
        onAddBreak={onAddBreak}
      />
    </div>
  );
}
