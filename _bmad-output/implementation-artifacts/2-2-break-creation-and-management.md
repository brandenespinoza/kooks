# Story 2.2: Break Creation & Management

Status: done

## Story

As a user,
I want to create a Break by dropping a pin on a map and entering a label, delete Breaks I've created, and designate one as my Home Break,
so that I can define my surf spots and tell Kooks where to send my dawn patrol alerts.

## Acceptance Criteria

1. No migration task — `Break` and `UserSavedBreak` already exist. `break.delete` must null `homeBreakId` on every `User` pointing at the deleted Break
2. Interactive Leaflet map (OpenStreetMap tiles, no API key); tapping drops a pin and captures lat/lng
3. Pin + non-empty label + confirm -> `Break` row created, `UserSavedBreak` links it to the creator, appears in the swipe stack immediately
4. The user's first Break is automatically designated Home Break
5. Deleting a Break you created removes it and its `UserSavedBreak` and `CheckIn` rows
6. `break.setHomeBreak` updates `homeBreakId`; only one Home Break at a time; visually distinguished in the swipe stack

## Tasks / Subtasks

- [x] Task 1: `leaflet`, `react-leaflet`, `@types/leaflet` (AC 2)
- [x] Task 2: `break.create` with first-break-is-home logic (AC 3, 4)
- [x] Task 3: `break.delete` with `homeBreakId` cleanup (AC 1, 5)
- [x] Task 4: `break.setHomeBreak` (AC 6)
- [x] Task 5: `BreakMap` — dynamic, `ssr: false` (AC 2)
- [x] Task 6: `AddBreakDrawer` (AC 2, 3)
- [x] Task 7: `BreaksDrawer` — set home + delete (AC 5, 6)
- [x] Task 8: Home Break chip in `VerdictBand`; add/manage affordances in `CrewZone` (AC 6)
- [x] Task 9: `npm run typecheck`, `npm run build`, browser verification

## Dev Notes

### Leaflet under the App Router

`BreakMap` is loaded through `next/dynamic` with `ssr: false` — Leaflet reads `window` at import time and throws during server rendering. Leaflet is code-split into its own chunk, so the ~150kB library is not in the initial bundle for a user who never opens the Add flow.

The stock Leaflet marker is a PNG resolved from a relative path that bundlers rewrite, which is why it renders broken in most React setups. A `divIcon` sidesteps the asset pipeline entirely and lets the pin use the Morning Light navy.

### Two vaul drawers cannot hand off to each other

The manage drawer originally contained an "Add a break" button that closed itself and opened the Add drawer. The second drawer never became visible — vaul does not handle a close/open crossfade, and `onAnimationEnd` was not a reliable handoff either. The add affordance now lives on the Break screen itself as a "+" next to the manage button: one tap instead of two, and only one drawer is ever involved. Worth remembering for the `CheckInDrawer` in Epic 4.

### Toasts moved to top-center

Sonner's default bottom placement sat directly on top of the drawer list — the second break was completely hidden behind "Second Spot added". Every interactive surface in this app is a bottom sheet, and Epic 4 adds the check-in CTA at the bottom too, so toasts belong at the top.

### `break.delete` is creator-only, and does not use `assertCrewMember`

`assertCrewMember` grants access to any crew member, which is the right rule for *reading* a Break but wrong for deleting one — FR-3 says "a Break they created". Deletion checks `createdById` directly. `setHomeBreak` does call `assertCrewMember`, then additionally requires the Break to be in the caller's own saved list.

`CheckIn` and `UserSavedBreak` cascade from the Break's foreign keys. `User.homeBreakId` does not, because it is deliberately not a foreign key, so `delete` clears it in the same transaction.

### SSE events are emitted with nothing listening

`break.created` and `break.deleted` are emitted on the singleton emitter after the DB write (rule 5). No SSE route exists until Story 4.2, so these are currently no-ops — emitting now means 4.2 works without revisiting these mutations, rather than leaving a "remember to come back" landmine.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

`npm run typecheck` exit 0. `npm run build` exit 0. Leaflet confirmed code-split into its own chunk.

