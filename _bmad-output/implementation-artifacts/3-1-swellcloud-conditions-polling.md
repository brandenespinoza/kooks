# Story 3.1: SwellCloud Conditions Polling

Status: **done** (2026-09-01)
Epic: 3 — Conditions
FRs: FR-7
UX: UX-DR15 (stale timestamp), NFR-3 (conditions never fetched at request time)

## Story

As a user,
I want the Break screen to display up-to-date surf conditions data fetched automatically from SwellCloud,
So that I always see current conditions without having to manually refresh.

## Acceptance Criteria

1. **Typed, server-only SwellCloud client.** `src/lib/swellcloud.ts` exports `fetchConditions(lat, lng)`,
   which calls `GET https://api.swellcloud.net/v1/point` with `SWELLCLOUD_API_KEY` from env and returns
   typed data (swell height, swell period, wave direction, wind speed, wind direction). The key never
   reaches the client bundle.
2. **pg-boss is initialised on server boot and schedules the poll.** `src/instrumentation.ts` `register()`
   starts a `PgBoss` against `DATABASE_URL` and schedules `poll-conditions` every 30 minutes. When the job
   fires it calls `fetchConditions` for every `Break` and writes `rawData` + `conditionsUpdatedAt` back to
   the row. No migration — those columns already exist.
3. **`conditions.getForBreak` reads the cache, never the API.** The protected procedure returns the stored
   `rawData` and `conditionsUpdatedAt` for a valid `breakId`; no SwellCloud call happens at request time.
4. **Stale data is visually marked.** Conditions older than 30 minutes render the timestamp in `--stale`;
   fresh data renders in `--text-secondary`.
5. **Missing `SWELLCLOUD_API_KEY` fails at boot.** T3 env validation throws before any request is served.

## Tasks

- [x] Install `pino` and add `src/server/logger.ts` — resolves the deferral that parked the decision here.
- [x] `src/lib/swellcloud.ts` — server-only client, Zod-validated response, normalised snapshot type.
- [x] `src/server/jobs/index.ts` — the single `PgBoss` instance, `startJobs()`, boot guards.
- [x] `src/server/jobs/conditions-jobs.ts` — `poll-conditions` queue, cron, handler.
- [x] `src/instrumentation.ts` — call `startJobs()` under the Node-runtime guard.
- [x] `src/server/api/routers/conditions-router.ts` — `getForBreak`, registered in `root.ts`.
- [x] `src/components/CrewZone.tsx` — timestamp colour switches on the 30-minute threshold.
- [x] Verify: `npm run typecheck` + `npm run build`.

## Dev Notes

**No migration.** `rawData`, `conditionsUpdatedAt` and `conditionsModelRunAt` all shipped in
`20260901005755_full_schema` (replan correction 2).

**AC 5 was already satisfied before this story started.** `SWELLCLOUD_API_KEY: z.string().min(1)` has been
in `src/env.js` since Story 1.1, and `next.config.js` imports `./src/env.js`, so a missing key throws at
boot and at build. Nothing to add — verified, not implemented.

**The SwellCloud response shape is an assumed contract.** There is no live key or published schema
available in this environment, so `SwellCloudPointResponse` in `src/lib/swellcloud.ts` encodes the shape
the epic describes and nothing more. Two consequences, both deliberate:

- The response is Zod-parsed. A shape mismatch throws `SwellCloudError` rather than writing garbage into
  `rawData`, and the job leaves the previous good row untouched. A wrong guess degrades to "data stops
  refreshing", never to "the UI renders nonsense".
- The field names, the auth header and the query parameters are grouped at the top of the file so that
  reconciling against a real response is a small, contained edit.

**`rawData` stores the normalised snapshot, not the upstream body.** Everything downstream (the
`RawDataPanel` in 3.3, the LLM prompt in 3.2) reads a stable five-field shape; a SwellCloud rename never
reaches the UI or the prompt. `conditionsRawDataSchema` is re-parsed on read in `conditions-router.ts`,
so a row written by an older shape returns `null` instead of breaking the client.

**This story deliberately does not write `conditionsModelRunAt`.** `fetchConditions` returns `modelRunAt`,
but the poll job leaves the column alone. Story 3.2 gates verdict regeneration on
`modelRunAt !== conditionsModelRunAt` — if 3.1 wrote the column, that comparison would be equal on every
run and the verdict would never regenerate (replan correction 3).

**pg-boss v12 specifics.** Queues must exist before they can be scheduled or worked: `createQueue()`
precedes `schedule()`, or `send` throws `Queue poll-conditions does not exist`. Work handlers receive a
**batch** — `Job<T>[]`, not a single job. `PgBoss` is a named export in v12, not a default one.

**Boot guards in `instrumentation.ts`.** `register()` also runs in the Edge runtime and during
`next build`'s page-data collection, neither of which should open a Postgres connection — hence the
`NEXT_RUNTIME === "nodejs"` and `NEXT_PHASE !== "phase-production-build"` checks, and the dynamic
`import()` so pg-boss never lands in an Edge bundle. Failure to start is logged and swallowed: a database
outage must not stop the web server from booting, which is the same lesson as commit d1b7593.

