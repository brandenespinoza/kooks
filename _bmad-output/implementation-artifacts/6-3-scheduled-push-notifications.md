# Story 6.3: Scheduled Push Notifications

Status: **done** (2026-09-01)
Epic: 6 — Push Notifications & PWA
FRs: FR-19 (night-before nudge), FR-20 (dawn patrol)

## Story

As a user,
I want a push notification the night before that previews tomorrow's conditions at my Home Break, and a
dawn patrol push at 5am with one line of current conditions,
So that I can coordinate with my crew before bed and know whether to get up before I even open the app.

## Acceptance Criteria

1. **`notification-templates.ts`** exports `nightBeforeMessage(verdict, breakLabel)` and
   `dawnPatrolMessage(verdict, breakLabel)`, each returning a single lock-screen line.
2. **`night-before-nudge`** fires at 21:00 local daily and pushes to every user with a Home Break and
   the `nightBefore` pref on.
3. **`dawn-patrol`** fires between 05:00–05:30 local daily, same shape, `dawnPatrol` pref.
4. **A user with no `homeBreakId` is skipped**, with no error logged.
5. **A failed delivery is logged and the sweep continues.**

## Tasks

- [x] `APP_TIMEZONE` env var (`src/env.js`, `.env.example`, README).
- [x] `src/server/push/notification-templates.ts`.
- [x] `src/server/jobs/push-jobs.ts` — both queues, crons, shared sweep.
- [x] Registered in `registerJobs`.

## Dev Notes

**The night-before message is deliberately not phrased as a forecast.** FR-19 asks for a preview of
*next-day* conditions, and nothing in this system holds tomorrow's data — the poll caches the current
model run only, and its upstream is down. Promising someone what the morning looks like on the strength
of this evening's numbers is the kind of confident wrongness that gets a person up at 5am for nothing.
The copy reads "latest read" and lets them decide. **If a forecast-ahead source is ever added, this is
the line to revisit.**

**`APP_TIMEZONE` exists because pg-boss schedules in UTC.** Without a `tz`, "9pm" drifts by an hour
twice a year and lands before dinner in summer. It defaults to `America/New_York` and is passed to both
`schedule()` calls; the interval jobs (`poll-conditions`, `checkin-expiry`) stay on UTC, where the
timezone is meaningless.

**Both jobs share one sweep.** They differ only in preference key, template, and title. Users without a
`homeBreakId` never enter the query — a normal state for someone who just joined, not a nightly error.
`homeBreakId` is deliberately not a foreign key (it would create a `User` ↔ `Break` cycle), so a
dangling id is possible in principle; the Break is looked up rather than joined, and a user pointing at
a Break that no longer exists is skipped too.

**Sends are per-user, not one bulk call**, because the message names *their* Home Break. Preference
filtering and per-endpoint failure handling both already live in `sendToUsers` from Story 6.2, so AC 5
is inherited rather than reimplemented.

**The sweep logs `candidates`, not `sent`.** `sendToUsers` silently drops anyone who has the kind turned
off or has no registered device, and does not report back. A log line claiming a send that never left
the building is exactly the sort of thing you would believe at 5am and regret later.

## Verification

`npm run typecheck` and `npm run build` pass.

**Templates**, both branches:

| Call | Output |
|---|---|
| `nightBeforeMessage(verdict, "Bogue Inlet Pier")` | `Bogue Inlet Pier, latest read: Chest high and clean, get out there` |
| `nightBeforeMessage(null, "The Point")` | `The Point — no conditions read yet. Worth a look in the morning.` |
| `dawnPatrolMessage(verdict, "Bogue Inlet Pier")` | `Bogue Inlet Pier: Knee to waist, light wind` |
| `dawnPatrolMessage(null, "The Point")` | `The Point — no conditions read this morning.` |

**Sweeps**, against a local TLS receiver with one subscription, one user with a Home Break (Sarah) and
one without (Reef):

| Step | Result |
|---|---|
| Night-before sweep | one encrypted POST delivered (302 bytes); Reef skipped silently |
| Dawn patrol with `dawnPatrol: false` | sweep ran, **nothing delivered** |
| Dawn patrol with it back on | one encrypted POST delivered (282 bytes) |

**Cron registration**, after a real boot — `pgboss.schedule`:

```
dawn-patrol         | 5 5 * * *    | America/New_York
night-before-nudge  | 0 21 * * *   | America/New_York
checkin-expiry      | */5 * * * *  | UTC
poll-conditions     | */30 * * * * | UTC
```

**Not verified:** that either job fires on its own schedule (both were invoked directly — waiting until
9pm is not a test), and the last hop to a real device, which is the same outstanding real-device pass as
6.1 and 6.2.

## Files

| File | Change |
|---|---|
| `src/server/push/notification-templates.ts` | new — both messages |
| `src/server/jobs/push-jobs.ts` | new — both queues, crons, shared sweep |
| `src/server/jobs/index.ts` | registers the push jobs |
| `src/env.js`, `.env.example`, `README.md` | `APP_TIMEZONE` |
