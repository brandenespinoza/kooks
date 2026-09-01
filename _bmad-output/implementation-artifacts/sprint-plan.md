# Kooks — Sprint Plan

Single source of truth for story status. Individual story files carry their own `Status:` line; **this file is the index that keeps them honest.** Story 1.2 sat at `ready-for-dev` for months while fully implemented because nothing reconciled the two — that is what this file exists to prevent.

Last reconciled: **2026-09-01** — **all 19 stories are `done`. V1 feature work is complete.** Two things stand between this and real use: a **real-device pass** (PWA install + push, covering 6.1–6.3) and a **conditions data source** (SwellCloud is down; the app runs on mock data).

## Status legend

| Status | Meaning |
|---|---|
| `done` | All ACs met and verified |
| `in-progress` | Started, not complete |
| `ready-for-dev` | Story file written with full context; next up |
| `backlog` | Defined in epics.md; no story file yet — generate with `bmad-create-story` |

## Epic 1 — Foundation, Auth & Onboarding

| Story | Status | FRs | Notes |
|---|---|---|---|
| 1.1 Project Scaffold & Infrastructure | `done` | — | AR-1–14. See story file for review findings. |
| 1.2 App Shell & Design System | `done` | — | UX-DR2/3/10/13. Reconciled 2026-08-31. **AC 2 (Inter) was silently unmet until Story 2.1** — a circular `--font-sans` meant every page rendered in Times. Fixed in 2.1. Device/viewport check completed in 2.1. |
| 1.3 Invite Link Join & Account Creation | `done` | FR-22, FR-23 | Landed 2026-08-31. Absorbed the `CrewMember` pair and real `assertCrewMember` from Epic 5. **Onboarding moved from tRPC to a Server Action during 2.2** — a tRPC procedure cannot set a cookie here. |

## Epic 2 — Breaks & Navigation

| Story | Status | FRs | Notes |
|---|---|---|---|
| 2.1 Break Screen Shell with D3 Layout | `done` | — | Landed 2026-08-31. UX-DR1/8/9 + early UX-DR6. Verified in a real browser at both viewports; caught and fixed the Inter font bug carried since 1.2. |
| 2.2 Break Creation & Management | `done` | FR-1, 3, 4a | Landed 2026-08-31. Leaflet pin-drop, home break, delete. Also fixed onboarding, which had never set a cookie in a browser — see the addendum in the 2.2 story file. |
| 2.3 Swipe Navigation & Saving Crew Breaks | `done` | FR-2, 4b | Landed 2026-09-01. **Epic 2 complete.** Native scroll-snap swipe, no gesture library. `BreakSwipeStack` is now the tRPC caller for this subtree and `BreakScreen` is a presentational panel. Adds `break.save`/`break.unsave`/`break.crewBreaks`. |

## Epic 3 — Conditions

| Story | Status | FRs | Notes |
|---|---|---|---|
| 3.1 SwellCloud Conditions Polling | `done` | FR-7 | Landed 2026-09-01. pg-boss now starts in `instrumentation.ts` and Epics 4 and 6 can register jobs against it. Adds `conditionsRouter`, `src/lib/swellcloud.ts`, `pino`. The SwellCloud response shape is an **assumed contract** — see the story file. |
| 3.2 LLM Conditions Verdict | `done` | FR-5, FR-8 | Landed 2026-09-01. Model-run gate with a 6-hour bucket fallback; `break.list` carries parsed `rawData`. **`generateVerdict` verified against the live API** — `gpt-5.4-nano` returned a 9-word verdict in 1.8s, and the failure path wraps correctly. The gate itself is still unexercised: it needs a successful poll. |
| 3.3 Raw Data Panel & Webcam Links | `done` | FR-6, FR-9 | Landed 2026-09-01. **Epic 3 complete.** Webcams resolved server-side from `WEBCAM_URLS_JSON` onto `break.list`. `conditions.getForBreak` **kept without a caller** — 3.1's AC requires it and `break.list` already carries the data; revisit in 5.2. |

## Epic 4 — Check-In & Real-Time Presence

