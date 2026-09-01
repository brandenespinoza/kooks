# Story 4.1: Check-In Creation & CrewZone UI

Status: **done** (2026-09-01)
Epic: 4 — Check-In & Real-Time Presence
FRs: FR-10
UX: `CheckInCTA`, `CheckInDrawer`, `ETAPicker`, `CrewMemberRow`, `EmptyCrewState` (reused from 2.1)

## Story

As a user,
I want to tap "I'm in", set my ETA, and immediately see my name appear in the crew list on the Break
screen,
So that I can declare my intent to surf with one satisfying action.

## Acceptance Criteria

1. **No migration.** `check_ins` already exists with `eta`, the unique `user_id` constraint (FR-10) and
   indexes on `break_id` and `eta`.
2. **Tapping the CTA opens the drawer** with a drag handle, the Break name as header, and the
   `ETAPicker` pre-set to the next 15-minute increment.
3. **The picker shows 15-minute slots from 5:00am to 10:00am**, snaps to the nearest, supports momentum.
4. **Confirming calls `checkIn.create`**, writes the row, closes the drawer, and the user's row appears
   in the `CrewZone`.
5. **A checked-in user sees the confirmed CTA** — "✓ You're in at [time] · Edit", `--present` border on
   `--surface` — and their own row renders in `--present`.
6. **Each `CrewMemberRow`** shows an 8px `--present` dot, name at 16px/700, ETA at 13px/400/secondary,
   min-height 48px, and `aria-label="[Name] is going at [time]"`.
7. **No check-ins renders `EmptyCrewState`.**

## Tasks

- [x] `check-in-router.ts` — `checkIn.create`, registered in `root.ts`.
- [x] `break.list` carries each Break's check-ins with an `isMe` flag.
- [x] `CrewMemberRow.tsx`, `CheckInCTA.tsx`, `ETAPicker.tsx`, `CheckInDrawer.tsx`.
- [x] `CrewZone.tsx` renders the list and the CTA; `BreakScreen`/`BreakSwipeStack` wire them up.
- [x] Verify: `npm run typecheck`, `npm run build`, live mutation + ETA logic checks.

## Dev Notes

**`checkIn.create` is an upsert, not a create.** `CheckIn.userId` is `@unique` — one active check-in per
user is a schema invariant — so a literal create would throw a constraint error the second time, and
AC 5's "· Edit" affordance would be a button that always fails. Confirming from a different Break
therefore **moves** the check-in, which is the only reading of FR-10 that leaves the user somewhere
sensible. Story 4.3's `checkIn.update` may well collapse into this.

**Moving emits two events.** The mutation reads the existing row before writing so it can emit
`checkIn.removed` to the *old* Break as well as `checkIn.created` to the new one — otherwise the Break
you left keeps showing you as coming. Editing the time at the same Break emits `checkIn.updated`.
Nothing listens yet; Story 4.2 adds the SSE route and these events start mattering without revisiting
this mutation.

**The drawer says when it is about to move you.** Moving a check-in silently would be the kind of thing
someone discovers two hours later at the wrong beach. When the caller is checked in elsewhere, the
sheet carries one line: "This moves your check-in from [Break]."

**The crew list rides on `break.list`.** Same reasoning as `rawData` and `webcamUrl` in Epic 3 —
`BreakSwipeStack` is the single tRPC caller for this subtree, and a per-panel presence query would be N
round trips for a list of at most a handful of rows. `isMe` is computed server-side so the client never
needs to know its own user id.

**The ETA wheel is native scroll-snap.** Same call `BreakSwipeStack` made for swipe: momentum,
rubber-banding and trackpad support come from the platform, and the selected slot falls out of
`scrollTop / ITEM_HEIGHT` rather than pointer bookkeeping. Selection commits 80ms after scrolling
settles, so dragging past ten slots fires one selection, not ten.

**Semantics are a radio group with a roving tabindex.** 21 slots as 21 tab stops would make keyboard
users pay for a touch affordance; one tab stop plus Arrow Up/Down is the standard pattern and announces
as a single control.

**Slots roll forward to tomorrow when the time has passed.** Picking "5:00am" at 8pm resolves to
tomorrow, not to a time fifteen hours in the past that the server would reject — and 8pm is exactly
when someone plans a dawn patrol. Verified across five clock positions.

**Server-side ETA bounds.** Not in the past (60s of slack for a slow tap on the current slot) and not
more than 24 hours out. The client can only offer valid slots; the procedure does not assume the client.

**The Remove link is deliberately absent** from the drawer. It belongs there, but it arrives with
`checkIn.remove` in Story 4.3 rather than shipping now as a control that cannot do anything.

## Verification

`npm run typecheck` and `npm run build` pass.

**ETA logic**, run against the real module (`npx tsx verify-eta.tmp.ts`, since deleted):

| now | default slot | resolves to |
|---|---|---|
| 4:30 am | 5:00 am | today |
| 6:05 am | 6:15 am | today |
| 9:50 am | 10:00 am | today |
| 11:00 am | 5:00 am | **tomorrow** |
| 8:00 pm | 5:00 am | **tomorrow** |

21 slots, 5:00 am through 10:00 am inclusive.

**Mutation**, against a production server and local Postgres with a live session cookie:

- Create at The Point → row returned, appears in `break.list` under The Point with `isMe: true`.
- Create at Bogue Inlet Pier → **same check-in id**, now at Bogue; The Point's list is empty. One row in
  `check_ins`, no constraint error.
- Past ETA → `BAD_REQUEST`, "That time has already passed."

**Not verified:** the drawer, the CTA states and the wheel's scroll behaviour were not exercised in a
browser — no test runner, no browser automation (the gap is logged from Story 2.1). The markup carries
the required `aria-label`s, `role="radiogroup"`/`radio`, 48px targets and focus handling via vaul.

**Note for the tsx verification trick:** `--conditions=react-server` is needed for *server* modules
(`server-only` throws without it) but must be **omitted** for client components — React's react-server
build has no `useState`/`useEffect`.

## Files

| File | Change |
|---|---|
| `src/server/api/routers/check-in-router.ts` | new — `checkIn.create` (upsert + move events) |
| `src/server/api/root.ts` | registers `checkIn` |
| `src/server/api/routers/break-router.ts` | `break.list` carries `checkIns` with `isMe` |
| `src/components/CrewMemberRow.tsx` | new — presence row + `formatEta` |
| `src/components/CheckInCTA.tsx` | new — both CTA states |
| `src/components/ETAPicker.tsx` | new — scroll-snap wheel, slot maths |
| `src/components/CheckInDrawer.tsx` | new — bottom sheet + mutation |
| `src/components/CrewZone.tsx` | renders the crew list and the CTA |
| `src/components/BreakScreen.tsx` / `BreakSwipeStack.tsx` | wiring, drawer mounting |
