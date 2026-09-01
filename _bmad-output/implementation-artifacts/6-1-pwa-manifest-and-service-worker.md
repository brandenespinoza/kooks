# Story 6.1: PWA Manifest & Service Worker

Status: **done** (2026-09-01)
Epic: 6 — Push Notifications & PWA
NFRs: NFR-4 (installs to home screen), NFR-5 (iOS push constraint communicated without alarm)

## Story

As a user,
I want to install Kooks to my iPhone home screen from Safari so it opens full-screen like a native app
and can receive push notifications,
So that I don't have to open a browser tab every morning.

## Acceptance Criteria

1. **A service worker is generated at build time.**
2. **`public/manifest.json`** defines name, `display: standalone`, `start_url: "/"`, theme and
   background colours, and 192/512 icons; Safari offers "Add to Home Screen" and the installed app opens
   with no browser chrome.
3. **Installed, it launches standalone with the service worker active.**
4. **An inline `NotificationPrompt`** explains the iOS home-screen requirement during onboarding — no
   browser alert (NFR-5).
5. **Cache strategy:** static assets cache-first; `/api/trpc/*` and `/api/presence/stream` network-first
   with graceful stale fallback.

## Tasks

- [x] Generate 192/512/180px icons.
- [x] `public/manifest.json`; manifest + Apple metadata in `layout.tsx`.
- [x] `src/app/sw.ts` + `withSerwistInit` in `next.config.js`; generated `sw.js` gitignored.
- [x] `NotificationPrompt`, rendered in onboarding.
- [x] Fix the middleware matcher, which was redirecting the new icons.

## Dev Notes

**Serwist, not `@ducanh2912/next-pwa` (AC 1 deviation).** The AC names the package the architecture doc
chose; `@serwist/next` has been the installed one since Story 1.1 and CLAUDE.md already records the
divergence. Consequence for the AC's wording: serwist bundles everything into a single
`public/sw.js` — **there is no `workbox-*.js`**, and its absence is correct rather than a missing step.

**The presence stream is `NetworkOnly`, not network-first (AC 5 deviation).** An SSE response never
completes. A caching strategy would either hold the connection open forever waiting to store it or
replay a truncated stream on reconnect, and "network-first with stale fallback" on an infinite response
is not a thing that works. The rule exists precisely to stop the default handlers from claiming it.

**tRPC caching is GET-only.** `httpBatchStreamLink` sends queries as GET and mutations as POST; a
replayed POST would check someone in twice. Queries get `NetworkFirst` with a 5-second timeout, so a
dead spot in the car park shows the last known crew list instead of an error.

**The icons are generated, not drawn.** No image library is installed, so `public/icon-*.png` were
produced by a throwaway script writing PNG chunks directly with `node:zlib` — two parchment swell lines
on the navy `--action` ground, centred so a maskable crop cannot cut the subject. They are committed as
assets; the script is not part of the build.

**`src/app/sw.ts` is excluded from `tsconfig.json`, and so is `public/`.** The worker needs the
WebWorker lib, which collides with the DOM lib the app compiles against — the build compiles it, but
`npm run typecheck` does not. `public/` had to be excluded too: `tsconfig` includes `**/*.js` with
`checkJs`, so the *generated, minified* `sw.js` was type-checked and failed the build with
`Variable 'e' implicitly has type 'any'`.

**The service worker is disabled in development.** A worker caching a dev server makes every HMR update
a coin flip, and this project already distrusts `npm run dev` enough to verify against production builds
(replan correction 9).

## The middleware bug this story exposed

The icons answered **`307 → /join-required`** to any unauthenticated request. The matcher excluded PWA
assets by *name* — `favicon.ico`, `manifest.json`, `sw.js`, and a guessed-at `icons` directory — and the
new files landed at `/icon-192.png`, `/apple-touch-icon.png`. A browser fetching a manifest icon does
not follow a redirect to an HTML page, so **an installed app would have had no icon**, with nothing in
any log to say why.

The matcher now excludes any path with a static file extension rather than a list of filenames, so the
next asset cannot repeat it. Verified afterwards that `/` and `/settings` still redirect when signed out
and still serve when signed in — the guard did not get loosened by accident.

## Verification

`npm run typecheck` and `npm run build` pass; the build logs
`✓ (serwist) Bundling the service worker script with the URL '/sw.js'`.

| Check | Result |
|---|---|
| `/manifest.json` (signed out) | `200 application/json` — name, `standalone`, `/`, `#1a3a5c`, `#f5f0e8`, icons `192 any`, `512 any`, `512 maskable` |
| `/sw.js` (signed out) | `200 application/javascript`, 43KB |
| `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`, `/favicon.ico` | all `200 image/*` |
| `/` and `/settings` signed out | `307 → /join-required` |
| `/` signed in | `200` |
| Registration | `serviceWorker.register(...)` present in the client bundle — `@serwist/next` wires it, no manual registration component needed |
| Page `<head>` | `theme-color #1a3a5c`, `link rel=manifest`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style black-translucent`, `link rel=apple-touch-icon` |
| `sw.js` contents | contains the `/api/presence/stream` rule and the `kooks-trpc` cache name |

The 192px icon was rendered and inspected: two parchment swell lines on navy, legible at small sizes.

**Not verified:** anything that requires Safari on an iPhone — that "Add to Home Screen" appears, that
the installed app opens without chrome, that the status bar goes translucent behind the navy band, or
that the worker actually activates and serves from cache. This is the one story whose acceptance is
inherently device-bound, and the project has no device automation. **It needs a real-device pass before
Story 6.2 builds push on top of it** — push on iOS only works from an installed PWA, so an install that
does not work would make 6.2 untestable rather than merely unverified.

## Files

| File | Change |
|---|---|
| `public/manifest.json` | new |
| `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | new — generated |
| `src/app/sw.ts` | new — worker source, cache rules |
| `next.config.js` | `withSerwistInit` |
| `src/app/layout.tsx` | manifest link, Apple metadata, `themeColor` |
| `src/components/NotificationPrompt.tsx` | new — inline iOS install note |
| `src/components/OnboardingForm.tsx` | renders the prompt |
| `src/middleware.ts` | matcher excludes static assets by extension |
| `tsconfig.json` | excludes `src/app/sw.ts` and `public` |
| `.gitignore` | generated worker output |
