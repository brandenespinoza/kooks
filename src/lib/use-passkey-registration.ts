"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { guessDeviceLabel } from "~/lib/device-label";

/**
 * The registration ceremony, shared by the blocking setup screen and the "Add a passkey"
 * button in Settings. Both run exactly the same two-step flow; only the surrounding copy
 * differs, and a second copy of this would be a second place for the error handling to rot.
 */
export function usePasskeyRegistration(options?: { onRegistered?: () => void }) {
  const [busy, setBusy] = useState(false);
  const getOptions = api.passkey.registrationOptions.useMutation();
  const verify = api.passkey.verifyRegistration.useMutation();

  async function register() {
    setBusy(true);
    try {
      const optionsJSON = await getOptions.mutateAsync();
      const response = await startRegistration({ optionsJSON });
      await verify.mutateAsync({ response, deviceLabel: guessDeviceLabel() });
      options?.onRegistered?.();
    } catch (error) {
      if (error instanceof Error) {
        // Dismissing the OS sheet rejects the promise. That is a cancel, not a failure.
        if (error.name === "NotAllowedError" || error.name === "AbortError") return;

        // Thrown when `excludeCredentials` matches — this device already holds a passkey for
        // the account. Worth saying plainly; the generic message would read as a bug.
        if (error.name === "InvalidStateError") {
          toast.error("This device already has a passkey for your account.");
          return;
        }

        toast.error(error.message || "Couldn't create a passkey. Try again.");
        return;
      }

      toast.error("Couldn't create a passkey. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return { register, busy };
}
