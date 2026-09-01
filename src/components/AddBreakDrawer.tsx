"use client";

import dynamic from "next/dynamic";
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

// Leaflet reads `window` at import time, so it can never render on the server.
const BreakMap = dynamic(() => import("~/components/BreakMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-surface" aria-hidden="true" />
  ),
});

/** FR-1: drop a pin, name it, and it lands in your swipe stack. */
export function AddBreakDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState("");
  const [attempted, setAttempted] = useState(false);

  const utils = api.useUtils();
  const create = api.break.create.useMutation({
    onSuccess: async (created) => {
      await utils.break.list.invalidate();
      toast.success(`${created.label} added`);
      reset();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  function reset() {
    setPin(null);
    setLabel("");
    setAttempted(false);
  }

  const trimmed = label.trim();
  const missingPin = pin === null;
  const missingLabel = trimmed.length === 0;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DrawerContent className="bg-surface">
        <DrawerHeader className="px-7">
          <DrawerTitle className="text-[16px] font-bold text-text-primary">
            Add a break
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-text-secondary">
            Tap the map where you surf, then give it a name.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-7 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          <div className="h-56 w-full overflow-hidden rounded-2xl border border-divider">
            <BreakMap pin={pin} onPick={(lat, lng) => setPin({ lat, lng })} />
          </div>

          <p
            className="mt-2 text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary"
            aria-live="polite"
          >
            {pin
              ? `Pin at ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
              : "No pin yet — tap the map"}
          </p>

          <label
            htmlFor="breakLabel"
            className="mt-5 block text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary"
          >
            Name
          </label>
          <input
            id="breakLabel"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            enterKeyHint="done"
            aria-invalid={attempted && missingLabel}
            className="mt-2 min-h-[48px] w-full rounded-lg border border-divider bg-bg px-4 text-[16px] font-bold text-text-primary outline-none focus-visible:border-action focus-visible:ring-3 focus-visible:ring-action/20"
          />

          {attempted && (missingPin || missingLabel) && (
            <p className="mt-2 text-[13px] text-destructive">
              {missingPin
                ? "Tap the map to drop a pin first."
                : "Give the break a name."}
            </p>
          )}

          <button
            type="button"
            disabled={create.isPending}
            onClick={() => {
              setAttempted(true);
              if (missingPin || missingLabel || create.isPending) return;
              create.mutate({ label: trimmed, lat: pin.lat, lng: pin.lng });
            }}
            className="mt-6 min-h-[48px] w-full rounded-2xl bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity active:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? "Adding…" : "Add break"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
