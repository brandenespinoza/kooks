# Story 4.3: Edit, Remove & Auto-Expiry

Status: **done** (2026-09-01)
Epic: 4 — Check-In & Real-Time Presence — **complete**
FRs: FR-11, FR-12, FR-13

## Story

As a user,
I want to update my ETA, cancel my check-in, and know that stale check-ins disappear automatically,
So that the presence layer stays accurate without anyone having to clean it up manually.

## Acceptance Criteria

1. **Edit mode** — tapping the checked-in CTA opens the drawer with the `ETAPicker` on the current ETA
   and a "Remove check-in" link in `--text-secondary`.
2. **`checkIn.update`** changes the row, the CTA and row reflect the new time, and `checkIn.updated`
   propagates over SSE.
3. **`checkIn.remove`** deletes the row, the CTA reverts to "I'm in", and `checkIn.removed` propagates.
4. **`checkin-expiry`** runs every 5 minutes, deletes check-ins where `eta + 2 hours < now()`, and emits
   `checkIn.removed` for each.
5. **An expired check-in disappears** from every CrewZone with no user action.
6. **The CTA state change respects `prefers-reduced-motion`.**

## Tasks

- [x] `checkIn.update` and `checkIn.remove` in `check-in-router.ts`.
- [x] `src/server/jobs/check-in-jobs.ts` — `checkin-expiry` queue, cron, sweep.
- [x] Registered in `registerJobs` in `src/server/jobs/index.ts`.
- [x] `CheckInDrawer` — update on edit, Remove link.
- [x] `CheckInCTA` — explicit `motion-reduce` handling.
- [x] Verify: mutations, error paths, expiry boundary, in-process SSE emit from the job.

## Dev Notes

**`update` is not redundant with 4.1's upsert, and the difference is the point.** The sprint plan flagged
that `create` already upserts. `update` **refuses to create**: editing is reached from the "You're in
at … · Edit" CTA, and a missing row there means the check-in expired or was removed on another device.
Recreating it silently would put someone back on a beach they had already left. `create` still handles
the move-between-Breaks case, where creating is exactly right. The client picks by whether it is editing
an existing check-in at this Break.

**`remove` is keyed on `userId`, not a check-in id.** One active check-in per user is the schema
invariant, so there is nothing to disambiguate — and nothing another user could name.

**Expiry deletes rather than filtering on read.** A "hide rows older than X" read filter would have to be
repeated in `break.list`, in the SSE scoping, and in every future push job, and forgetting it in one
place is a silent bug. One scheduled delete, and the row is genuinely gone.

**The sweep reads before it deletes.** `deleteMany` alone would not yield the `breakId`s the SSE events
need, and every open Break screen would keep showing people who are no longer coming until the next
refetch. It then deletes **by id**, not by re-running the time filter, so a row that arrived between the
read and the write is not this sweep's business.

**No confirmation on Remove.** The cost of a mistap is one more check-in, and a second overlay inside a
vaul drawer is precisely the pattern that broke the Add flow in Story 2.2.

**Reduced motion is stated on the element.** `motion-reduce:transition-none` rather than relying on the
global duration clamp in `globals.css` — the AC asks for an instant transition, so the element says so.

## Verification

`npm run typecheck` and `npm run build` pass. Against a production server, local Postgres and a live SSE
stream:

| Check | Result |
|---|---|
| `checkIn.update` | 200, new ETA; `data: {"type":"checkIn.updated","breakId":"brk_thepoint"}` on the stream |
| `checkIn.remove` | 200; `data: {"type":"checkIn.removed","breakId":"brk_thepoint"}` |
| `remove` with no check-in | `NOT_FOUND` — "You don't have an active check-in." |
| `update` with no check-in | `NOT_FOUND` — it refuses to create, which is the whole reason it exists |
| Job registration | `pgboss.schedule` holds `checkin-expiry */5 * * * *` beside `poll-conditions` |

**Expiry boundary**, two rows either side of the two-hour line, sweep run through the real module
(`npx tsx --env-file=.env --conditions=react-server`):

- ETA 2h01m ago → **deleted**
- ETA 1h59m ago → **kept**
- `{"count":1,...,"msg":"checkin-expiry: removed stale check-ins"}`, and the query log confirms
  `DELETE ... WHERE id IN ($1)` rather than a re-run of the time filter.

**In-process SSE emit from the job**, which is the part a function-level test cannot prove: with a
stream already open, a `checkin-expiry` job was enqueued from a separate process; the server's worker
consumed it and the stream received
`data: {"type":"checkIn.removed","breakId":"brk_bogue"}`. Sweep log `count: 1`, table empty.

**Not verified:** the drawer's edit mode and Remove link in a browser, and the reduced-motion CTA
transition — no browser automation, as since Story 2.1.

### Testing note (third time for the same trap)

The in-process job test failed twice before it passed, both times because the wait was shorter than
pg-boss's 2-second poll: a `for i in $(seq 1 60)` loop of fast HTTP calls completes in about two
seconds, not sixty. The job sat in pg-boss state `created` and it read as "the worker never picked it
up". **Check the job's row state before concluding anything about a queue** — `created` means nobody
consumed it yet, not that consumption is broken.

## Files

| File | Change |
|---|---|
| `src/server/api/routers/check-in-router.ts` | `update`, `remove`, shared ETA-window check |
| `src/server/jobs/check-in-jobs.ts` | new — `checkin-expiry` queue, cron, sweep |
| `src/server/jobs/index.ts` | registers the check-in jobs |
| `src/components/CheckInDrawer.tsx` | update-on-edit, Remove link |
| `src/components/CheckInCTA.tsx` | explicit `motion-reduce` handling |
