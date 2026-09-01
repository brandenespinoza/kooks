"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * ETA wheel (UX spec: `ETAPicker`). 15-minute slots from 5:00am to 10:00am, snapping, with
 * momentum.
 *
 * Native CSS scroll-snap, not a wheel library — the same call `BreakSwipeStack` made for
 * swipe: momentum, rubber-banding and trackpad support come from the platform, and the
 * selected slot falls out of `scrollTop / ITEM_HEIGHT` instead of pointer bookkeeping.
 *
 * Semantics are a radio group with a roving tabindex, so the wheel is operable by keyboard
 * and announces as a single control instead of 21 tab stops.
 */
const START_HOUR = 5;
const END_HOUR = 10;
const STEP_MINUTES = 15;
/** 48, not 44: each slot is a tap target, and NFR-10 sets the floor. */
const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const LIST_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
/** Lets the first and last slot reach the centre band. */
const EDGE_PAD = (LIST_HEIGHT - ITEM_HEIGHT) / 2;

type Slot = { hour: number; minute: number };

export const SLOTS: Slot[] = buildSlots();

function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let hour = START_HOUR; hour <= END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += STEP_MINUTES) {
      if (hour === END_HOUR && minute > 0) break;
      slots.push({ hour, minute });
    }
  }
  return slots;
}

/**
 * The next real moment for a slot: today if it is still ahead, otherwise tomorrow.
 *
 * Without the roll-forward, checking in at 8pm for "5:00am" would resolve to a time fifteen
 * hours in the past and the server would reject it — the one time of day someone is most
 * likely to be planning a dawn patrol.
 */
export function resolveSlot(slot: Slot, now = new Date()): Date {
  const date = new Date(now);
  date.setHours(slot.hour, slot.minute, 0, 0);
  if (date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  return date;
}

/** The slot a fresh drawer opens on: the next one still ahead of the current time. */
export function defaultSlotIndex(now = new Date()): number {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const index = SLOTS.findIndex(
    (slot) => slot.hour * 60 + slot.minute > minutes,
  );
  // Past the window entirely (after 10am) — the next slot is tomorrow's first.
  return index === -1 ? 0 : index;
}

export function formatSlot(slot: Slot): string {
  const date = new Date();
  date.setHours(slot.hour, slot.minute, 0, 0);
  return date
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}

export function ETAPicker({
  selectedIndex,
  onSelect,
}: {
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({
      top: index * ITEM_HEIGHT,
      behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
    });
  }, []);

  // Open on the selected slot without animating into it.
  useEffect(() => {
    scrollToIndex(selectedIndex, false);
    // Mount only: afterwards the scroll position is the user's to drive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    };
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    // Snap lands the scroll on a multiple of ITEM_HEIGHT; rounding mid-flight would fire a
    // selection for every slot the wheel passes, so this waits for it to settle.
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const index = Math.round(el.scrollTop / ITEM_HEIGHT);
      onSelect(Math.max(0, Math.min(index, SLOTS.length - 1)));
    }, 80);
  }, [onSelect]);

  function move(delta: number) {
    const next = Math.max(0, Math.min(selectedIndex + delta, SLOTS.length - 1));
    if (next === selectedIndex) return;
    onSelect(next);
    scrollToIndex(next, true);
  }

  return (
    <div className="relative" style={{ height: LIST_HEIGHT }}>
      {/* The centre band is the selection indicator; it must never eat a tap. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl border-y border-divider bg-bg"
        style={{ height: ITEM_HEIGHT }}
        aria-hidden="true"
      />

      <div
        ref={listRef}
        onScroll={handleScroll}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            move(-1);
          }
        }}
        role="radiogroup"
        aria-label="Arrival time"
        className="swipe-stack relative h-full snap-y snap-mandatory overflow-y-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-action"
      >
        <div style={{ height: EDGE_PAD }} aria-hidden="true" />
        {SLOTS.map((slot, index) => {
          const selected = index === selectedIndex;
          return (
            <button
              key={`${slot.hour}:${slot.minute}`}
              type="button"
              role="radio"
              aria-checked={selected}
              // Roving tabindex: one stop for the whole wheel, arrows move within it.
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                onSelect(index);
                scrollToIndex(index, true);
              }}
              style={{ height: ITEM_HEIGHT }}
              className={`flex w-full snap-center items-center justify-center text-[18px] tabular-nums transition-colors ${
                selected
                  ? "font-bold text-text-primary"
                  : "font-normal text-text-secondary"
              }`}
            >
              {formatSlot(slot)}
            </button>
          );
        })}
        <div style={{ height: EDGE_PAD }} aria-hidden="true" />
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