| Story | Status | FRs | Notes |
|---|---|---|---|
| 4.1 Check-In Creation & CrewZone UI | `done` | FR-10 | Landed 2026-09-01. `checkIn.create` is an **upsert** — confirming from another Break moves the check-in and emits `checkIn.removed` to the old one. Crew list rides on `break.list`. `ETAPicker` is scroll-snap, slots roll to tomorrow after 10am. |
| 4.2 Real-Time Presence via SSE | `done` | FR-11 (partial) | Landed 2026-09-01. **One connection per client, not per Break screen**, and **crew-scoped now** rather than in Epic 5 — both deviations documented in the story file. ~29ms delivery against NFR-2's 5s. Epic 5 has nothing left to do on this route. |
| 4.3 Edit, Remove & Auto-Expiry | `done` | FR-11, 12, 13 | Landed 2026-09-01. **Epic 4 complete.** `checkIn.update` was kept, not folded into the upsert — it *refuses to create*, which is the point. `checkin-expiry` sweeps every 5 min and its emit was verified reaching a live stream in-process. |

## Epic 5 — Crew & Social Graph

| Story | Status | FRs | Notes |
|---|---|---|---|
| 5.1 Invite Link Generation & Crew Connection | `done` | FR-14, 16 | Landed 2026-09-01. Three of five ACs were already delivered by 1.3 and were **verified** here, not rebuilt. `getInviteLink` returns a *path*; the browser supplies the origin. Invite UI is in the CrewZone header — **5.3 should absorb it into Settings**. |
| 5.2 Crew-Aware Break & Presence Visibility | `done` | FR-16, NFR-7 | Landed 2026-09-01. `break.list` widened to every visible Break with `isSaved`; `break.crewBreaks` **deleted**. **Presence is now scoped to people, not places** — check-ins are filtered by crew in both `break.list` and the SSE route, closing a real friend-of-friend leak. Adds the `crew.joined` event. |
| 5.3 Crew Management & Settings Screen | `done` | FR-17 | Landed 2026-09-01. **Epic 5 complete.** `/settings` with five sections; **`BreaksDrawer` and `InviteDrawer` deleted**, not duplicated. `crew.remove` deletes both directions and emits `crew.removed`. **Sign-out finally wired** — a Server Action that deletes the session row, not just the cookie. |

## Epic 6 — Push Notifications & PWA

| Story | Status | FRs | Notes |
|---|---|---|---|
| 6.1 PWA Manifest & Service Worker | `done` | NFR-4, 5 | Landed 2026-09-01. Serwist wired, manifest + generated icons, inline iOS install note. Fixed a middleware bug that **307'd the PWA icons** — an installed app would have had no icon. **Needs a real-device install check before 6.2**, which depends on it. |
| 6.2 Push Subscriptions & Friend Check-In Notifications | `done` | FR-18 | Landed 2026-09-01. **Real VAPID keys generated.** Everything up to the push service is verified against a local TLS receiver — encryption, recipient filtering, pref opt-out, 410 pruning. **The last hop (a phone) is untested** and needs 6.1's install working. |
| 6.3 Scheduled Push Notifications | `done` | FR-19, FR-20 | Landed 2026-09-01. Both crons registered in `America/New_York` via the new `APP_TIMEZONE`. **The night-before copy is not phrased as a forecast** — no next-day data exists; revisit if a forecast source is ever added. |
| 6.4 Notification Preferences & Accessibility Audit | `done` | FR-21, NFR-9, 10 | Landed 2026-09-01. **Epic 6 complete.** Real preference switches. The palette audit found **seven** AA failures, not the three on record — all fixed and re-measured at 0. `--stale` now signals age by hue, not fading. Fixed a 44px tap target and drawer focus return. |

---

## Cross-cutting corrections (2026-08-31 replan)

These supersede the corresponding text in `epics.md` and `architecture.md`. Apply them when generating each story file.

**1. ~~`assertCrewMember` ships real in Story 1.3, not stubbed.~~ DONE 2026-08-31** — implemented in `src/server/auth/assert-crew-member.ts` and verified against all six cases.

Original note:
epics.md Story 1.3 specified a stub that throws `FORBIDDEN` unconditionally until Epic 5, while enforcement rule 2 requires calling it in every break-scoped procedure. Followed literally, Epics 2–4 would have been untestable. Since the full schema (including `CrewMember`) landed on 2026-08-31, implement the real check immediately: the requesting user must share a crew row with the Break's creator, or have the Break in their own `UserSavedBreak`.

**2. Full Prisma schema already exists.** All 8 models were created in migration `20260901005755_full_schema`. Delete the "add model X via `prisma migrate dev`" task from Stories 2.2, 3.1, 4.1, 5.1, and 6.2. A migration is only needed if a story genuinely changes the schema.

