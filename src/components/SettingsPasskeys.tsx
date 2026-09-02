"use client";

import { useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { usePasskeyRegistration } from "~/lib/use-passkey-registration";

/**
 * Passkey management — and the only place to deliberately enrol a second device.
 *
 * "Add a passkey" is not a duplicate of the setup gate: run it on a laptop and the browser
 * offers the cross-device flow, so scanning the QR with your phone registers a credential
 * for *that* device. This is how someone ends up with more than one way in.
 */
export function SettingsPasskeys() {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const utils = api.useUtils();
  const passkeys = api.passkey.list.useQuery();

  function refresh() {
    void utils.passkey.list.invalidate();
    // `crew.me` carries `hasPasskey`, which drives the enrolment gate on every guarded page.
    void utils.crew.me.invalidate();
  }

  const { register, busy } = usePasskeyRegistration({
    onRegistered: () => {
      toast.success("Passkey added");
      refresh();
    },
  });

  const remove = api.passkey.remove.useMutation({
    onSuccess: () => {
      setConfirmingId(null);
      toast.success("Passkey removed");
      refresh();
    },
    onError: (error) => {
      setConfirmingId(null);
      toast.error(error.message);
    },
  });

  const isOnlyPasskey = (passkeys.data?.length ?? 0) === 1;

  return (
    <>
      <p className="text-[13px] text-text-secondary">
        Passkeys are how you sign in on a new phone. Add one for every device you use.
      </p>

      {passkeys.isPending ? (
        <p className="mt-3 text-[13px] text-text-secondary">Loading…</p>
      ) : (
        <ul className="mt-3">
          {passkeys.data?.map((passkey) => (
            <li
              key={passkey.credentialId}
              className="flex min-h-[48px] items-center justify-between gap-3 border-b border-divider py-2"
            >
              <span className="flex items-center gap-2">
                <KeyRound className="size-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <span>
                  <span className="block text-[16px] text-text-primary">
                    {passkey.deviceLabel ?? "Passkey"}
                  </span>
                  <span className="block text-[10px] text-text-secondary">
                    {passkey.lastUsedAt
                      ? `Last used ${formatDate(passkey.lastUsedAt)}`
                      : `Added ${formatDate(passkey.createdAt)}`}
                  </span>
                </span>
              </span>

              {/* The last passkey has no remove button at all. The server refuses it too,
                  but offering a tap that can only fail is worse than not offering it: with
                  no email and no password, removing it would be a permanent lockout. */}
              {isOnlyPasskey ? (
                <span className="shrink-0 text-[10px] text-text-secondary">Only key</span>
              ) : (
                <button
                  type="button"
                  disabled={remove.isPending}
                  onClick={() =>
                    confirmingId === passkey.credentialId
                      ? remove.mutate({ credentialId: passkey.credentialId })
                      : setConfirmingId(passkey.credentialId)
                  }
                  className="min-h-[48px] shrink-0 px-2 text-[13px] font-bold text-destructive disabled:opacity-50"
                >
                  {confirmingId === passkey.credentialId ? "Sure?" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void register()}
        disabled={busy}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-divider px-4 text-[16px] font-bold text-text-primary transition-opacity active:opacity-90 disabled:opacity-50"
      >
        <Plus className="size-4" aria-hidden="true" />
        {busy ? "Adding…" : "Add a passkey"}
      </button>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
