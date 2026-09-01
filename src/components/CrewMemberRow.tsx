/**
 * One checked-in crew member (FR-10).
 *
 * The status dot is never the only signal — it is always paired with the name and ETA text,
 * because colour alone fails both colour-blind users and screen readers (UX accessibility
 * table). The whole row carries an `aria-label` so a screen reader reads "Sarah is going at
 * 6:45 am" rather than three disconnected fragments.
 */
export function CrewMemberRow({
  name,
  eta,
  isMe,
}: {
  name: string;
  eta: Date;
  isMe: boolean;
}) {
  const time = formatEta(eta);

  return (
    <li
      className="flex min-h-[48px] items-center gap-3"
      aria-label={`${name} is going at ${time}`}
    >
      <span
        className="size-2 shrink-0 rounded-full bg-present"
        aria-hidden="true"
      />
      <span
        className={`truncate text-[16px] font-bold ${
          isMe ? "text-present" : "text-text-primary"
        }`}
      >
        {name}
      </span>
      <span className="shrink-0 text-[13px] font-normal text-text-secondary">
        {time}
      </span>
    </li>
  );
}

/** "6:45 am" — lowercase meridiem, which reads quieter next to a bold name. */
export function formatEta(eta: Date): string {
  return eta
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    .toLowerCase();
}
