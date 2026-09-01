"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";

/**
 * NFR-5 and FR-18. Explains the iOS home-screen requirement, and — once installed — is where
 * push permission is actually requested.
 *
 * Deliberately **not** a browser alert and never an unprompted permission dialog: iOS gives
 * an app exactly one chance to ask, and a permission prompt fired at someone who has not
 * been told why is the fastest way to lose it permanently. The button is the user's
 * decision, taken after reading one sentence.
 *
 * Three states, and which one shows is a client-only decision — `display-mode` is unknowable
 * during SSR:
 *
 *   1. not installed  -> how to install (no button; there is nothing to grant yet on iOS)
 *   2. installed, not subscribed -> "Turn on notifications"
 *   3. already subscribed, or unsupported -> nothing at all
 */
type Stage = "unknown" | "not-installed" | "installable" | "done";

export function NotificationPrompt() {
  const [stage, setStage] = useState<Stage>("unknown");
  const [busy, setBusy] = useState(false);

  const status = api.notification.status.useQuery(undefined, {
    // Only worth asking once per mount; nothing else changes it.
    refetchOnWindowFocus: false,
  });
  const publicKey = api.notification.publicKey.useQuery();
  const subscribe = api.notification.subscribe.useMutation();

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari predates `display-mode` for home-screen apps.
      ("standalone" in window.navigator &&
        (window.navigator as { standalone?: boolean }).standalone === true);

    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    if (!supported || Notification.permission === "denied") {
      setStage("done");
      return;
    }

    setStage(standalone ? "installable" : "not-installed");
  }, []);

  // A device already registered needs no prompt.
  useEffect(() => {
    if (status.data?.subscribed) setStage("done");
  }, [status.data?.subscribed]);

  async function enable() {
    if (!publicKey.data) return;
    setBusy(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        // Not an error state: declining is a valid answer, and nagging is how you get
        // uninstalled. The prompt simply goes away.
        setStage("done");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser; a subscription that can send silent pushes is refused.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey.data.publicKey),
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("The browser returned an incomplete subscription.");
      }

      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      });

      setStage("done");
      toast.success("Notifications on — you'll hear when the crew is going.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't turn notifications on.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (stage === "unknown" || stage === "done") return null;

  return (
    <div className="mt-6 rounded-lg border border-divider bg-surface px-4 py-3 text-[13px] leading-relaxed text-text-secondary">
      {stage === "not-installed" ? (
        <p>
          <span className="font-bold text-text-primary">One more thing.</span> To
          get dawn patrol alerts on an iPhone, add Kooks to your home screen —
          Share, then &ldquo;Add to Home Screen&rdquo;. Everything else works
          right here in the browser.
        </p>
      ) : (
        <>
          <p>
            <span className="font-bold text-text-primary">
              Want to know when the crew is going?
            </span>{" "}
            We&rsquo;ll send a notification when someone checks in. Nothing else.
          </p>
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy || !publicKey.data}
            className="mt-3 min-h-[48px] w-full rounded-2xl bg-action px-4 text-[16px] font-bold text-action-fg transition-opacity active:opacity-90 disabled:opacity-50"
          >
            {busy ? "Turning on…" : "Turn on notifications"}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * The VAPID key travels as base64url; `applicationServerKey` wants raw bytes. Browsers do
 * not do this conversion, so every push implementation carries some version of it.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  // Backed by a concrete ArrayBuffer, not `ArrayBufferLike`: `applicationServerKey` takes a
  // `BufferSource`, which excludes `SharedArrayBuffer`, and the default `Uint8Array` type no
  // longer promises that.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