**3. FR-8 vs. Story 3.2 — verdict regeneration frequency.** FR-8 requires the LLM verdict be generated "once per SwellCloud model update (4× daily)". Story 3.2's AC said generate on every successful poll, which Story 3.1 schedules every 30 min — 48× daily. Resolution: `Break.conditionsModelRunAt` stores the SwellCloud model-run timestamp; regenerate the verdict only when it changes. Satisfies FR-7 freshness and FR-8's ceiling together.

**4. Middleware cannot validate sessions.** Next.js middleware runs on Edge Runtime and cannot reach Prisma. `src/middleware.ts` does a cookie-presence check and redirects to `/join-required`; real session validation lives in `protectedProcedure` against the DB.

**5. Design tokens are Tailwind utilities, not bracket syntax.** Write `bg-action` / `text-text-secondary`, never `bg-[--action]`. The latter compiles to invalid CSS that browsers discard silently. See `CLAUDE.md` for the full token list.

**6. ~~Deploy is manual-dispatch only.~~ RESOLVED 2026-08-31.** `deploy.yml` was gated during the replan and the `push: branches: [main]` trigger was restored when Story 1.3 landed. `workflow_dispatch` is retained for manual runs. **The next push to `main` will deploy** — it requires the `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` repository secrets.

**7. ~~Design tokens fail WCAG AA on parchment (NFR-9) — decision needed.~~ RESOLVED 2026-09-01 in Story 6.4** — seven failing pairs found (not three) and all fixed; see that story for the measured table. Original note follows.

**Original:** Measured during Story 2.1: `--text-secondary` 3.50:1, `--present` 3.74:1, `--stale` 1.71:1 against `--bg`, all below the 4.5:1 required for the 10–16px text they are used on. The UX spec asserts these pass; they do not. Minimum darkening that preserves hue and saturation: `--text-secondary` -> `#776c5f`, `--present` -> `#297c4e`, `--stale` -> `#796c59`. Note `--stale` at AA is no longer visually "muted", which fights its purpose — the alternative is to enlarge the timestamp instead. This is a one-line change per token in `globals.css` because everything uses the token utilities. Resolve before the Story 6.4 accessibility audit, not during it.

**8. A tRPC procedure cannot set a cookie in this app.** The client uses `httpBatchStreamLink` (headers flush before a procedure resolves) and tRPC's fetch handler builds its own `Response` (bypassing Next's cookie collection). Both `ctx.resHeaders.append("Set-Cookie", …)` and `cookies().set()` inside a procedure are silently dropped. Anything that must set or clear a cookie — sign-out in Story 5.3, for instance — belongs in a Server Action or a Route Handler, not a router.

**9. Verify UI against a production build, not `npm run dev`.** The dev server degrades badly under sustained HMR: response times climbed to 10-25s and browser test results varied run to run for identical code. `npm run build && npm start` is stable and exercises the real artifact.

**11. `BreakSwipeStack`, not `BreakScreen`, is the tRPC caller for the Break subtree.** Story 2.3
inverted the tree to match architecture.md (`BreakSwipeStack` renders one `BreakScreen` per saved
Break) but kept the single-query shape 2.1 established. architecture.md's "`BreakScreen` receives
`breakId` and fetches its own data via tRPC" would mean N queries for data that arrives in one list
— it does not apply. The rule moved up one level, it was not dropped.

**10. One vaul drawer at a time.** Closing one drawer to open another leaves the second invisible, and mounting two roots at once lets the idle one interfere. Mount only the open drawer. Relevant to `CheckInDrawer` in Epic 4.

**12. pg-boss lives behind `src/server/jobs/index.ts` (Story 3.1).** `startJobs()` is called once from
`instrumentation.ts` and caches the boss on `globalThis`. Later stories add a line to `registerJobs`;
they never call `new PgBoss()`. Two gotchas that cost a build: pg-boss v12 requires `createQueue()`
before `schedule`/`work`, and the `await import()` in `instrumentation.ts` must sit *inside* the
`process.env.NEXT_RUNTIME === "nodejs"` block or the Edge compilation fails on `pg`'s `fs` import.

**13. `pino` is installed and is the logger for job code (Story 3.1).** `src/server/logger.ts` is the
single instance. Story 3.2's "logged via pino" AC is now literally satisfiable. React and tRPC code
still use `console` — that was not converted.

