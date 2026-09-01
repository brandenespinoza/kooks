"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Home, Trash2 } from "lucide-react";

import { api } from "~/trpc/react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "~/components/ui/drawer";

/**
 * Manage saved Breaks: pick a Home Break (FR-4a) and delete one you created (FR-3).
 *
 * Adding a break is deliberately NOT in here. Opening a second vaul drawer while this one
 * animates out leaves the new drawer invisible, so the "+" affordance lives on the Break
 * screen itself — one tap instead of two, and only ever one drawer at a time.
 *
 * Story 5.3 surfaces the same two actions inside the full Settings screen; it should reuse
 * this component rather than reimplementing the mutations.
 */
export function BreaksDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const breaks = api.break.list.useQuery();

  const setHome = api.break.setHomeBreak.useMutation({
    onSuccess: async () => {
      await utils.break.list.invalidate();
      toast.success("Home break updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.break.delete.useMutation({
    onSuccess: async () => {
      await utils.break.list.invalidate();
      setConfirmingId(null);
      toast.success("Break deleted");
    },
    onError: (error) => {
      setConfirmingId(null);
      toast.error(error.message);
    },
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-surface">
        <DrawerHeader className="px-7">
          <DrawerTitle className="text-[16px] font-bold text-text-primary">
            Your breaks
          </DrawerTitle>
          <DrawerDescription className="text-[13px] text-text-secondary">
            Tap the house to set your home break — that&rsquo;s where the dawn
            patrol alerts come from.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-7 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
          <ul className="divide-y divide-divider">
            {breaks.data?.map((surfBreak) => (
              <li
                key={surfBreak.id}
                className="flex min-h-[48px] items-center gap-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => setHome.mutate({ breakId: surfBreak.id })}
                  disabled={surfBreak.isHomeBreak || setHome.isPending}
                  aria-pressed={surfBreak.isHomeBreak}
                  aria-label={
                    surfBreak.isHomeBreak
                      ? `${surfBreak.label} is your home break`
                      : `Make ${surfBreak.label} your home break`
                  }
                  className="grid size-12 shrink-0 place-items-center rounded-full disabled:opacity-100"
                >
                  <Home
                    className={
                      surfBreak.isHomeBreak
                        ? "size-5 text-action"
                        : "size-5 text-text-secondary/50"
                    }
                    aria-hidden="true"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-text-primary">
                    {surfBreak.label}
                  </p>
                  <p className="text-[13px] text-text-secondary">
                    {surfBreak.isHomeBreak ? "Home break" : "Saved"}
                    {!surfBreak.isMine && " · added by your crew"}
                  </p>
                </div>

                {surfBreak.isMine &&
                  (confirmingId === surfBreak.id ? (
                    <button
                      type="button"
                      onClick={() => remove.mutate({ breakId: surfBreak.id })}
                      disabled={remove.isPending}
                      className="min-h-[48px] shrink-0 rounded-lg px-3 text-[13px] font-bold text-destructive"
                    >
                      {remove.isPending ? "Deleting…" : "Confirm"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(surfBreak.id)}
                      aria-label={`Delete ${surfBreak.label}`}
                      className="grid size-12 shrink-0 place-items-center rounded-full"
                    >
                      <Trash2
                        className="size-5 text-text-secondary"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
              </li>
            ))}
          </ul>

        </div>
      </DrawerContent>
    </Drawer>
  );
}
