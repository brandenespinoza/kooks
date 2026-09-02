/**
 * A human-readable guess at what this device is, used to label a passkey in Settings.
 *
 * A guess, deliberately — the user agent is not identity and nothing depends on it being
 * right. It exists so the Settings list reads "iPhone" and "Mac" instead of two base64url
 * blobs, which matters at the one moment it is used: deciding which passkey to remove.
 */
export function guessDeviceLabel(): string {
  if (typeof navigator === "undefined") return "This device";

  const ua = navigator.userAgent;

  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";

  return "This device";
}
