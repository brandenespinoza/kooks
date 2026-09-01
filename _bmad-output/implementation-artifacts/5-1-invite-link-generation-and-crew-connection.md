# Story 5.1: Invite Link Generation & Crew Connection

Status: **done** (2026-09-01)
Epic: 5 — Crew & Social Graph
FRs: FR-14, FR-16 (partial — visibility narrowing is 5.2)

## Story

As a user,
I want to share my invite link so a friend can join Kooks and immediately appear in my crew,
So that we can see each other's check-ins without texting back and forth.

## Acceptance Criteria

1. **No migration** — `CrewMember` and the mutual-pair creation shipped in Story 1.3.
2. **`crew.getInviteLink`** returns `/join/[user.inviteToken]`; the UI copies it to the clipboard and
   shows a success toast.
3. **A new user joining via the link** gets both `CrewMember` rows written — mutual immediately.
4. **An existing signed-in user tapping someone else's link** gets the mutual rows and lands on `/`
   without re-entering a display name.
5. **A user tapping their own link** creates nothing, sees no error, and lands on `/`.

## Tasks

- [x] `crew.getInviteLink` in `crew-router.ts`.
- [x] `src/components/InviteDrawer.tsx` — link display, copy, toast, fallback.
- [x] Invite affordance in the `CrewZone` header, wired through `BreakScreen`/`BreakSwipeStack`.
- [x] Verify ACs 3–5 against the real module rather than assuming 1.3 got them right.

## Dev Notes

**Three of the five ACs were already delivered by Story 1.3.** `joinViaInvite` already handles all three
join cases — new account, signed-in visitor, self-invite — and `JoinFlow` already auto-submits and
redirects for an authenticated visitor. This story therefore *verified* ACs 3–5 rather than building
them; see the table below. The sprint plan's "reduced" note was accurate.

**`getInviteLink` returns a path, not an absolute URL.** The origin is the browser's to supply via
`window.location.origin`. The alternatives were trusting the `Host` header or adding an `APP_URL` env
var — and a path composed client-side is correct in every deployment without either, which keeps
`src/env.js`, `.env.example` and the README untouched. The token comes off the session's user, so the
procedure runs no query.

**The invite affordance lives in the CrewZone header, not Settings (AC 2 deviation).** The AC says "the
user opens Settings", but the Settings screen is Story 5.3's deliverable and does not exist. The choice
was to ship the capability behind a screen that does not exist yet, or to give it an interim home beside
the two management icons already in that header. **Story 5.3 should absorb this drawer** when it builds
Settings.

**The URL is always visible, not hidden behind the button.** `navigator.clipboard` requires a secure
context, so on plain HTTP — or in any browser that refuses the permission — the copy fails and
long-pressing the visible text is the only way to get the link. The failure path says exactly that
rather than silently doing nothing.

**Nothing about this link is revocable.** `inviteToken` never rotates in V1 (already logged from Story
1.1), so anyone who has ever held it can still join the crew. That is the accepted V1 trade for a
crew of three who share it privately.

## Verification

`npm run typecheck` and `npm run build` pass.

**`joinViaInvite` semantics**, run against the real module with a temporary user
(`npx tsx --env-file=.env --conditions=react-server`):

| Case | Result |
|---|---|
| Signed-in user opens Sarah's link | `connectedTo: "Sarah"`; exactly **two** `crew_members` rows, both directions |
| Same link a second time | Same response, still exactly two rows — `createMany` + `skipDuplicates` holds |
| User opens **their own** link | `connectedTo: null`, no rows written, no error (AC 5) |
| Unknown token | `{ ok: false, error: "This invite link is not valid." }` |

**`crew.getInviteLink`**, against a production server:

- Authenticated → `{ inviteToken: "cmti19cd…", path: "/join/cmti19cd…" }`, matching the `users` row.
- Unauthenticated → `UNAUTHORIZED`.
- The returned path resolves: `/join/<token>` → `200`, `/join/bogus-token` → `404`.

**Not verified:** the clipboard copy and its fallback, which are browser-only behaviour — no browser
automation, the standing gap since Story 2.1.

## Files

| File | Change |
|---|---|
| `src/server/api/routers/crew-router.ts` | `getInviteLink` |
| `src/components/InviteDrawer.tsx` | new — link, copy, fallback |
| `src/components/CrewZone.tsx` | invite affordance in the header |
| `src/components/BreakScreen.tsx` / `BreakSwipeStack.tsx` | wiring, drawer mounting |
