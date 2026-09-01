# Story 6.2: Push Subscriptions & Friend Check-In Notifications

Status: **done** (2026-09-01)
Epic: 6 — Push Notifications & PWA
FRs: FR-18
NFRs: NFR-3 (delivered within 30 seconds), NFR-7 (no cross-crew leakage)

## Story

As a user,
I want to receive a push notification on my lock screen within 30 seconds when a crew member checks in,
So that I know the crew is going without having to open the app.

## Acceptance Criteria

1. **No migration** — `push_subscriptions` (unique `endpoint`) and `notification_prefs` already exist.
2. **VAPID keys validated at boot**; `web-push` initialised server-side with them.
3. **"Enable notifications"** requests permission, subscribes through the service worker, and stores the
   subscription via `notification.subscribe`.
4. **A check-in create/update/remove** calls `sendToCrewMembers`, delivering within 30 seconds, naming
   who, which Break and what ETA.
5. **A user with `friendCheckIn` off** receives nothing for this event type.

## Tasks

- [x] Generate real VAPID keys into `.env` (they were `placeholder`).
- [x] `src/server/push/web-push.ts` — lazy VAPID config, `sendToUsers`, `sendToCrewMembers`, pruning.
- [x] `notification` router — `publicKey`, `subscribe`, `unsubscribe`, `status`.
- [x] `push` and `notificationclick` handlers in `src/app/sw.ts`.
- [x] `NotificationPrompt` becomes the permission + subscribe flow.
- [x] Check-in create/update/remove notify the crew.

## Dev Notes

**Recipients are filtered twice, and both filters matter.** Direct crew of the actor (NFR-7 — sharing a
Break is not enough, the same friend-of-friend rule Story 5.2 applied to `break.list` and the stream),
**and** only people for whom that Break is visible. Someone in your crew who has never heard of the spot
should not get a push about it and would see nothing if they opened the app. The actor is always
excluded: a push telling you what you just did is noise.

**Sending is fire-and-forget.** A check-in is a one-tap action and must not wait on Apple's or Google's
push service; NFR-3 allows 30 seconds, the mutation should answer in milliseconds. This is a
long-running Node server, not a serverless function, so the promise survives the response. Errors are
logged and swallowed for the same reason per-endpoint failures are: a push service having a bad day must
never fail somebody's check-in.

**Only 404 and 410 prune a subscription.** Those mean the endpoint is gone for good; anything else may
be transient, and deleting a row on a network blip would silently unsubscribe someone. Verified in both
directions — a TLS error left both rows intact, a 410 removed exactly one.

**The VAPID public key is served by a procedure, not `NEXT_PUBLIC_`.** It is public either way, but
routing it through tRPC keeps `src/env.js` server-only, so there is one place env vars are declared and
no client block to keep in step.

**The prompt never asks for permission unprompted.** iOS gives an app one chance to ask, and a
permission dialog fired at someone who has not been told why is the fastest way to lose it forever. The
button is the user's decision, taken after one sentence — and declining is treated as a valid answer that
simply removes the prompt, not an error to retry.

**The worker's `push` handler wraps `showNotification` in `waitUntil`.** Without it the worker can be
killed before the notification renders, and the browser substitutes its own "This site has been updated
in the background" placeholder — worse than showing nothing. `notificationclick` focuses an existing
window rather than opening a second copy.

**Keys generated, not requested.** VAPID keys need no vendor, so the placeholders were replaced with a
real pair via `web-push`. The private key was written straight to `.env` and never printed.

## Verification

`npm run typecheck` and `npm run build` pass.

**Delivery, against a local TLS receiver** (`web-push` refuses plain HTTP — the first attempt failed with
an SSL error, which is itself worth knowing), with two subscriptions for a crew member, one endpoint
answering `201` and one `410`:

| Check | Result |
|---|---|
| Both endpoints received a POST | `encrypted-bytes=193` each — real Web Push encryption, not a plaintext body |
| `201` endpoint | row kept |
| `410` endpoint | row **pruned** — `{"count":1,"msg":"push: pruned expired subscriptions"}` |
| Earlier run, TLS error (transient) | **neither** row pruned — only 404/410 delete |
| Recipient with `friendCheckIn: false` | **zero delivery attempts** — nothing reached the receiver at all |

**Router**, against a production server:

| Check | Result |
|---|---|
| `notification.publicKey` | matches `WEB_PUSH_PUBLIC_KEY` in `.env` |
| `status` before / after subscribing | `{subscribed: false}` → `{subscribed: true}` |
| `subscribe` twice with the same endpoint | `200`, still **1 row** — upsert, not a duplicate |
| `subscribe` unauthenticated | `UNAUTHORIZED` |
| `unsubscribe` | `{removed: 1}`, 0 rows left |

**Not verified, and it is the whole point of the feature:** that a notification actually arrives on a
phone. That needs an installed PWA on a real iPhone, a real APNs endpoint, and Story 6.1's install path
working. Everything up to the push service is proven — recipient selection, preference filtering,
encryption, delivery attempt, status handling, pruning — but the last hop is untested, as is the browser
half (permission prompt, `pushManager.subscribe`, the worker rendering the notification).

## Files

| File | Change |
|---|---|
| `src/server/push/web-push.ts` | new — VAPID config, `sendToUsers`, `sendToCrewMembers`, pruning |
| `src/server/api/routers/notification-router.ts` | new — `publicKey`, `subscribe`, `unsubscribe`, `status` |
| `src/server/api/root.ts` | registers `notification` |
| `src/server/api/routers/check-in-router.ts` | notifies the crew on create/update/remove |
| `src/app/sw.ts` | `push` and `notificationclick` handlers |
| `src/components/NotificationPrompt.tsx` | permission + subscribe flow |
| `.env` | real VAPID keys |