**14. Sessions are permanent in V1 — decided, not deferred.** The 1.1 and 1.3 notes both pointed at
Story 3.1 for a cleanup job. There is no expiry column to sweep on and 3.1's ACs forbid a schema
change, so V1 accepts permanent sessions. Revisit in Story 5.3 alongside sign-out.

**15. SwellCloud is down; the conditions source is an open question (2026-09-01).**
`api.swellcloud.net` resolves (3.8.228.87, AWS) but never completes a TCP connection, authenticated or
not. **Owner's call, 2026-09-01: SwellCloud is down, a different provider will probably be needed,
tabled for now.** Consequences to carry forward:

- No poll has ever succeeded, so `Break.rawData` is only ever populated by hand, the model-run gate has
  never fired, and the Break screen shows "No conditions data yet" in normal operation.
- Epic 3 is code-complete and its *own* logic is verified. What is missing is a data source, not code.
- `SWELLCLOUD_API_KEY` remains the literal string `placeholder` — do not read a real key into it as
  proof of anything.
- **When a replacement is chosen the change is confined to `src/lib/swellcloud.ts`** — URL, auth header,
  query params and `pointResponseSchema` are grouped at the top for exactly this, and everything
  downstream consumes the normalised `ConditionsSnapshot`. Open-Meteo Marine is the leading candidate:
  no key, and it returns all five FR-6 fields.
- CI carries neither secret — deploy.yml only SSHes and runs compose, so the real `.env` is
  `/opt/kooks/.env` on the VPS and nothing reports that a value is still a placeholder.

**`OPENAI_API_KEY` is now real and the verdict path is proven** — see the Story 3.2 addendum.

