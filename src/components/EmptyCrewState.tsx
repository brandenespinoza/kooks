/**
 * CrewZone state when nobody is checked in (UX-DR6).
 *
 * Deliberately reads as an opportunity, not a failure — "be the first" is the nudge that
 * makes someone the social signal for the rest of the crew.
 */
export function EmptyCrewState() {
  return (
    <div className="py-2">
      <p className="text-[15px] font-bold text-text-secondary">
        No one&rsquo;s checked in yet.
      </p>
      <p className="mt-1 text-[13px] font-normal text-text-secondary">
        Be the first to go.
      </p>
    </div>
  );
}
