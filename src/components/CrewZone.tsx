import Link from "next/link";
import { Plus, Settings } from "lucide-react";

import type { SavedBreak } from "~/components/BreakSwipeStack";
import { CheckInCTA } from "~/components/CheckInCTA";
import { CrewMemberRow } from "~/components/CrewMemberRow";
import { EmptyCrewState } from "~/components/EmptyCrewState";

const STALE_AFTER_MS = 30 * 60 * 1000;

/**
 * Parchment bottom zone of the D3 Verdict Band layout (UX-DR1).
 *
 * Purely presentational. Owns the bottom safe-area inset so the home indicator never
 * overlaps the timestamp.
 *
 * The CheckInCTA belongs between the list and the timestamp; it lands in Epic 4 rather
 * than shipping here as a button that does nothing.
 */
export function CrewZone({
  isLoading,
  updatedAt,
  checkIns,
  onCheckIn,
  onAddBreak,
}: {
  isLoading: boolean;
  updatedAt: Date | null;
  checkIns: SavedBreak["checkIns"];
  onCheckIn?: () => void;
  onAddBreak?: () => void;
}) {
  // FR-7: the poll refreshes every 30 minutes, so anything older than that means a poll
  // was missed — the timestamp drops to `--stale` to say so, without an error state.
  // The threshold matches POLL_CONDITIONS_CRON in `conditions-jobs.ts` on purpose; it is
  // duplicated rather than imported because that module is server-only and this is not.
  const myEta = checkIns.find((checkIn) => checkIn.isMe)?.eta ?? null;

  const isFresh =
    updatedAt !== null && Date.now() - updatedAt.getTime() <= STALE_AFTER_MS;

  return (
    <section className="flex flex-1 flex-col px-7 pt-8 pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
          Crew
        </h2>
        <div className="-mr-3 flex items-center">
          {onAddBreak && (
            <button
              type="button"
              onClick={onAddBreak}
              aria-label="Add a break"
              className="grid size-12 place-items-center rounded-full"
            >
              <Plus className="size-4 text-text-secondary" aria-hidden="true" />
            </button>
          )}
          {/* Everything else — managing breaks, the crew, the invite link — lives on the
              Settings screen as of Story 5.3, rather than in two drawers hanging off this
              header. */}
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid size-12 place-items-center rounded-full"
          >
            <Settings className="size-4 text-text-secondary" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-3 flex-1">
        {isLoading ? (
          <CrewSkeleton />
        ) : checkIns.length === 0 ? (
          <EmptyCrewState />
        ) : (
          <ul>
            {checkIns.map((checkIn) => (
              <CrewMemberRow
                key={checkIn.id}
                name={checkIn.displayName}
                eta={checkIn.eta}
                isMe={checkIn.isMe}
              />
            ))}
          </ul>
        )}
      </div>

      {/* The gap Story 2.1 deliberately left: between the crew list and the timestamp. */}
      {!isLoading && onCheckIn && (
        <div className="mb-5">
          <CheckInCTA eta={myEta} onOpen={onCheckIn} />
        </div>
      )}

      <p
        className={`text-center text-[10px] font-normal uppercase ${
          isFresh ? "text-text-secondary" : "text-stale"
        }`}
      >
        {isLoading
          ? " "
          : updatedAt
            ? `Updated ${formatUpdatedAt(updatedAt)}`
            : "No conditions data yet"}
      </p>
    </section>
  );
}

/** Two rows sized to a real CrewMemberRow so the layout does not jump on load (UX-DR8). */
function CrewSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="flex min-h-[48px] items-center gap-3">
          <div className="size-2 animate-pulse rounded-full bg-text-secondary/20" />
          <div className="h-[16px] w-28 animate-pulse rounded bg-text-secondary/20" />
          <div className="h-[13px] w-14 animate-pulse rounded bg-text-secondary/15" />
        </div>
      ))}
    </div>
  );
}

function formatUpdatedAt(updatedAt: Date): string {
  const minutes = Math.floor((Date.now() - updatedAt.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
