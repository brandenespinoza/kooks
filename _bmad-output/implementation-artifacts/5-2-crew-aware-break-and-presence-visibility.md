# Story 5.2: Crew-Aware Break & Presence Visibility

Status: **done** (2026-09-01)
Epic: 5 — Crew & Social Graph
FRs: FR-16
NFRs: NFR-7 (no friend-of-friend visibility)

## Story

As a user,
I want to see Breaks created by my crew and see their check-ins on those Breaks,
So that the social layer actually works across the whole crew — not just for the user who created the
Break.

## Acceptance Criteria

1. **`assertCrewMember` is real** and throws `FORBIDDEN` for a user with no crew connection to the
   Break's creator.
2. **`break.list` returns crew-visible Breaks**, and a Break a crew member creates becomes visible
   within 5 seconds.
3. **Only users sharing a direct crew connection with the check-in's author receive its SSE event** —
   no cross-crew leakage (NFR-7).
4. **A new crew connection notifies both parties' open streams** so the screen updates without a
   refresh.

## Tasks

- [x] Verify `assertCrewMember` (shipped in 1.3) rather than rebuild it.
- [x] Widen `break.list` to every visible Break, flagged with `isSaved`; fold in `break.crewBreaks`.
- [x] Scope check-ins to the caller's crew in both `break.list` and the SSE route.
- [x] `crew.joined` event, emitted from `connectCrew`, handled by the stream.
- [x] `BreaksDrawer` and `BreakSwipeStack` read the single widened query.
- [x] `EmptyBreaksState` gains a route to the crew's Breaks.

## Dev Notes

**The swipe stack is still saved Breaks only (AC 2 deviation).** The AC says `break.list` should return
crew Breaks and that they become "visible in the requesting user's swipe stack". The PRD says otherwise,
twice: FR-2 swipes between "their **saved** Breaks", and FR-4b's testable consequence is that unsaving
"removes it from the user's swipe stack". Auto-filling the stack with every crew Break would make
`break.save`/`unsave` — shipped and signed off in Story 2.3 — meaningless. So the query widens to
everything visible, `isSaved` marks what belongs in the stack, `BreakSwipeStack` filters on it, and the
drawer's discovery list reads the same rows. That is what folding `break.crewBreaks` into `break.list`
was actually asking for, and `break.crewBreaks` is now deleted.

**"or saved by any direct crew member" is deliberately not implemented.** A Break your friend *saved*
but did not create belongs to a stranger — surfacing it is friend-of-friend access, which NFR-7 forbids
in the same story. `assertCrewMember` already refuses those Breaks, so returning them would produce rows
that every subsequent procedure rejects. Visibility in `list` is now exactly `assertCrewMember`'s rule
in list form.

**Presence is scoped to people, not places — this was the real work.** Break visibility and presence
visibility are different questions, and conflating them leaks. Two crew members can share a Break
without sharing a connection: if Reef created a Break, and both Sarah and a third person are Reef's
crew but not each other's, then Sarah could previously see that person's check-in — textbook
friend-of-friend leakage. Both layers now filter on `listCrewUserIds`:

- `break.list` returns only check-ins authored by the caller or their direct crew.
- The SSE route drops any `checkIn.*` event whose `payload.userId` is outside that set, and an event
  arriving without a `userId` is dropped rather than forwarded on the assumption that it is safe.

**`crew.joined` is the first event that is not about a Break.** `PresenceEvent.breakId` is therefore
`string | null` — null for this one type. It reaches only the two people it connected, and on arrival
the stream rebuilds *both* its sets before telling the client to refetch, so a new crew member's Breaks
and check-ins appear without a refresh (AC 4). It fires only when the pair is genuinely new: re-tapping
an invite link, or tapping your own, wakes nobody.

**The empty state was a dead end for exactly the person the invite flow brings in.** Someone who has
just joined a crew has no saved Breaks, so they saw `EmptyBreaksState` — whose only action was "add a
break" — while the route to their crew's Breaks sat in a drawer behind the CrewZone header that this
state replaces. It now offers "See your crew's N breaks" when there are any.

## Verification

`npm run typecheck` and `npm run build` pass.

The crew graph was set up to create the exact case NFR-7 forbids: **Reef ↔ Sarah** and **Reef ↔
Outsider**, with Sarah and Outsider *not* connected, and a Break created by Reef that both can see.
Outsider then checked in at that Break.

| Check | Result |
|---|---|
| Reef's stream (crew with Outsider) | `data: {"type":"checkIn.created","breakId":"brk_reef"}` |
| **Sarah's stream** (not crew with Outsider) | **nothing** — the event never left the filter |
| `break.list` as Sarah | sees `Reef Point` with `isSaved=false` and **`checkIns=[]`** |
| `break.list` as Reef | sees `Reef Point` with `checkIns=['Outsider']`, and Sarah's check-in at Bogue |
| `break.crewBreaks` | `NOT_FOUND — No procedure found on path "break.crewBreaks"` |

So the Break is visible to Sarah (Reef created it) while the check-in on it is not — visibility and
presence resolved separately, which is the whole point of the story.

**`crew.joined` emission**, with a listener attached in-process
(`npx tsx --env-file=.env --conditions=react-server`):

- First join of a new pair → **1** event, `{"type":"crew.joined","breakId":null,"payload":{"userIds":[…]}}`
- Same link again → still 1 (no event for a duplicate pair)
- Own invite link → still 1 (no event, no rows)

**Not verified:** delivery of `crew.joined` through a live stream. Triggering it in-process needs the
join Server Action, which is browser-driven — a separate process's emit cannot reach the server's
listeners. The emit and the route's handling are each verified in isolation; the seam between them is
not. Also unverified in a browser: the widened drawer and the new empty-state action.

## Files

| File | Change |
|---|---|
| `src/server/api/routers/break-router.ts` | widened `list`, crew-scoped check-ins, `crewBreaks` deleted |
| `src/server/auth/assert-crew-member.ts` | adds `listCrewUserIds` |
| `src/server/auth/join.ts` | emits `crew.joined` on a genuinely new pair |
| `src/server/events.ts` | `crew.joined`; `breakId` is now `string \| null` |
| `src/app/api/presence/stream/route.ts` | presence scoping, `crew.joined` handling, shared refresh |
| `src/components/BreaksDrawer.tsx` | one query, split by `isSaved` |
| `src/components/BreakSwipeStack.tsx` | stack filters on `isSaved` |
| `src/components/EmptyBreaksState.tsx` | optional route to the crew's Breaks |
