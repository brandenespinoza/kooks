"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Home, Trash2, X } from "lucide-react";

import { api } from "~/trpc/react";

/**
 * Manage saved Breaks: pick a Home Break (FR-4a), delete one you created (FR-3), remove one
 * you did not (FR-4b), and save a Break your crew added (FR-4b).
 *
 * Lifted out of `BreaksDrawer` in Story 5.3 — the drawer is gone, because two surfaces
 * offering the same four mutations is exactly the duplication Settings exists to end.
 * Adding a break stays on the Break screen, one tap from where you are looking.
 */
export function SettingsBreaks() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const utils = api.useUtils();
  // One query for both lists since Story 5.2 widened it: `isSaved` decides which list a
  // Break belongs to, and saving simply flips that flag.
  const breaks = api.break.list.useQuery();
  const saved = breaks.data?.filter((surfBreak) => surfBreak.isSaved) ?? [];
  const crewBreaks = breaks.data?.filter((surfBreak) => !surfBreak.isSaved) ?? [];

  const refresh = () => utils.break.list.invalidate();

  const setHome = api.break.setHomeBreak.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Home break updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = api.break.delete.useMutation({
    onSuccess: async () => {
      await refresh();
      setConfirmingId(null);
      toast.success("Break deleted");
    },
    onError: (error) => {
      setConfirmingId(null);
      toast.error(error.message);
    },
  });

  const unsave = api.break.unsave.useMutation({
    onSuccess: async () => {
      await refresh();
      setConfirmingId(null);
      toast.success("Removed from your breaks");
    },
    onError: (error) => {
      setConfirmingId(null);
      toast.error(error.message);
    },
  });

  const save = api.break.save.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Saved to your breaks");
    },
    onError: (error) => toast.error(error.message),
  });

  const isRemoving = remove.isPending || unsave.isPending;

  if (breaks.isPending) {
    return <p className="py-2 text-[13px] text-text-secondary">Loading…</p>;
  }

  return (
    <>
      {saved.length === 0 ? (
        <p className="py-2 text-[13px] text-text-secondary">
          No saved breaks yet.
        </p>
      ) : (
        <ul className="divide-y divide-divider">
          {saved.map((surfBreak) => (
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

              {/* You delete what you created and remove what you didn't — the row for a
                  crew member's Break must never offer to delete it out from under them. */}
              {confirmingId === surfBreak.id ? (
                <button
                  type="button"
                  onClick={() =>
                    surfBreak.isMine
                      ? remove.mutate({ breakId: surfBreak.id })
                      : unsave.mutate({ breakId: surfBreak.id })
                  }
                  disabled={isRemoving}
                  className="min-h-[48px] shrink-0 rounded-lg px-3 text-[13px] font-bold text-destructive"
                >
                  {isRemoving
                    ? surfBreak.isMine
                      ? "Deleting…"
                      : "Removing…"
                    : "Confirm"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(surfBreak.id)}
                  aria-label={
                    surfBreak.isMine
                      ? `Delete ${surfBreak.label}`
                      : `Remove ${surfBreak.label} from your breaks`
                  }
                  className="grid size-12 shrink-0 place-items-center rounded-full"
                >
                  {surfBreak.isMine ? (
                    <Trash2 className="size-5 text-text-secondary" aria-hidden="true" />
                  ) : (
                    <X className="size-5 text-text-secondary" aria-hidden="true" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* FR-4b. Breaks your crew created that you have not saved. */}
      {crewBreaks.length > 0 && (
        <>
          <h3 className="mt-6 text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
            Your crew&rsquo;s breaks
          </h3>
          <ul className="mt-1 divide-y divide-divider">
            {crewBreaks.map((surfBreak) => (
              <li
                key={surfBreak.id}
                className="flex min-h-[48px] items-center gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-text-primary">
                    {surfBreak.label}
                  </p>
                  <p className="truncate text-[13px] text-text-secondary">
                    Added by {surfBreak.createdByName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => save.mutate({ breakId: surfBreak.id })}
                  disabled={save.isPending}
                  aria-label={`Save ${surfBreak.label} to your breaks`}
                  className="min-h-[48px] shrink-0 rounded-lg px-3 text-[13px] font-bold text-action disabled:opacity-50"
                >
                  Save
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
