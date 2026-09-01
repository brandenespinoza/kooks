# Story 5.3: Crew Management & Settings Screen

Status: **done** (2026-09-01)
Epic: 5 — Crew & Social Graph — **complete**
FRs: FR-17 (plus FR-14's UI home, and sign-out, deferred here from Story 1.3)

## Story

As a user,
I want to view my crew, remove a member if needed, and manage my Breaks and invite link from a single
Settings screen,
So that I have full control over my Kooks setup without hunting through the app.

## Acceptance Criteria

1. **`/settings` shows four sections** — Breaks, Crew, Notifications (placeholder), Invite Link.
2. **`crew.remove`** deletes both `CrewMember` rows, the member leaves both users' crew lists, and SSE
   streams update so check-ins stop crossing the severed connection.
3. **Break delete/unsave** is surfaced here using the existing mutations, not reimplemented.
4. **Copy invite link** uses the same `crew.getInviteLink` query as Story 5.1, different surface.

## Tasks

- [x] `crew.list` and `crew.remove`; `crew.removed` presence event.
- [x] `/settings` route + `SettingsScreen` with five sections.
- [x] `SettingsBreaks`, `SettingsCrew`, `SettingsInvite`, `SettingsNotifications`.
- [x] Sign-out Server Action (the Story 1.3 deferral).
- [x] Retire `BreaksDrawer` and `InviteDrawer`; point the CrewZone header at `/settings`.

## Dev Notes

**Both drawers are gone, not duplicated.** `InviteDrawer` was Story 5.1's explicitly interim home, and
`BreaksDrawer` offered the same four mutations Settings now does. Keeping either would leave two
surfaces for one set of actions — the thing "a single Settings screen" exists to prevent. Their contents
became `SettingsInvite` and `SettingsBreaks`; the mutations are untouched. **Adding a Break stays on the
Break screen**: it is the one action you want one tap from what you are looking at, and it was never in
the drawer anyway (two vaul roots at once is the bug from 2.2).

**The CrewZone header is now "+" and a gear.** Three icons plus a label was already tight at 430px.

**`crew.remove` deletes both directions, always.** The pair is written mutually on join, so deleting one
row would leave the other person still seeing you — a one-sided connection nothing else in the app
models. Verified: after one call, `crew_members` went from 2 rows to 0.

**Removal severs presence, not places.** Saved Breaks are deliberately untouched. `listCrewUserIds`
stops including the removed person, so neither side sees the other's check-ins — but a Break you saved
is a spot you surf, not a friendship, and `assertCrewMember`'s third rule keeps it reachable on purpose.
This answers the question Story 5.2 left open.

**`crew.removed` is the mirror of `crew.joined`.** Both are events about two people rather than a place,
both carry `breakId: null`, and the stream handles them in one branch: rebuild both sets, then tell the
client to refetch. Joining widens what you can see; removal narrows it. Without this, an open connection
would keep forwarding a former crew member's check-ins until it reconnected.

**Sign-out is a Server Action, and it deletes the session row.** A tRPC procedure cannot clear a cookie
in this app (`httpBatchStreamLink` flushes headers before a procedure resolves), which is the same
constraint that moved onboarding to an action in 2.2. Clearing only the cookie would leave a valid token
in the database — and V1 sessions never expire, so it would be valid forever. It is a plain `<form
action={...}>`, so it works without JavaScript.

**Notification toggles render disabled rather than hidden.** Every user already has a `NotificationPref`
row with all three defaulting to on, so showing them states what the app is currently entitled to do.
Nothing here writes; Story 6.4 wires them.

**Settings owns its own safe-area insets.** `layout.tsx` has none on purpose so the navy `VerdictBand`
can paint behind the status bar (UX-DR1) — every top-level page has to declare its own.

## Verification

`npm run typecheck` and `npm run build` pass; `/settings` builds as a dynamic route.

| Check | Result |
|---|---|
| `/settings` with a session | `200` |
| `/settings` without one | `307` → `/join-required` |
| `crew.list` | `[{ id: …, displayName: "Reef" }]` |
| `crew.remove` | `200`, and the open stream received `data: {"type":"crew.removed","breakId":null}` |
| `crew_members` after removal | **0 rows** — both directions gone from one call |
| `crew.remove` again | `NOT_FOUND` — "That person isn't in your crew." |
| `crew.remove` on yourself | `BAD_REQUEST` — "You can't remove yourself from your own crew." |
| Sign-out's session deletion | session present → `deleteSession` → absent, via the real helper |

The crew pair was restored afterwards, so the dev fixtures are unchanged.

**Not verified:** the sign-out round trip through a browser (the cookie clear and the redirect are
Server Action behaviour), and every screen's rendering — no browser automation, the standing gap since
Story 2.1. The session-row half of sign-out, which is the part with a security consequence, *is*
verified.

## Files

| File | Change |
|---|---|
| `src/app/settings/page.tsx` | new — route + auth guard |
| `src/app/settings/actions.ts` | new — sign-out Server Action |
| `src/components/SettingsScreen.tsx` | new — shell and sections |
| `src/components/SettingsBreaks.tsx` | new — lifted from `BreaksDrawer` |
| `src/components/SettingsCrew.tsx` | new — crew list + remove |
| `src/components/SettingsInvite.tsx` | new — lifted from `InviteDrawer` |
| `src/components/SettingsNotifications.tsx` | new — disabled placeholders |
| `src/server/api/routers/crew-router.ts` | `list`, `remove` |
| `src/server/events.ts` | `crew.removed` |
| `src/app/api/presence/stream/route.ts` | handles `crew.removed` alongside `crew.joined` |
| `src/components/CrewZone.tsx` | header is now "+" and a Settings link |
| `src/components/BreakScreen.tsx` / `BreakSwipeStack.tsx` | drawer props and mounts removed |
| `src/components/EmptyBreaksState.tsx` | crew-breaks route links to `/settings` |
| `src/components/BreaksDrawer.tsx`, `InviteDrawer.tsx` | **deleted** |
