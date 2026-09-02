"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import {
  passkeySignInAction,
  passkeySignInOptionsAction,
} from "~/app/join-required/actions";

/**
 * The way back in on a device that has never held a session — a new phone, or the installed
 * PWA after joining in Safari (iOS gives an installed app a storage container separate from
 * the browser's, so it starts signed out).
 *
 * This does not violate FR-22. That rule forbids a sign-up form or any path to one on this
 * page; this button cannot create an account. It only ever resolves an existing passkey to
 * the account that already owns it.
 */
export function PasskeySignInButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  // `browserSupportsWebAuthn` touches `window`, so it cannot run during SSR. Assume
  // supported until proven otherwise: rendering the button and having it fail is better
  // than hiding the only way in behind a flash of the wrong state.
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(browserSupportsWebAuthn()), []);

  async function signIn() {
    setBusy(true);
    try {
      const optionsJSON = await passkeySignInOptionsAction();
      const response = await startAuthentication({ optionsJSON });
      const result = await passkeySignInAction(response);

      if (!result.ok) {
        setBusy(false);
        toast.error(result.error);
        return;
      }

      startTransition(() => {
        router.replace("/");
        router.refresh();
      });
    } catch (error) {
      setBusy(false);
      // Dismissing the OS passkey sheet rejects too. That is a cancel, not a failure, and
      // toasting an error at someone who just tapped "cancel" is noise.
      if (
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "AbortError")
      ) {
        return;
      }
      toast.error("Couldn't sign in with a passkey. Try again.");
    }
  }

  if (!supported) {
    return (
      <p className="mt-8 text-[13px] leading-relaxed text-text-secondary">
        This browser can&rsquo;t use passkeys, so there&rsquo;s no way to sign back in here.
        Open Kooks in Safari on iOS or Chrome on Android.
      </p>
    );
  }

  return (
    <div className="mt-10">
      <p className="text-[13px] leading-relaxed text-text-secondary">
        Already have an account? If you set up a passkey, you can sign back in on this
        device.
      </p>

      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy || isPending}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-divider px-4 text-[16px] font-bold text-text-primary transition-opacity active:opacity-90 disabled:opacity-50"
      >
        <KeyRound className="size-4" aria-hidden="true" />
        {busy || isPending ? "Signing in…" : "Sign in with a passkey"}
      </button>
    </div>
  );
}
