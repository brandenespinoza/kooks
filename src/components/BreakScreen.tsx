"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { VerdictBand } from "~/components/VerdictBand";
import { CrewZone } from "~/components/CrewZone";
import { EmptyBreaksState } from "~/components/EmptyBreaksState";

/**
 * Full-viewport root for the D3 Verdict Band layout (UX-DR1).
 *
 * The only component in this subtree that talks to tRPC — VerdictBand and CrewZone are
 * presentational and receive everything as props.
 *
 * Story 2.3 lifts the active-break index into a BreakSwipeStack that renders one
 * BreakScreen per saved Break; for now the index is local and fixed at 0.
 */
export function BreakScreen() {
  const [activeIndex] = useState(0);

  // isPending, never a hand-rolled loading useState.
  const breaks = api.break.list.useQuery(undefined, {
    // Presence and conditions arrive via SSE/jobs later; no need to poll here.
    refetchOnWindowFocus: true,
  });

  if (breaks.isPending) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <VerdictBand
          label=" "
          verdict={null}
          isLoading
          breakCount={0}
          activeIndex={0}
        />
        <CrewZone isLoading updatedAt={null} />
      </div>
    );
  }

  if (breaks.isError) {
    return (
      <main className="flex flex-1 flex-col justify-center px-7">
        <p className="text-[16px] font-bold text-text-primary">
          Couldn&rsquo;t load your breaks.
        </p>
        <p className="mt-2 text-[13px] text-text-secondary">
          {breaks.error.message}
        </p>
      </main>
    );
  }

  if (breaks.data.length === 0) {
    return (
      <EmptyBreaksState
        onAddBreak={() =>
          toast("Adding breaks arrives with the map flow in the next story.")
        }
      />
    );
  }

  const active = breaks.data[Math.min(activeIndex, breaks.data.length - 1)]!;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <VerdictBand
        label={active.label}
        verdict={active.conditionsVerdict}
        isLoading={false}
        breakCount={breaks.data.length}
        activeIndex={activeIndex}
      />
      <CrewZone isLoading={false} updatedAt={active.conditionsUpdatedAt} />
    </div>
  );
}
