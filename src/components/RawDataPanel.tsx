import type { SavedBreak } from "~/components/BreakSwipeStack";

/**
 * Tap-to-reveal conditions data (FR-6, UX-DR16). Collapsible panel inside `VerdictBand`;
 * `VerdictBand` owns the open state and the toggle button, this is the disclosure target.
 *
 * Two columns, so five values cost three rows of band height instead of five — the band
 * shares a fixed viewport with the crew zone and cannot afford to grow by 100px.
 *
 * No units are printed, for the same reason the fallback prints none: SwellCloud's are
 * unknown (see `src/lib/swellcloud.ts`). The labels say what each number *is*; inventing
 * "ft" or "kt" would be a confident lie about someone's surf session.
 */
export function RawDataPanel({
  id,
  rawData,
}: {
  id: string;
  rawData: NonNullable<SavedBreak["rawData"]>;
}) {
  return (
    <dl
      id={id}
      className="mt-1 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px] leading-tight text-action-fg/70"
    >
      <Row label="Swell" value={round(rawData.swellHeight)} />
      <Row label="Period" value={`${round(rawData.swellPeriod)}s`} />
      <Row label="Wave dir" value={degrees(rawData.waveDirection)} />
      <Row label="Wind" value={round(rawData.windSpeed)} />
      <Row label="Wind dir" value={degrees(rawData.windDirection)} />
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="uppercase tracking-[0.1em] text-action-fg/70">{label}</dt>
      <dd className="font-bold text-action-fg/85">{value}</dd>
    </div>
  );
}

function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function degrees(value: number): string {
  return `${Math.round(value)}°`;
}
