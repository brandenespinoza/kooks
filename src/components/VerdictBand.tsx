"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { SavedBreak } from "~/components/BreakSwipeStack";
import { RawDataPanel } from "~/components/RawDataPanel";
import { SwipeDots } from "~/components/SwipeDots";
import { WebcamLink } from "~/components/WebcamLink";

/**
 * Navy top zone of the D3 Verdict Band layout (UX-DR1).
 *
 * Purely presentational — all data arrives as props from BreakScreen; nothing below
 * BreakScreen makes tRPC calls.
 *
 * The band paints behind the iOS status bar, so it owns the top safe-area inset rather
 * than the app shell. `max()` keeps a sensible 56px clearance on desktop where the inset
 * resolves to 0, without stacking 56px on top of a real notch inset on device.
 *
 * Colour note: the UX spec assigns `--text-secondary` to the break name, but that is
 * 2.93:1 on navy and fails WCAG AA (NFR-9). `action-fg` at 70% composites to 5.88:1 and
 * carries the same muted intent, so it is used for all secondary text on this band.
 */
export function VerdictBand({
  label,
  verdict,
  rawData,
  webcamUrl,
  isLoading,
  breakCount,
  activeIndex,
  isHomeBreak = false,
  isSimulated = false,
}: {
  label: string;
  verdict: string | null;
  rawData: SavedBreak["rawData"];
  webcamUrl: string | null;
  isLoading: boolean;
  breakCount: number;
  activeIndex: number;
  isHomeBreak?: boolean;
  isSimulated?: boolean;
}) {
  const [rawDataOpen, setRawDataOpen] = useState(false);
  const panelId = useId();

  // The toggle only earns its place when the numbers are *not* already on screen. With a
  // null verdict the band is showing the raw values inline (FR-8's fallback), and offering
  // to reveal what the reader is already looking at is noise, not disclosure.
  const showRawDataToggle = !isLoading && verdict !== null && rawData !== null;

  return (
    <header className="bg-action px-7 pt-[max(3.5rem,calc(env(safe-area-inset-top)+1rem))] pb-9">
      <div className="flex items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-2 text-[16px] font-bold uppercase tracking-[0.14em] text-action-fg/70">
          <span className="truncate">{label}</span>
          {/* FR-4a: the Home Break is distinguished by a word, not by colour alone. */}
          {isHomeBreak && (
            <span className="shrink-0 rounded-full border border-action-fg/30 px-1.5 py-0.5 text-[9px] leading-none text-action-fg/70">
              Home
            </span>
          )}
        </p>
        <SwipeDots count={breakCount} activeIndex={activeIndex} />
      </div>

      {/* aria-live so a verdict refresh is announced without interrupting (UX-DR14) */}
      <div className="mt-4 min-h-[68px]" aria-live="polite">
        {isLoading ? (
          <VerdictSkeleton />
        ) : verdict ? (
          <p className="text-[28px] font-bold leading-[1.18] tracking-tight text-action-fg">
            {verdict}
          </p>
        ) : rawData ? (
          <RawDataFallback rawData={rawData} />
        ) : (
          <p className="text-[15px] font-normal leading-[1.4] text-action-fg/70">
            No conditions data yet.
          </p>
        )}
      </div>

      {/*
        CONDITIONS_SOURCE=mock. The band is the go/no-go signal for paddling out, so
        invented numbers have to say so on the same screen and at the same moment — not in
        a log, and not behind the raw-data disclosure. It sits directly under the verdict
        because the verdict is the claim it qualifies, and it renders for the raw-data
        fallback too, since those numbers are just as synthetic.
      */}
      {!isLoading && isSimulated && (
        <p className="mt-2.5 text-[11px] font-normal uppercase tracking-[0.14em] text-action-fg/70">
          Simulated — not a forecast
        </p>
      )}

      {/* UX spec: verdict bottom margin 10px, toggle bottom margin 36px — the band's own
          pb-9 supplies the latter. */}
      {showRawDataToggle && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setRawDataOpen((open) => !open)}
            aria-expanded={rawDataOpen}
            aria-controls={panelId}
            className="-mx-1 flex min-h-12 items-center gap-1.5 px-1 text-[11px] font-normal uppercase tracking-[0.14em] text-action-fg/70"
          >
            Raw data
            <ChevronDown
              className={`size-3.5 transition-transform ${rawDataOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {rawDataOpen && <RawDataPanel id={panelId} rawData={rawData} />}
        </div>
      )}

      {!isLoading && webcamUrl && <WebcamLink url={webcamUrl} label={label} />}
    </header>
  );
}

/**
 * FR-8's fallback: the LLM call failed (or has not run yet) and the numbers stand in for the
 * verdict. Muted and two lines, so the band keeps the same height it has with a verdict and
 * nothing below it shifts.
 *
 * No units are printed. SwellCloud's are unknown (see `src/lib/swellcloud.ts`) and inventing
 * "ft" or "kt" here would be a confident lie about someone's surf session. Story 3.3's
 * `RawDataPanel` shows the full set with labels.
 */
function RawDataFallback({ rawData }: { rawData: NonNullable<SavedBreak["rawData"]> }) {
  return (
    <div className="space-y-1 text-[15px] font-normal leading-[1.4] text-action-fg/70">
      <p>
        Swell {round(rawData.swellHeight)} at {round(rawData.swellPeriod)}s from{" "}
        {degrees(rawData.waveDirection)}
      </p>
      <p>
        Wind {round(rawData.windSpeed)} from {degrees(rawData.windDirection)}
      </p>
    </div>
  );
}

/** One decimal at most, and no trailing `.0` — these sit beside a 28px verdict, not in a table. */
function round(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function degrees(value: number): string {
  return `${Math.round(value)}°`;
}

/** Two lines, matching the verdict's rhythm. Never a spinner (UX-DR8). */
function VerdictSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-[22px] w-11/12 animate-pulse rounded bg-action-fg/15" />
      <div className="h-[22px] w-2/3 animate-pulse rounded bg-action-fg/15" />
    </div>
  );
}
