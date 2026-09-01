"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RouterOutputs } from "~/trpc/react";
import { api } from "~/trpc/react";
import { usePresenceStream } from "~/lib/use-presence-stream";
import { BreakScreen } from "~/components/BreakScreen";
import { EmptyBreaksState } from "~/components/EmptyBreaksState";
import { AddBreakDrawer } from "~/components/AddBreakDrawer";
import { CheckInDrawer } from "~/components/CheckInDrawer";

export type SavedBreak = RouterOutputs["break"]["list"][number];

/**
 * Horizontal swipe container between Break screens (FR-2, UX-DR9).
 *
 * Owns `break.list`, the active index and both drawers. It is the only component in this
 * subtree that talks to tRPC — everything below it, `BreakScreen` included, is
 * presentational and receives its data as props. (architecture.md puts the query one level
 * lower, in each `BreakScreen`; that would be N queries for data that arrives in one list.)
 *
 * The gesture is native scroll-snap rather than a gesture library: momentum, rubber-banding
 * and trackpad support come from the platform for free, and `activeIndex` falls out of
 * `scrollLeft / clientWidth` instead of being tracked through pointer events. The URL never
 * changes — there is no route per Break.
 */
export function BreakSwipeStack() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  /**
   * Where focus goes when a drawer closes.
   *
   * vaul traps focus while open but restores it to the `DrawerTrigger` — and these drawers
   * are opened from state, so there is no trigger and focus lands on `<body>`. A keyboard or
   * screen-reader user who closed the check-in sheet would be dropped at the top of the
   * document, which is the accessibility AC this story has to satisfy.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // isPending, never a hand-rolled loading useState.
  const utils = api.useUtils();
  const breaks = api.break.list.useQuery(undefined, {
    // Presence arrives over SSE and conditions are written by a job; nothing to poll for.
    refetchOnWindowFocus: true,
  });

  // FR-11. One connection for the whole stack, not one per panel — every panel is mounted at
  // once, and a browser allows about six connections per origin. The event is only a signal;
  // the data comes back through `break.list`, which is already authorized.
  usePresenceStream(
    useCallback(() => {
      void utils.break.list.invalidate();
    }, [utils]),
  );

  // FR-2/FR-4b: the stack is the user's *saved* Breaks. Story 5.2 widened `break.list` to
  // every visible Break so the drawer's discovery list shares this query — `isSaved` is
  // what separates the two.
  const stack = breaks.data?.filter((surfBreak) => surfBreak.isSaved) ?? [];
  const unsavedCrewBreaks =
    breaks.data?.filter((surfBreak) => !surfBreak.isSaved) ?? [];
  const count = stack.length;

  // A delete or unsave can shrink the stack out from under the active index. The browser
  // clamps scrollLeft on its own, but the dots would otherwise point past the end.
  useEffect(() => {
    if (count > 0 && activeIndex > count - 1) {
      setActiveIndex(count - 1);
    }
  }, [count, activeIndex]);

  const openDrawer = useCallback((open: (value: true) => void) => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open(true);
  }, []);

  // After the drawer unmounts, not during: focusing while vaul is still tearing down its
  // focus guards gets overridden. One frame is enough.
  const anyDrawerOpen = checkInOpen || addOpen;
  useEffect(() => {
    if (anyDrawerOpen) return;
    const element = returnFocusRef.current;
    if (!element) return;

    const frame = requestAnimationFrame(() => element.focus());
    return () => cancelAnimationFrame(frame);
  }, [anyDrawerOpen]);

  const handleScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    // React bails out on an identical value, so this is safe to call on every scroll tick.
    setActiveIndex(Math.max(0, Math.min(index, el.children.length - 1)));
  }, []);

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    // UX-DR12: the gesture itself is user-driven and has nothing to animate, but this
    // programmatic jump does. The CSS below disables smooth scrolling too, so the AC holds
    // either way.
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  if (breaks.isPending) {
    return (
      <BreakScreen
        surfBreak={null}
        isLoading
        breakCount={0}
        activeIndex={0}
      />
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

  if (count === 0) {
    return (
      <>
        <EmptyBreaksState
          onAddBreak={() => setAddOpen(true)}
          crewBreakCount={unsavedCrewBreaks.length}
        />
        {addOpen && <AddBreakDrawer open onOpenChange={setAddOpen} />}
      </>
    );
  }

  const active = stack[Math.min(activeIndex, count - 1)]!;

  return (
    <>
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" && activeIndex < count - 1) {
            event.preventDefault();
            scrollToIndex(activeIndex + 1);
          } else if (event.key === "ArrowLeft" && activeIndex > 0) {
            event.preventDefault();
            scrollToIndex(activeIndex - 1);
          }
        }}
        // A scrollable region has to be keyboard-reachable; the dots stay decorative
        // (the UX spec calls them an indicator, and 48px per dot will not fit beside the
        // break label), so the arrow keys are the non-touch way through the stack.
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Your breaks"
        className="swipe-stack flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action"
      >
        {stack.map((surfBreak, index) => (
          <div
            key={surfBreak.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${surfBreak.label}, break ${index + 1} of ${count}`}
            className="flex w-full shrink-0 snap-center flex-col"
          >
            <BreakScreen
              surfBreak={surfBreak}
              breakCount={count}
              activeIndex={activeIndex}
              onCheckIn={() => openDrawer(setCheckInOpen)}
              onAddBreak={() => openDrawer(setAddOpen)}
            />
          </div>
        ))}
      </div>

      {/* One announcement for the whole stack. Every panel is mounted at once, so putting
          this inside VerdictBand would render it `count` times over. */}
      <p className="sr-only" aria-live="polite">
        {active.label}, break {activeIndex + 1} of {count}
      </p>

      {/* Mount only the drawer that is open. Two vaul roots in the same tree fight over
          pointer handling — the idle one dismisses the active one on the first interaction
          inside it, which silently closed the Add drawer the moment you tapped the map. */}
      {addOpen && <AddBreakDrawer open onOpenChange={setAddOpen} />}
      {checkInOpen && (
        <CheckInDrawer
          open
          onOpenChange={setCheckInOpen}
          breakId={active.id}
          breakLabel={active.label}
          currentEta={active.checkIns.find((checkIn) => checkIn.isMe)?.eta ?? null}
          movingFrom={
            stack.find(
              (surfBreak) =>
                surfBreak.id !== active.id &&
                surfBreak.checkIns.some((checkIn) => checkIn.isMe),
            )?.label ?? null
          }
        />
      )}
    </>
  );
}
