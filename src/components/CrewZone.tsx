import { EmptyCrewState } from "~/components/EmptyCrewState";

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
}: {
  isLoading: boolean;
  updatedAt: Date | null;
}) {
  return (
    <section className="flex flex-1 flex-col px-7 pt-8 pb-[max(2.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]">
      <h2 className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        Crew
      </h2>

      <div className="mt-3 flex-1">
        {isLoading ? <CrewSkeleton /> : <EmptyCrewState />}
      </div>

      <p className="text-center text-[10px] font-normal uppercase text-stale">
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
