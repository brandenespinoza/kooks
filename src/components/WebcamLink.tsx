import { ExternalLink } from "lucide-react";

/**
 * Webcam shortcut (FR-9). Only rendered when `WEBCAM_URLS_JSON` has an entry for this
 * Break's label — an absent webcam shows nothing at all, not a disabled row.
 *
 * `target="_blank"` opens the feed in the external browser rather than inside the installed
 * PWA, which has no chrome to get back from. `rel="noopener noreferrer"` because the URL is
 * curator-supplied config, not something this app controls.
 */
export function WebcamLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-1 flex min-h-12 items-center gap-2 px-1 text-[11px] uppercase tracking-[0.14em] text-action-fg/70"
    >
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
      <span>Webcam</span>
      <span className="sr-only">for {label}, opens in a new tab</span>
    </a>
  );
}