**One poll fires immediately after boot.** Cron alone would leave a freshly deployed container with no
conditions for up to 30 minutes, which fails FR-7 from a cold start. The boot poll is a plain `send`; at
single-instance scale there is no fan-out to deduplicate.

**One Break's failure never stops the others.** The handler loops sequentially with a per-Break
`try/catch`. Sequential rather than parallel because the crew has a handful of Breaks and an unknown API
rate limit — there is nothing to gain from bursting.

**`pino` is now installed** (the deferral parked that decision here). `src/server/logger.ts` is the single
instance, default stdout destination with no transport worker so Next's standalone tracing stays intact.
Job code logs through it; React and tRPC code still use `console`, unchanged.

**`conditions.getForBreak` is not wired into the UI yet.** `break.list` already carries
`conditionsVerdict` and `conditionsUpdatedAt` for the whole stack in one query, and adding a per-Break
query to `BreakSwipeStack` would mean N round trips for data already on screen (replan correction 11).
The procedure exists for Story 3.3, where the `RawDataPanel` fetches raw data lazily on expand — one
query, for one Break, only when someone asks for it.

**Session expiry: closed, not deferred again.** The 1.1 and 1.3 notes both pointed at "Story 3.1" for a
session cleanup job. There is no expiry column to sweep on, and this story's ACs explicitly require no
schema change. **V1 sessions are permanent by decision.** Revisit in Story 5.3 alongside sign-out.
`deferred-work.md` has been updated so the note no longer points at a story that never owned it.

## Verification

`npm run typecheck` and `npm run build` both pass. The build failure worth recording: Next compiles
`instrumentation.ts` for the **Edge** runtime too, where pg-boss's `pg` dependency cannot resolve
`fs`/`net`. An early `return` guard is not enough — webpack only drops the branch when the
`await import()` sits *inside* the `if (process.env.NEXT_RUNTIME === "nodejs")` block. That shape is
load-bearing; do not flatten it.

Ran against the real local Postgres (`npm start`, port 3001) with the two dev-fixture Breaks:

- `pg-boss started; scheduled jobs registered` on boot.
- `pgboss.schedule` holds one row: `poll-conditions`, `*/30 * * * *`, UTC. `pgboss.queue` holds
  `poll-conditions`.
- The boot poll fired and swept both Breaks. `api.swellcloud.net` does not answer from here, so each
  fetch aborted on the 10s timeout, logged a structured pino error carrying `breakId` and `label`, and
  the sweep continued — `{"updated":0,"total":2}`. One Break's failure costs the others nothing.
- Neither row was written: `brk_bogue` kept its existing verdict and `conditions_updated_at`, and
  `conditions_model_run_at` stayed null on both. A failed poll leaves the last good data alone, and
  3.2's gate is still untouched.

**What could not be verified:** a real SwellCloud response. Everything from the request URL to
`pointResponseSchema` is the assumed contract described above, and the first live key will either
confirm it or produce `Unexpected SwellCloud response shape` in the logs — which is the intended
failure mode, not a crash. Until then conditions stay empty; the UI already handles that (`No
conditions data yet`, and the Epic-3 placeholder line in `VerdictBand`).

**Expected noise:** `next start` warns that it "does not work with output: standalone". It serves
fine; the warning is pre-existing and unrelated to this story.

### Addendum — mock conditions source (2026-09-01)

SwellCloud is down and its replacement is undecided (owner's call: tabled). To keep the rest of the
system exercisable, `fetchConditions` gained a mock path behind a new `CONDITIONS_SOURCE` env var
(`swellcloud` | `mock`).

- **It defaults to `swellcloud`.** A production deploy cannot serve invented surf conditions by
  omission — that would be a plausible-looking lie on a screen whose whole purpose is a go/no-go call.
  `.env` is set to `mock` for local work; `.env.example` and the README say never to do that in
  production, and the poll logs a warning on **every** sweep while it is on, not once at boot.
- **Deterministic per Break and model run**, so a refresh does not reshuffle the surf.
- **It returns a real `modelRunAt`**, bucketed to 6 hours, so mock mode exercises Story 3.2's verdict
  gate exactly as the real API would rather than routing around it. That is what finally proved the gate
  — see the Story 3.2 addendum.

## Files

| File | Change |
|---|---|
| `src/lib/swellcloud.ts` | new — server-only API client + normalised snapshot schema |
| `src/server/logger.ts` | new — the single `pino` instance |
| `src/server/jobs/index.ts` | new — pg-boss singleton, `startJobs()` |
| `src/server/jobs/conditions-jobs.ts` | new — `poll-conditions` queue, cron, handler |
| `src/server/api/routers/conditions-router.ts` | new — `getForBreak` |
| `src/server/api/root.ts` | registers `conditions` |
| `src/instrumentation.ts` | calls `startJobs()` under the Node-runtime guard |
| `src/components/CrewZone.tsx` | stale-vs-fresh timestamp colour |
| `package.json` | `pino` |
