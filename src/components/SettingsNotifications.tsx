"use client";

import { toast } from "sonner";

import { api } from "~/trpc/react";

/**
 * FR-21. The three notification types, independently switchable.
 *
 * Replaces the disabled placeholders Story 5.3 rendered. Each switch is a real
 * `role="switch"` button rather than a styled checkbox: it needs a 48px target and a visible
 * state, and a native checkbox at that size fights every browser's own styling.
 *
 * No optimistic update (V1 rule): the switch reflects the server, and is disabled while a
 * write is in flight, so it can never show a state the database does not have.
 */
const PREFS = [
  {
    key: "friendCheckIn",
    label: "Friend check-ins",
    hint: "When someone in your crew is going out",
  },
  {
    key: "nightBefore",
    label: "Night before",
    hint: "A nudge at ~9pm about your home break",
  },
  {
    key: "dawnPatrol",
    label: "Dawn patrol",
    hint: "Just after 5am, your home break only",
  },
] as const;

export function SettingsNotifications() {
  const utils = api.useUtils();
  const prefs = api.notification.prefs.useQuery();

  const update = api.notification.updatePrefs.useMutation({
    onSuccess: async () => {
      await utils.notification.prefs.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  if (prefs.isPending) {
    return <p className="py-2 text-[13px] text-text-secondary">Loading…</p>;
  }

  return (
    <ul className="divide-y divide-divider">
      {PREFS.map((pref) => {
        const on = prefs.data?.[pref.key] ?? true;

        return (
          <li key={pref.key} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p
                className="text-[16px] font-bold text-text-primary"
                id={`pref-${pref.key}`}
              >
                {pref.label}
              </p>
              <p className="text-[13px] text-text-secondary">{pref.hint}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`pref-${pref.key}`}
              disabled={update.isPending}
              onClick={() => update.mutate({ [pref.key]: !on })}
              // 48px of height for the target (NFR-10) with a 40px visual switch inside it.
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full disabled:opacity-50"
            >
              <span
                aria-hidden="true"
                className={`block h-6 w-10 rounded-full p-0.5 transition-colors ${
                  on ? "bg-present" : "bg-text-secondary/30"
                }`}
              >
                <span
                  className={`block size-5 rounded-full bg-surface transition-transform motion-reduce:transition-none ${
                    on ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
