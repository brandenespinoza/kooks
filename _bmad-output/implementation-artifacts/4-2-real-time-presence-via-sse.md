# Story 4.2: Real-Time Presence via SSE

Status: **done** (2026-09-01)
Epic: 4 — Check-In & Real-Time Presence
FRs: FR-11 (partial — edit/remove land in 4.3)
NFRs: NFR-2 (visible within 5 seconds), NFR-7 (no cross-crew leakage)

## Story

As a user,
I want to see a crew member's check-in appear on my Break screen within 5 seconds of them checking in —
without refreshing,
So that I know in real time whether my people are going.

## Acceptance Criteria

1. **The route exists** at `src/app/api/presence/stream/route.ts` with `export const dynamic = 'force-dynamic'`, serves `text/event-stream`, requires a valid session, and holds the connection open.
2. **A `checkIn.created` emit reaches open connections within 5 seconds** (NFR-2).
3. **The client opens the stream on mount** and invalidates the presence query on each event, re-rendering `CrewZone`.
4. **Unmounting closes the connection** and removes the server-side `emitter` listener.
5. **Connection validation** — the AC allows a cookie-presence check, deferring crew-scoping to Epic 5.

## Tasks

- [x] `src/app/api/presence/stream/route.ts` — session check, crew-scoped filter, heartbeat, cleanup.
- [x] `PRESENCE_EVENT_TYPES` exported from `events.ts` so the route registers every listener.
- [x] `listVisibleBreakIds` in `assert-crew-member.ts` — the set form of the same access rule.
- [x] `src/lib/use-presence-stream.ts` — one connection, invalidate on event and on reconnect.
- [x] `BreakSwipeStack` invalidates `break.list` on every event.
- [x] Verify: auth, headers, latency, move semantics, and both halves of crew scoping.

## Dev Notes

**One connection per client, not per Break screen (AC 3 deviation).** The AC has `BreakScreen` opening
`?breakId=[id]`, but every panel in the swipe stack is mounted at once, so that reading means N
long-lived connections against a browser's ~6-per-origin limit. The stream is scoped to every Break the
caller can see instead, and `BreakSwipeStack` owns it — the same "rule moves up one level" as the tRPC
caller in Story 2.3, for the same reason. `BreakScreen` stays presentational.

**Crew-scoped now, not in Epic 5 (AC 5 deviation).** The AC permits a bare cookie check because
`assertCrewMember` was meant to be a stub through Epic 4. It has been real since Story 1.3 (replan
correction 1), so `listVisibleBreakIds` filters events here. Epic 5 has nothing left to do on this
route, and the weaker version never shipped.

**SSE carries the signal, tRPC carries the data.** A frame is `{type, breakId}` and nothing else — no
names, no ETAs. The client invalidates `break.list` and refetches through the procedure that already
authorizes it, so the stream cannot become a second, weaker read path.

**A `break.created` miss re-resolves the visible set.** The set is built at connect, so a Break created
*afterwards* can never be in it — which would make `break.created` an event nobody ever receives,
including its own creator. On that one event type, a miss re-runs `listVisibleBreakIds` and rebuilds the
set (rebuild, not append, so access that has been *lost* also stops being forwarded). Check-in events
keep the plain Set lookup. Proven: the outsider's own `break.created` arrives only via this path.

**`X-Accel-Buffering: no` is load-bearing in production.** Nginx buffers proxied responses by default,
which would hold frames until a buffer fills — NFR-2 would pass locally and fail behind Nginx Proxy
Manager. The 25-second heartbeat comment exists for the same environment: idle upstream connections get
dropped.

**Cleanup runs from two paths and must be idempotent.** `ReadableStream.cancel` does not fire for every
disconnect, so the request's abort signal is wired up as well; both call the same guarded `cleanup`.

**Reconnects are self-healing.** The stream has no `Last-Event-ID` replay, so anything emitted while a
client was disconnected is simply missed. `EventSource.onopen` therefore triggers the same invalidation
as a message — a reconnecting client refetches and is immediately correct again.

## Verification

`npm run typecheck` and `npm run build` pass. Against a production server and local Postgres:

- **Auth:** no cookie → `401`. Valid cookie → `200` with `content-type: text/event-stream`,
  `cache-control: no-cache, no-transform`, `x-accel-buffering: no`.
- **Latency (NFR-2):** `checkIn.create` POSTed at `16:16:17.123`; frames arrived at `.150` and `.152` —
  **~29ms**, against a 5-second budget.
- **Move semantics from 4.1 land on the wire:** one mutation produced
  `{"type":"checkIn.removed","breakId":"brk_bogue"}` *and*
  `{"type":"checkIn.created","breakId":"brk_thepoint"}`.
- **Crew scoping, both halves.** A second user with no `crew_members` rows was created directly in the
  database. Their `break.create` arrived on **their own** stream (positive control) and **never** on the
  other user's (negative control), whose stream showed only their own check-in.

**Not verified:** the client hook — `EventSource` reconnect, unmount close, and the catch-up refetch are
browser behaviour and this project has no browser automation. Server-side listener removal is likewise
not externally observable; it is exercised by the same `cleanup` the abort path uses.

### A testing note worth keeping

Two separate false negatives came out of the harness, not the code, and both looked exactly like a
broken feature:

1. **A race.** Background `curl -N` streams had not finished connecting when the mutation fired, so
   events were emitted to zero listeners. Instrumenting the emit printed `listeners: 0` — which reads
   as "the event system is broken" and is really "the client is not there yet". **Gate on the stream
   actually being open before triggering anything.**
2. **A hung readiness gate.** `timeout 10 sh -c "tail -f file | grep -q -m1 connected"` never returns:
   `grep -q` exits on match but `tail -f` keeps the pipeline alive until it next writes, so the shell
   waits and `timeout` kills it. The gate reported failure while the stream was open the whole time.

Both were only settled by instrumenting the emitter's identity and listener counts at both ends. When a
result contradicts code you have read carefully, suspect the harness before the code.

## Files

| File | Change |
|---|---|
| `src/app/api/presence/stream/route.ts` | new — the SSE endpoint |
| `src/server/events.ts` | exports `PRESENCE_EVENT_TYPES` |
| `src/server/auth/assert-crew-member.ts` | adds `listVisibleBreakIds` |
| `src/lib/use-presence-stream.ts` | new — one connection, invalidate on event and reconnect |
| `src/components/BreakSwipeStack.tsx` | subscribes, invalidates `break.list` |