**Mock conditions (2026-09-01, owner's call: "keep using mock data").** `CONDITIONS_SOURCE=mock` makes
`fetchConditions` return deterministic synthetic data with a real 6-hour `modelRunAt`. It **defaults to
`swellcloud`** so production cannot serve invented surf by omission, and the poll warns on every sweep
while it is on. This finally exercised the whole pipeline: first sweep `regenerated:2`, second sweep
`refreshed:2, regenerated:0` — **the FR-8 model-run gate is proven**. It also surfaced two real defects,
both fixed: the model invented a unit ("1.9ft" on data whose units are unknown), and the ten-word cut
landed mid-phrase ("...should be clean—go get").

**16. `VerdictBand` is now a client component (Story 3.3).** It owns the raw-data disclosure state, so
it carries `"use client"` and `useState`/`useId`. It still makes no tRPC call — every value arrives as a
prop from `BreakSwipeStack` via `BreakScreen`, and correction 11 is intact.

**17. Test servers: one port per case.** A `next start` that hits `EADDRINUSE` exits, and curl is then
answered by the *previous* server — which silently shifts every result by one run and reads as a code
bug. Story 3.3 lost time to this. Give each config case its own port, or check the log for
`EADDRINUSE` before believing a result.

**18. Server modules can be exercised outside Next (found 2026-09-01).** This project has no test
runner, but a one-off script can import real server code — `~` aliases, `~/env` validation and all:

```
npx tsx --env-file=.env --conditions=react-server <script.ts>
```

`--conditions=react-server` is the load-bearing part: the `server-only` package throws on import
outside a bundler, and that condition resolves it to a no-op instead. `--env-file` loads `.env` the way
Next would. This is how `generateVerdict` was verified against the live API, success path and failure
path both. It is the cheapest verification available until a test runner exists — prefer it over
booting a whole server.

**19. `break.list` is the screen query, and that is deliberate.** It now carries the Break, its
conditions, `rawData`, `webcamUrl` and the crew's check-ins. Every Epic 3 and 4 story has been asked
whether to add a per-panel query instead, and the answer has been no each time: `BreakSwipeStack` is
the single caller for this subtree (correction 11), the payload is a handful of rows, and SSE
invalidation of one query is simpler than of five. If it ever does need splitting, split it on a real
measurement, not on instinct.

**20. `--conditions=react-server` is for server modules only.** The tsx trick in correction 18 needs
that flag to stop `server-only` from throwing — but it must be **omitted** for client components,
because React's react-server build exports no `useState`/`useEffect`. Story 4.1 hit both halves.

**21. When a test result contradicts the code, suspect the harness (Story 4.2).** Two false negatives
cost most of that story, and both looked like a broken feature:

- **Racing the connection.** A background `curl -N` stream had not finished connecting when the mutation
  fired, so the event went to zero listeners. Gate on the stream being open before triggering anything.
- **A gate that never returns.** `timeout N sh -c "tail -f file | grep -q -m1 X"` hangs: `grep -q` exits
  on match but `tail -f` keeps the pipeline alive until its next write, so the shell waits and `timeout`
  kills it — reporting failure while the thing under test worked. Poll the file with real HTTP requests
  as the delay instead.

The tell in both cases was an instrumented listener count of 0 at emit time. Logging the emitter's
identity at both ends is what finally separated "not connected yet" from "different instance".

**22. A pg-boss job in state `created` means nobody consumed it yet.** Story 4.3 lost two attempts to a
wait shorter than pg-boss's 2-second poll interval — a `for i in $(seq 1 60)` loop of fast HTTP calls
finishes in about two seconds, not sixty. Query `pgboss.job` for the state before concluding a worker is
broken: `created` = queued, `active` = running, `completed` = done. Use a real bounded wait
(`timeout 20 sh -c "tail -n +1 -f FILE | grep -m1 PATTERN"`) rather than a fast loop.

**23. Break visibility and presence visibility are different questions (Story 5.2).** Seeing a Break
does not entitle you to see who is checked in on it: two people can both be crew with its creator
without being crew with each other, and that is precisely the friend-of-friend case NFR-7 forbids. Three
places now filter on `listCrewUserIds` and must stay in step — `break.list`'s `checkIns`, the SSE
route's `checkIn.*` filter, and anything Epic 6 adds that notifies one user about another. If you add a
fourth reader of check-in data, scope it or it leaks.

**24. `PresenceEvent.breakId` is nullable as of `crew.joined`.** Not every presence event is about a
place. The SSE route handles the null case explicitly; anything new that consumes `PresenceEvent` must
too.

**25. Removal severs presence, not places (Story 5.3).** `crew.remove` stops the two people seeing each
other's check-ins, and deliberately leaves saved Breaks alone — a Break you saved is a spot you surf,
not a friendship, and `assertCrewMember`'s third rule keeps it reachable. This closes the question 5.2
left open.

**26. Settings is the only home for managing things.** `BreaksDrawer` and `InviteDrawer` are deleted;
their contents are `SettingsBreaks` and `SettingsInvite`. **Adding** a Break stays on the Break screen —
it is the one management action worth one tap from what you are looking at. If a future story needs a
management surface, extend `/settings` rather than hanging another drawer off the CrewZone header.

**27. The middleware matcher excludes static assets by extension, not by filename (Story 6.1).** It used
to name `favicon.ico`, `manifest.json`, `sw.js` and a guessed-at `icons` directory — so the icons added
in 6.1 landed outside the list and answered `307 -> /join-required`. A browser fetching a manifest icon
does not follow that, and nothing logs it: the app would simply have installed without an icon. Any new
public asset is now covered automatically; do not narrow this back to a filename list.

**28. `public/` and `src/app/sw.ts` are excluded from `tsconfig.json`.** The worker needs the WebWorker
lib (incompatible with the app's DOM lib), and `public/` now holds a *generated, minified* `sw.js` that
`checkJs` + `**/*.js` would otherwise type-check — it fails the build with
`Variable 'e' implicitly has type 'any'`. `npm run typecheck` therefore does not cover the worker.

**29. In zsh, `path` is tied to `PATH`.** A `for path in ...` loop in a verification script wiped the
environment's PATH mid-command and every subsequent tool reported "command not found", which reads as a
broken machine rather than a broken loop. Name loop variables anything else.

**30. Verify a colour tool before trusting it (Story 6.4).** The contrast-fix script's HSL round-trip
divided hue by 360 twice, so its first run proposed a **red** replacement for the green `--present`
token. It was caught by reading the output, not by the tool reporting anything wrong. Any colour maths
here should be sanity-checked by round-tripping a known value first.

**31. Bootstrap: the container seeds the primary user on start.** `prisma/seed.mjs` (plain JS, no `tsx`
on the production start path) runs between `migrate deploy` and `server.js`. Without it a fresh deploy
has a schema, zero users, and no way in — `/join/<SEED_INVITE_TOKEN>` 404s because nobody holds the
token. Verified by running the seed inside the built production image. It is idempotent, so restarts
cost one query.
