"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/**
 * FR-14. Invite link sharing, moved here from the interim `InviteDrawer` that Story 5.1 hung
 * off the CrewZone header — this is the "single Settings screen" that story was waiting for.
 *
 * The full URL stays visible rather than hiding behind the button: `navigator.clipboard`
 * needs a secure context, so on plain HTTP the copy fails and long-pressing the text is the
 * only way to get the link.
 */
export function SettingsInvite() {
  const [copied, setCopied] = useState(false);
  const invite = api.crew.getInviteLink.useQuery();

  // The origin belongs to the browser; the server only knows the path.
  const url = invite.data ? `${window.location.origin}${invite.data.path}` : null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it.");
    }
  }

  return (
    <>
      <p className="text-[13px] text-text-secondary">
        Anyone who opens this link joins your crew and starts seeing your
        check-ins.
      </p>

      <p
        className="mt-3 min-h-[48px] w-full rounded-lg border border-divider bg-bg px-4 py-3 text-[13px] break-all text-text-primary select-all"
        aria-label="Your invite link"
      >
        {invite.isPending ? "Loading…" : (url ?? "Couldn't load your link.")}
      </p>

      <button
        type="button"
        disabled={!url}
        onClick={() => void copy()}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity active:opacity-90 disabled:opacity-50"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy invite link"}
      </button>
    </>
  );
}
