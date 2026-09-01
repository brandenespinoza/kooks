"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "~/components/ui/drawer";
import {
  ETAPicker,
  SLOTS,
  defaultSlotIndex,
  formatSlot,
  resolveSlot,
} from "~/components/ETAPicker";

/**
 * Check-in bottom sheet (FR-10) — the only multi-input moment in the primary flow.
 *
 * vaul supplies the drag handle, the swipe-to-dismiss, ESC and the focus trap, so the
 * accessibility ACs are the primitive's job rather than hand-rolled here.
 *
 * Mounted only while open (`BreakSwipeStack` does the conditional): two vaul roots in one
 * tree fight over pointer handling, which is what silently broke the Add drawer in 2.2.
 *
 * The Remove link belongs in this sheet too, but it arrives with `checkIn.remove` in Story
 * 4.3 rather than shipping here as a control that cannot do anything.
 */
export function CheckInDrawer({
  open,
  onOpenChange,
  breakId,
  breakLabel,
  currentEta,
  movingFrom,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakId: string;
  breakLabel: string;
  /** Set when editing an existing check-in at this Break. */
  currentEta: Date | null;
  /** Label of the Break this check-in would move away from, if any. */
  movingFrom: string | null;
}) {
  const [index, setIndex] = useState(() => initialIndex(currentEta));

  const utils = api.useUtils();

  const close = async (message: string) => {
    await utils.break.list.invalidate();
    toast.success(message);
    onOpenChange(false);
  };

  const create = api.checkIn.create.useMutation({
    onSuccess: () => close(`You're in at ${formatSlot(SLOTS[index]!)}`),
    onError: (error) => toast.error(error.message),
  });

  // FR-11. Editing goes through `update`, which refuses to create: reaching this drawer with
  // no row left means the check-in expired or was removed on another device, and quietly
  // recreating it would put someone back on a beach they had already left.
  const update = api.checkIn.update.useMutation({
    onSuccess: () => close(`Updated to ${formatSlot(SLOTS[index]!)}`),
    onError: (error) => toast.error(error.message),
  });

  // FR-12.
  const remove = api.checkIn.remove.useMutation({
    onSuccess: () => close("Check-in removed"),
    onError: (error) => toast.error(error.message),
  });

  const editing = currentEta !== null;
  const pending = create.isPending || update.isPending || remove.isPending;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-surface">
        <DrawerHeader className="px-7">
          <DrawerTitle className="text-[16px] font-bold text-text-primary">
            {breakLabel}
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-text-secondary">
            {currentEta
              ? "Change when you're getting there."
              : "What time are you getting there?"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-7 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          <ETAPicker selectedIndex={index} onSelect={setIndex} />

          {/* FR-10 allows one active check-in. Moving one is reasonable; doing it without
              saying so is not. */}
          {movingFrom && (
            <p className="mt-3 text-[13px] font-normal text-text-secondary">
              This moves your check-in from {movingFrom}.
            </p>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (pending) return;
              const eta = resolveSlot(SLOTS[index]!);
              if (editing) {
                update.mutate({ eta });
              } else {
                create.mutate({ breakId, eta });
              }
            }}
            className="mt-6 min-h-[48px] w-full rounded-2xl bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity active:opacity-90 disabled:opacity-50"
          >
            {create.isPending || update.isPending
              ? "Saving…"
              : `${editing ? "Update" : "I'm in"} — ${formatSlot(SLOTS[index]!)}`}
          </button>

          {/* FR-12. Edit mode only, and a text link rather than a button: cancelling is a
              retreat, not the action this sheet is here for. No confirmation step — the
              cost of a mistap is one more check-in, and a second overlay inside a vaul
              drawer is the pattern that broke the Add flow in 2.2. */}
          {editing && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (pending) return;
                remove.mutate();
              }}
              className="mt-2 min-h-[48px] w-full text-[13px] font-normal text-text-secondary underline underline-offset-4 disabled:opacity-50"
            >
              {remove.isPending ? "Removing…" : "Remove check-in"}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/**
 * Editing opens on the slot already chosen; a new check-in opens on the next slot ahead of
 * now. An existing ETA that is not on the 15-minute grid (only reachable by an older client
 * or a hand-written row) falls back to the default rather than silently snapping.
 */
function initialIndex(currentEta: Date | null): number {
  if (!currentEta) return defaultSlotIndex();

  const found = SLOTS.findIndex(
    (slot) =>
      slot.hour === currentEta.getHours() &&
      slot.minute === currentEta.getMinutes(),
  );
  return found === -1 ? defaultSlotIndex() : found;
}