Driven end-to-end in Chrome **against a production build** (`npm run build && npm start`) at 390x844 — the dev server proved too unstable to test against after repeated HMR cycles, with response times degrading to 10-25s and results varying run to run:

```
PASS  AC5 empty state for a new user
PASS  AC2 Leaflet renders OSM tiles
PASS  AC2 no pin before tapping
PASS  AC2 tap drops a pin
PASS  AC2 lat/lng captured — "PIN AT 34.6648, -77.0696"
PASS  AC2 marker rendered at the pin
PASS  AC3 break appears in the stack immediately
PASS  AC4 first break auto-set as Home Break
PASS  second Add drawer opens from the Break screen
PASS  AC6 exactly one Home Break after two creates
PASS  AC6 Home Break moved to Second Spot
PASS  AC6 still exactly one Home Break
PASS  AC5 deleted break removed from the list
```

Database state confirmed independently after the run: two Breaks created, one deleted, one remaining, correct owner — the DOM count alone was not trustworthy because Sonner renders toasts as `<li>` and inflated it.

**Bug found and fixed mid-story: onboarding had never worked in a browser.** See the Story 1.3 addendum below.

### Completion Notes List

All 6 ACs met and verified against a production build.

Two things this story changed outside its own scope, both because they were blocking:

1. **Onboarding moved from a tRPC mutation to a Server Action** — Story 1.3's `crew.joinViaInvite` created the account but the session cookie never reached the browser. Details in the addendum below.
2. **Toaster repositioned** — it was occluding drawer content.

The dev server's instability under sustained HMR is worth noting for future stories: verify UI work against `npm run build && npm start`, not `npm run dev`.

### File List

- `src/server/api/routers/break-router.ts` — MODIFIED — `create`, `delete`, `setHomeBreak`; `list` now returns lat/lng, `isMine`, `isHomeBreak`
- `src/components/BreakMap.tsx` — CREATED — Leaflet map, `divIcon` pin
- `src/components/AddBreakDrawer.tsx` — CREATED — map + label + confirm
- `src/components/BreaksDrawer.tsx` — CREATED — set home / delete
- `src/components/VerdictBand.tsx` — MODIFIED — Home Break chip
- `src/components/CrewZone.tsx` — MODIFIED — add ("+") and manage affordances
- `src/components/BreakScreen.tsx` — MODIFIED — drawer state; mounts only the open drawer
- `src/app/layout.tsx` — MODIFIED — `Toaster position="top-center"`
- `package.json` — MODIFIED — `leaflet`, `react-leaflet`, `@types/leaflet`

---

## Addendum: Story 1.3 correction — onboarding could never set a cookie

Found while trying to onboard a test user through the real UI rather than curl.

`crew.joinViaInvite` created the `User`, `NotificationPref`, `Session` and crew pair, returned 200 — and the browser received **no `Set-Cookie` header**. Every real signup silently orphaned an account and bounced the person to `/join-required`.

Two separate reasons, both invisible to the curl test used in Story 1.3:

1. The client uses `httpBatchStreamLink`, so response headers are flushed *before* a procedure resolves. Anything appended to `ctx.resHeaders` inside a mutation is written to an object that has already been sent.
2. Switching to `cookies().set()` from `next/headers` did not help either: tRPC's fetch handler builds its own `Response`, bypassing Next's cookie collection.

**A tRPC procedure cannot reliably set a cookie in this app.** Story 1.3's AC — "the form submits via the `crew.joinViaInvite` tRPC public procedure" — was not implementable as written.

Resolution: the join logic moved to `src/server/auth/join.ts` (transport-agnostic, returns the token rather than setting it) and is invoked from a Server Action at `src/app/join/[inviteToken]/actions.ts`, which is the supported place to set cookies and works regardless of tRPC transport. `crewRouter` keeps only `me`.

Verified in a browser: cookie present with the correct attributes, lands on `/`, empty state renders.

**Process lesson.** Story 1.3 was marked done on the strength of a curl test that exercised the transport differently from the real client. That is the second bug in this project to survive verification because the check was made one layer below where the bug lived — the first was Inter never rendering, verified by reading compiled CSS instead of computed style. Verify at the layer the user actually meets.
