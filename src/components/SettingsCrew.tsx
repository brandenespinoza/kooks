"use client";

import { useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/**
 * FR-17. The crew, and the ability to leave one.
 *
 * Removal is two taps — tap "Remove", then "Confirm" — matching the Break rows above it.
 * Unlike a check-in, this one is not cheap to undo: reconnecting means someone re-sharing
 * an invite link.
 */
export function SettingsCrew() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const utils = api.useUtils();
  const crew = api.crew.list.useQuery();

  const remove = api.crew.remove.useMutation({
    onSuccess: async () => {
      // Their check-ins are no longer visible, so the Break screen's data is stale the
      // moment this succeeds.
      await Promise.all([
        utils.crew.list.invalidate(),
        utils.break.list.invalidate(),
      ]);
      setConfirmingId(null);
      toast.success("Removed from your crew");
    },
    onError: (error) => {
      setConfirmingId(null);
      toast.error(error.message);
    },
  });

  if (crew.isPending) {
    return <p className="py-2 text-[13px] text-text-secondary">Loading…</p>;
  }

  if (!crew.data || crew.data.length === 0) {
    return (
      <p className="py-2 text-[13px] text-text-secondary">
        No one yet. Share your invite link below.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-divider">
      {crew.data.map((member) => (
        <li
          key={member.id}
          className="flex min-h-[48px] items-center gap-3 py-2"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-text-primary">
              {member.displayName}
            </p>
          </div>

          {confirmingId === member.id ? (
            <button
              type="button"
              onClick={() => remove.mutate({ userId: member.id })}
              disabled={remove.isPending}
              className="min-h-[48px] shrink-0 rounded-lg px-3 text-[13px] font-bold text-destructive disabled:opacity-50"
            >
              {remove.isPending ? "Removing…" : "Confirm"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingId(member.id)}
              aria-label={`Remove ${member.displayName} from your crew`}
              className="min-h-[48px] shrink-0 rounded-lg px-3 text-[13px] font-normal text-text-secondary"
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
