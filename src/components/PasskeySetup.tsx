"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";

import { usePasskeyRegistration } from "~/lib/use-passkey-registration";

/**
 * The mandatory enrolment gate. Blocking by design — there is **no skip affordance**, and
 * adding one would quietly undo the whole feature.
 *
 * Kooks has no email, no password and no crew-vouched reset, so a passkey is the only thing
 * that can ever return an account to a device that has never held a session. Someone who
 * declines here and later loses their phone has no way back at all: the invite link creates
 * a *new* account, which is how people ended up silently forked before this existed.
 *
 * This screen is also where every pre-existing user is migrated. They arrive still signed
 * in, enrol while they still have access, and that must happen before the legacy cuid
 * session tokens are rotated.
 */
export function PasskeySetup({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Touches `window`, so it cannot run during SSR.
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(browserSupportsWebAuthn()), []);

  const { register, busy } = usePasskeyRegistration({
    onRegistered: () => {
      startTransition(() => {
        router.replace("/");
        router.refresh();
      });
    },
  });

  return (
    <main className="flex flex-1 flex-col justify-center px-7 pt-safe pb-safe">
      <p className="text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary">
        One last thing, {displayName}
      </p>

      <h1 className="mt-2 text-[28px] font-bold leading-[1.18] tracking-tight text-text-primary">
        Set up a passkey.
      </h1>

      <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">
        Kooks has no email and no password, so this is the only way back into your account on
        a new phone. Your device stores it — Face ID, Touch ID or your screen lock unlocks it.
      </p>

      {supported ? (
        <>
          <button
            type="button"
            onClick={() => void register()}
            disabled={busy || isPending}
            className="mt-8 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity active:opacity-90 disabled:opacity-50"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            {busy || isPending ? "Setting up…" : "Create a passkey"}
          </button>

          <p className="mt-4 text-[13px] leading-relaxed text-text-secondary">
            It syncs with your iCloud Keychain or Google Password Manager, so a new phone
            restored from backup already has it.
          </p>
        </>
      ) : (
        <p className="mt-8 text-[13px] leading-relaxed text-text-secondary">
          This browser can&rsquo;t create passkeys. Open Kooks in Safari on iOS or Chrome on
          Android to finish setting up — you won&rsquo;t be able to get back in on a new
          device until you do.
        </p>
      )}
    </main>
  );
}
