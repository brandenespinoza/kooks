# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-and-infrastructure (2026-05-20)

- Session has no expiry field — by design for V1. ~~cleanup job via pg-boss is planned in Story 3.1~~ **Closed 2026-09-01:** there is no expiry column to sweep on, so no cleanup job was written. Sessions are permanent in V1; Story 5.3 owns it.
- `inviteToken` never rotates — V1 known limitation; revisit if app goes beyond personal crew
- ~~`caller as any` cast in `src/trpc/server.ts`~~ — **RESOLVED 2026-08-31** in Story 1.3; the cast was removed once `crewRouter` made `appRouter` non-empty
- Hardcoded postgres password in `docker-compose.yml` (`POSTGRES_PASSWORD: password`) — dev convenience for local use; change before exposing DB to any network
- Image tagged as `:latest` only in CI/CD — no immutable rollback path; acceptable for V1 personal deployment
- `timingMiddleware` adds artificial dev delay without `NODE_ENV !== "test"` guard — no test runner configured in Story 1.1; revisit when tests are added
- `prisma migrate deploy` runs on every container start — acceptable for single-instance V1; use a dedicated init-container or one-shot job if horizontal scaling is ever added
- `docker compose up -d` in CI does not wait for healthcheck — V1 acceptable; add `--wait` flag if zero-downtime deploys become important
- Edge Runtime import risk for `src/server/events.ts` — `EventEmitter` is not available in Edge Runtime; pre-existing risk, not introduced by patch; guard if any route ever opts into `export const runtime = "edge"`

## Deferred from: replan audit (2026-08-31)

- **`Break.webcamUrls` column dropped from the schema.** architecture.md defined it, but FR-9 specifies webcam links come from `WEBCAM_URLS_JSON` keyed by Break label and are "static — not dynamically fetched or user-editable". A DB column implies the opposite. V1 reads from env; revisit in V2 if per-Break user-editable webcams are ever wanted (already listed as a V2 candidate in the PRD).
- **Docker image is 1.18GB.** The `prisma` CLI is needed at container start for `migrate deploy`, but Next.js standalone does not trace it, and its dependency tree spans `@prisma/{debug,config,get-platform,fetch-engine,engines-version}` plus third-party packages. The runner now copies the full `deps` `node_modules` into `/app/cli/node_modules`. Correct but heavy — most of that tree is dev-only (typescript, tailwind, next). Optimization: a dedicated stage that installs only `prisma` at a pinned version, or drop container-start migrations in favour of a one-shot migration job. Acceptable for a single-instance personal deploy.
- ~~**`pino` is specified but not installed.**~~ **RESOLVED 2026-09-01 in Story 3.1.** `pino` is installed and `src/server/logger.ts` is the single instance, used by job code. Default stdout destination, no transport worker (a transport spawns a worker thread whose module Next standalone does not trace). React and tRPC code still use `console` and were not converted — the rule is "structured logs for server-side jobs", not "no `console` anywhere".
- ~~**PWA uses `@serwist/next`, installed but wired to nothing.**~~ **RESOLVED 2026-09-01 in Story 6.1** —
  serwist now generates `public/sw.js` at build time. Note the AC's `workbox-*.js` file does not exist
  and should not: serwist bundles into a single worker.
- **`@tailwindcss/safe-area` never installed.** Story 1.2 AC 4 called for it; equivalent `env(safe-area-inset-*)` utilities are hand-rolled in `globals.css` under `@layer utilities`. Functionally equivalent and one fewer dependency. `viewportFit: "cover"` is correctly exported, which is the part that actually gates the insets on device.
- **Safe-area behaviour never verified on a real device.** Insets always resolve to 0 outside iOS, so no amount of desktop-browser checking proves this. Carry into Story 2.1, the first story with real UI to look at.
- ~~**`Session` still has no expiry**~~ **RESOLVED 2026-09-01 in Story 3.1: accepted.** V1 sessions are permanent, by decision. There is no expiry column for a cleanup job to sweep on, and 3.1's ACs explicitly require no schema change. Revisit in Story 5.3 alongside sign-out, which is when a session first needs to end at all.
- **Tailwind scans only `src/`** via `@import "tailwindcss" source("../")`. Without it, Tailwind v4 auto-scans the whole repo and mints dead utility rules from class names quoted in markdown docs. If component code is ever added outside `src/`, this must be widened.

## Deferred from: Story 1.3 (2026-08-31)

- **`prisma/seed.ts` instantiates `PrismaClient` directly**, violating enforcement rule 3 ("import `db` from `src/server/db.ts` — never instantiate Prisma elsewhere"). The seed runs outside the Next.js runtime, where neither the `~` path alias nor `~/env` validation are available. Deliberate, scoped to this one build-time script; do not use it as precedent in application code.
- **`src/middleware.ts` inlines the `kooks-session` cookie name** rather than importing `SESSION_COOKIE_NAME` from `~/server/auth/session`. Edge Runtime cannot load that module (it reaches Prisma and `~/env`). Two string literals now have to stay in sync — if the cookie name ever changes, change both.
- ~~**Sessions still never expire and are never cleaned up.**~~ **RESOLVED 2026-09-01 in Story 3.1: accepted for V1.** See the replan-audit entry above. `Max-Age` on the cookie stays one year and the `sessions` row lives forever. Story 5.3 owns it.
- **`tsx` added as a devDependency** solely to run the TypeScript seed. Prisma's documented approach for ESM TypeScript projects; it does not ship in the runtime image.
- **`crew.joinViaInvite` is unauthenticated and unrate-limited.** Anyone holding an invite token can create unlimited accounts. Accepted at a 2–3 person crew scale — the token is the only secret and is shared privately — but it is the one public write endpoint in the app. Revisit alongside invite-link expiry/revocation if Kooks ever goes beyond a personal crew.
- ~~**No sign-out.**~~ **RESOLVED 2026-09-01 in Story 5.3.** `/settings` has a Sign out button backed by
  a Server Action that clears the cookie *and* deletes the session row — the latter matters because V1
  sessions never expire, so a token left in the database would stay valid forever.
  `serializeClearedSessionCookie` remains unused (the action uses `cookies().delete()`); see the 2.2
  note about its sibling.

## Deferred from: Story 2.1 (2026-08-31)

- ~~**Morning Light fails WCAG AA on parchment for three tokens (NFR-9)**~~ **RESOLVED 2026-09-01 in
  Story 6.4** — a full sweep found *seven* failing pairs, all now fixed and re-measured at 0 failures.
  Original note follows.
- **[superseded] Morning Light fails WCAG AA on parchment for three tokens (NFR-9) — needs a design decision.** Measured against `--bg #f5f0e8`: `--text-secondary` 3.50:1, `--present` 3.74:1, `--stale` 1.71:1. All are used on 10–16px text, which requires 4.5:1. The UX spec states "all text/background pairs exceed WCAG AA" — that claim is wrong. Minimum darkening preserving hue and saturation: `--text-secondary` -> `#776c5f` (4.52:1), `--present` -> `#297c4e` (4.53:1), `--stale` -> `#796c59` (4.51:1). `--stale` at AA stops reading as muted, so the timestamp may want a size increase instead of a colour change. One-line fix per token in `globals.css`. **Decide before Story 6.4**, which otherwise audits a palette that is known to fail.
- **`--text-secondary` and `--present` also fail on navy** (2.93:1 and 2.74:1). `VerdictBand` therefore uses `action-fg/70` (5.88:1) for secondary text instead of the token the UX spec assigns. If the palette is revised, revisit whether a muted token can work on the band.
- **Two sample Breaks remain in the dev database** ("Bogue Inlet Pier" with a verdict, "The Point" without), saved to the `Sarah` account, so `npm run dev` shows the populated Break screen. They are dev-only fixtures, never seeded, and can be deleted with `DELETE FROM breaks WHERE id IN ('brk_bogue','brk_thepoint');`.
- **No automated visual or accessibility regression check.** The Inter bug survived a full audit because the compiled CSS looked correct; only a computed-style read in a browser caught it. There is no test runner, so nothing prevents a repeat. A minimal Playwright smoke check (computed font, contrast pairs, tap-target heights, no-scroll) would have caught it — worth considering when a test runner is first introduced.

## Deferred from: Story 2.2 (2026-08-31)

- **`serializeSessionCookie` is now dead code.** `src/server/auth/session.ts` still exports it, but the app sets cookies through `sessionCookieOptions()` + `cookies().set()` in a Server Action. Kept for a non-Next context (a raw `Response`, a future test); delete it if nothing claims it by the end of V1.
- **No rate limit on Break creation.** `break.create` is authenticated but unbounded — a crew member can create arbitrarily many Breaks, and every one of them is polled by the SwellCloud job in Epic 3, which costs an API call and an LLM call per model run. Fine at crew scale; revisit if Kooks ever grows past a personal crew.
- **Deleting a Break that is someone else's Home Break silently unsets theirs.** `break.delete` nulls `homeBreakId` for every affected user, so a crew member can lose their home break without warning and stop receiving dawn patrol pushes until they set a new one. Correct per FR-3 ("removes the Break from all Crew members' views"), but the affected user is never told. Consider a push or an in-app prompt when Epic 6 lands.
- **`User` rows cannot be deleted while they own Breaks.** `breaks.created_by_id` is `RESTRICT`, so account deletion would fail. There is no delete-account feature in V1, but if one is ever added it needs to reassign or cascade Breaks first.
- **Leaflet tiles come straight from `tile.openstreetmap.org`.** No API key, but also no caching layer and subject to OSM's tile usage policy. Fine for a handful of pin-drops; if the map ever becomes a browsing surface, move to a provider with a proper tile budget.
- **The map always opens at Emerald Isle, NC.** Hardcoded default centre in `BreakMap.tsx`. Sensible for the V1 user, wrong for anyone else. Centring on the user's existing Breaks would be a small improvement in Story 2.3.

## Deferred from: Story 3.1 (2026-09-01)

- **The SwellCloud response shape has never been seen.** No live key or published schema was available,
  so `pointResponseSchema` in `src/lib/swellcloud.ts` encodes what epics.md describes and nothing more.
  The failure mode is safe — a mismatch throws `SwellCloudError`, the poll logs it and leaves the last
  good row alone — but until a real key exists, conditions never populate. **First thing to do with a
  real key: run one poll and reconcile the schema, the auth header and the query parameters, which are
  grouped at the top of that file for exactly this.** Units are also unknown and are stored and
  displayed as-is.
- **The poll is sequential with a 10s timeout per Break.** Worst case is `10s × breakCount` for a
  fully-unreachable API (measured: 20s for the two dev fixtures). Correct at crew scale and gentle on
  an unknown rate limit; if the Break count ever grows, batch it with a small concurrency limit rather
  than raising the timeout.
- **No graceful shutdown.** Nothing calls `boss.stop()` on SIGTERM, so a container stop mid-sweep
  leaves the active job to expire and be retried rather than releasing it cleanly. Harmless at a
  30-minute cadence with an idempotent job; worth a signal handler if a long-running or non-idempotent
  job is ever added.
- **pg-boss creates and migrates its own `pgboss` schema on `start()`**, which needs DDL rights on the
  database. Fine today — the app connects as `postgres` in both compose and production — but a
  least-privilege database user would break job startup, not just a query.
- **`getBoss()` is exported and unused.** It exists so Epics 4 and 6 can enqueue a job from a tRPC
  procedure (a check-in triggering a push, say) without reaching for `new PgBoss()`. Delete it if
  nothing claims it by the end of V1.
- **A failed `startJobs()` never retries.** The cached promise is cleared on failure so a later call
  could retry, but the only caller is `register()`, which runs once per boot. If Postgres is down at
  boot the web server still serves — deliberately — but scheduled jobs stay dead until the container
  restarts. The log line says so loudly (`scheduled jobs are NOT running`).

## Deferred from: Story 3.2 (2026-09-01)

- ~~**No verdict has ever been generated.**~~ **RESOLVED 2026-09-01.** A real `OPENAI_API_KEY` was
  supplied and `generateVerdict` ran against the live API: `gpt-5.4-nano` returned a 9-word verdict in
  ~1.8s, and a dead `OPENAI_BASE_URL` confirmed the failure path wraps as `VerdictGenerationError` with
  the cause preserved. The model id, the Responses API call shape and the ten-word prompt behaviour are
  all confirmed. Re-run it with
  `npx tsx --env-file=.env --conditions=react-server <script importing ~/lib/openai>`.
- **SwellCloud is down and needs replacing — tabled by the owner 2026-09-01.** `api.swellcloud.net`
  resolves to 3.8.228.87 (Amazon, eu-west-2) but never completes a TCP connection, authenticated or
  not, on the API host or the root domain. No SwellCloud key exists in the repo, git history, CI
  secrets, the shell environment, or any user-level env file. **This is the single thing standing
  between Epic 3 and a working Break screen** — every other part of the pipeline is now verified. The
  swap is confined to `src/lib/swellcloud.ts`; Open-Meteo Marine is the leading candidate (no key, all
  five FR-6 fields). Picking a replacement is its own decision, not a bug fix — do not quietly wire in
  a different provider while working on something else.
- **Env validation accepts `placeholder`.** `z.string().min(1)` cannot tell a real key from a
  stand-in, so a misconfigured production boots clean and silently never fetches conditions. A
  warning at job start when a key equals `placeholder` would close that gap; not added because it is
  a guard against a state that should not survive first deploy.
- **A transient OpenAI failure blanks a good verdict for up to 30 minutes.** AC 4 mandates writing
  `conditionsVerdict = null` on failure, and the band drops to raw numbers until the next poll
  succeeds. Reasonable (a verdict written for a superseded forecast is worse than none), but a
  30-second blip costs a perfectly good headline. The alternative — keep the old verdict and let the
  timestamp age it — is a UX call worth making before 6.4.
- **A sustained OpenAI outage retries every 30 minutes per Break** (48 failed calls/day/Break),
  because a failed generation deliberately does not advance `conditionsModelRunAt`. Failed calls are
  not billed and the sweep does not block, but the logs get noisy; add backoff if it ever matters.
- **No cost, usage, or rate tracking on OpenAI calls.** At 4 calls per Break per day on a nano model
  this is rounding-error money, but nothing would notice a loop that started calling it more often.
- ~~**`conditions.getForBreak` still has no caller**~~ **RESOLVED 2026-09-01 in Story 3.3: kept
  deliberately.** Story 3.1's AC 3 requires the procedure to exist, and `break.list` already carries
  `rawData` for the whole stack — calling it per-panel would be a second round trip for data already on
  screen. It stays as the documented single-Break read path with no V1 caller. Delete it in Story 5.2
  if the widened `break.list` absorbs everything.
- **A stale verdict has no upper bound.** If polling stops entirely, the last verdict stays on screen
  indefinitely; only the timestamp ages. Consider blanking the verdict past some age when the
  timestamp work in 6.4 is revisited.

## Deferred from: Story 3.3 (2026-09-01)

- **AC 5 ("malformed `WEBCAM_URLS_JSON` does not crash the app") is not literally satisfiable**, because
  `src/env.js` has refused to boot on unparseable JSON since Story 1.1. That fail-fast is the better
  behaviour — a config typo should surface at deploy, not silently drop the webcam feature — so it was
  left alone. `src/lib/webcams.ts` covers what env.js cannot: valid JSON of the wrong shape, which warns
  and degrades to an empty map. If the boot-time failure is ever unwanted, relaxing the refine in
  `src/env.js` is one line.
- **The disclosure panel was never exercised in a browser.** `aria-expanded`, `aria-controls`, the
  48px tap target and the collapse behaviour are all in the markup and typecheck clean, but no runtime
  check confirms the toggle actually toggles. Same root cause as the Story 2.1 note: there is no test
  runner and no browser automation in this project.
- **The webcam map is cached for the process lifetime.** `WEBCAM_URLS_JSON` is read once on first use;
  changing it needs a container restart, not just an `.env` edit. Correct for a value that only changes
  at deploy time, surprising if someone edits `.env` on the VPS and expects a live change.
- **Webcam URLs are never checked for liveness.** A dead YouTube link renders exactly like a working
  one. Fine for a curated list of two or three; a HEAD check on a schedule would be over-engineering at
  this scale.
- **An expanded panel grows the navy band and squeezes the crew zone.** Two columns keep it to three
  rows, which fits comfortably on a 430px-wide phone, but it has not been checked on a short viewport
  (SE-class, 568px tall) with an expanded panel *and* a full crew list. Worth a look during the 6.4
  accessibility pass.

## Deferred from: Story 4.1 (2026-09-01)

- **The drawer, the CTA states and the wheel were never exercised in a browser.** The slot maths and
  the mutation are both verified, but the scroll-snap wheel's actual feel — snapping, momentum, whether
  the 80ms settle delay is right on a real touchscreen — is unverified, as is focus return from the
  drawer to the CTA. Same root cause as the 2.1 and 3.3 notes: no test runner, no browser automation.
- ~~**`checkIn.create` doubles as edit, and Story 4.3 owns `update`.**~~ **RESOLVED 2026-09-01 in Story
  4.3: both kept.** `update` refuses to create, which is exactly what the Edit affordance needs — a
  missing row there means the check-in expired or was removed elsewhere, and recreating it would put
  someone back on a beach they had left. `create` keeps the move-between-Breaks case.
- **A moved check-in is announced in the drawer but not confirmed.** The sheet says "This moves your
  check-in from [Break]" and then the confirm button just does it. No second tap, no undo. Right for a
  three-person crew where the cost of a mistake is one more tap; revisit if it ever surprises anyone.
- **ETA slots are hardcoded to 5:00am–10:00am local time.** Straight from the UX spec, and correct for
  dawn patrol, but there is no way to check in for an evening session. If the crew ever surfs after
  work, this is the constant to change (`START_HOUR`/`END_HOUR` in `ETAPicker.tsx`).
- **The wheel assumes the device clock's timezone.** `resolveSlot` builds a local `Date` and the server
  stores an absolute instant, which is correct — but a crew member travelling would check in against
  their own clock, not the break's. Fine for one crew at one beach.
- **A dev check-in row is now in the local database.** Sarah is checked in at Bogue Inlet Pier so
  `npm run dev` shows a populated crew list rather than the empty state. Like the two sample Breaks, it
  is a dev-only fixture, never seeded, and can be removed with `DELETE FROM check_ins;`.

## Deferred from: Story 4.2 (2026-09-01)

- **The client hook is unverified.** `EventSource` reconnect, close-on-unmount and the catch-up refetch
  on `onopen` are browser behaviour, and this project still has no browser automation. The server half
  is verified thoroughly; the 20 lines that consume it are not.
- **No event replay.** The stream sends no `Last-Event-ID`, so events emitted while a client is
  disconnected are lost. Mitigated by invalidating on `onopen`, which makes a reconnect self-correcting
  — but a client that never reconnects (backgrounded iOS tab) stays stale until window focus.
- **~20 concurrent connections is the ceiling.** Each connection registers one listener per event type
  (5), against `emitter.setMaxListeners(100)`. Fine for a crew of four; raise the cap before it is ever
  more.
- **The visible-break set only refreshes on a `break.created` miss.** A crew member added *while* a
  connection is open does not widen it, and a revoked connection does not narrow it until then. Both
  self-correct on reconnect. Worth revisiting in Story 5.3 if crew edits become common.
- **`listVisibleBreakIds` duplicates `assertCrewMember`'s rule in set form.** They live in the same file
  and must change together; Story 5.2 narrows both.
- **Server-side listener cleanup is not externally observable.** Nothing proves the listener count
  returns to zero after a disconnect. A leak would show up as growing memory on a long-lived container.

## Deferred from: Story 4.3 (2026-09-01)

- **Removing a check-in has no confirmation and no undo.** One tap on "Remove check-in" deletes it. The
  cost of a mistap is one more check-in, and a confirmation dialog inside a vaul drawer is the pattern
  that broke the Add flow in 2.2 — but if it ever bites someone, an undo toast is the cheaper fix.
- **The two-hour expiry grace is hardcoded** (`EXPIRY_GRACE_MS` in `check-in-jobs.ts`), straight from
  FR-13. Someone who surfs a long session simply disappears from the crew list while still in the water.
- **The sweep deletes without telling the person it happened to.** Their CTA silently reverts to "I'm
  in" on the next refetch. Correct per FR-13, but a "your check-in expired" toast would be kinder;
  worth considering when push notifications land in Epic 6.
- **The expiry job has no upper bound on batch size.** It reads every stale row into memory before
  deleting. At crew scale this is a handful of rows; at any real scale it wants a `take`.
- **Editing cannot move a check-in to another Break.** `update` only changes the ETA. Moving works by
  opening the drawer on the other Break, which is discoverable enough at three breaks and would not be
  at thirty.
- **The drawer's edit mode and Remove link were never exercised in a browser**, and neither was the
  reduced-motion CTA transition. Same standing gap as every UI story since 2.1.

## Deferred from: Story 5.1 (2026-09-01)

- ~~**The invite drawer lives in the CrewZone header, not Settings.**~~ **RESOLVED 2026-09-01 in Story
  5.3.** `InviteDrawer` is deleted and its content is the Invite section of `/settings`. `BreaksDrawer`
  went the same way.
- **The clipboard path is unverified.** `navigator.clipboard.writeText` needs a secure context; the
  failure toast and the always-visible selectable URL are the fallback, and neither has been exercised
  in a browser.
- **Joining is still one-sided and irrevocable.** Anyone with the link joins the crew with no approval
  step, the token never rotates, and Story 5.3's crew removal will not invalidate a link already
  shared. Consistent with the existing 1.1 and 1.3 notes; the link is the only secret.
- **`getInviteLink` has no rate limit or audit.** Reading your own token is harmless, but nothing
  records that a link was generated or shared.

## Deferred from: Story 5.2 (2026-09-01)

- **`crew.joined` delivery through a live stream is unverified.** The emit is verified in-process and
  the route's handling is written, but triggering the event inside the server requires the join Server
  Action, which is browser-driven — an emit from a separate process cannot reach the server's listeners.
  The two halves are each tested; the seam is not.
- **`break.list` grows with the crew, not with the stack.** It now returns every visible Break, which at
  crew scale is a handful and at any real scale is not. If a crew ever creates dozens of Breaks, split
  the discovery list back out — but on a measurement, not a hunch.
- ~~**A user removed from a crew keeps seeing their saved Breaks.**~~ **DECIDED 2026-09-01 in Story
  5.3: they keep them.** Removal severs presence — neither side sees the other's check-ins — but a Break
  you saved is a spot you surf, not a friendship. `assertCrewMember`'s third rule stands.
- ~~**The stream's crew set only refreshes on `crew.joined` or a `break.created` miss.**~~ **RESOLVED
  2026-09-01 in Story 5.3** — `crew.removed` shares the same branch, so an open connection narrows
  immediately. Verified: the stream received `{"type":"crew.removed","breakId":null}`.
- **`listCrewUserIds` and `listVisibleBreakIds` both live in `assert-crew-member.ts`** and encode the
  same rules in three shapes (assert one, list Breaks, list people). They must change together; the file
  is small enough that this is a feature, not a smell — for now.
- **The widened drawer and the new empty-state action were not exercised in a browser.** Standing gap
  since Story 2.1.

## Deferred from: mock conditions source (2026-09-01)

- **`CONDITIONS_SOURCE=mock` must never reach production.** The numbers are invented and the screen they
  land on exists to tell someone whether to paddle out. The guards are: the env var defaults to
  `swellcloud`, the poll warns on every sweep, and `.env.example` and the README both say so. What does
  **not** exist is any in-app indication to the *viewer* that conditions are synthetic — if mock mode
  ever outlives the current stopgap, the UI should say so on the band.
- **Mock data hides the real integration risk.** Everything downstream is now proven, which makes it
  easy to forget that `pointResponseSchema` is still an assumed contract for an API nobody has ever had
  a successful response from. Reconciling it remains the first job when a provider is chosen.
- **The prompt's unit ban is a prompt, not a guarantee.** The model ignored the original instruction and
  wrote "1.9ft"; the hardened wording held across a re-run, but nothing in code prevents a future model
  from doing it again. A regex rejection in `enforceWordCeiling` would, at the cost of discarding an
  otherwise good verdict.
- **Verdict quality is unmeasured.** Two verdicts read well. There is no evaluation of tone, safety
  framing, or whether "worth paddling out" tracks the actual numbers — and a confidently wrong verdict
  is the most dangerous output this app can produce.

## Deferred from: Story 5.3 (2026-09-01)

- **Sign-out's browser round trip is unverified.** The session-row deletion is tested through the real
  helper; the cookie clear and the redirect are Server Action behaviour and need a browser.
- **Removing a crew member does not revoke a shared invite link.** They can rejoin instantly with a link
  they already have, because `inviteToken` never rotates. Removal is a soft boundary between people who
  trust each other, not a block.
- **`crew.remove` is one-sided in intent but two-sided in effect.** The other person is not told, and
  from their side it looks identical to the app losing data. At crew scale this is a conversation, not a
  feature — but it is worth knowing that no notification exists.
- **Notification toggles are decorative.** They render the current defaults and cannot be changed until
  Story 6.4. Someone could reasonably tap one and think it did something.
- **No account deletion.** Sign-out ends a session; the `User` row, its Breaks and its crew rows persist,
  and `breaks.created_by_id` is `RESTRICT`, so deleting a user who owns Breaks would fail (noted in 2.2).
- **`/settings` re-runs `crew.me` server-side on every load** just to guard the route, the same as `/`.
  Two round trips where middleware could do one if it could reach Prisma — which on Edge it cannot.

## Deferred from: Story 6.1 (2026-09-01)

- **Nothing PWA-shaped has been verified on a device.** "Add to Home Screen" appearing, the app opening
  without chrome, the status bar going translucent behind the navy band, the worker activating and
  serving from cache — all of it is device-bound and none of it is tested. **This is the highest-value
  manual check outstanding**, because Story 6.2's push only works from an installed PWA.
- **`npm run typecheck` does not cover `src/app/sw.ts`.** It is excluded so the WebWorker lib does not
  collide with the app's DOM lib. The build compiles it, so a type error there surfaces at build time
  rather than typecheck time — but nothing checks it in isolation.
- **The icons are programmatically generated, not designed.** Two parchment swell lines on navy, written
  by a throwaway `node:zlib` PNG encoder because no image library is installed. They are legible and
  on-palette, but they are a placeholder for real artwork.
- **No offline page.** The worker precaches build assets and falls back to cached tRPC queries, but a
  cold start with no network gets the browser's own error page. `navigationPreload` is on; an offline
  fallback route was not built.
- **The `kooks-trpc` cache has no expiry or size cap.** At crew scale the query set is tiny, but nothing
  evicts it.
- **A stale service worker can serve an old build.** `skipWaiting` and `clientsClaim` are both on, which
  makes updates take effect on the next load, but there is no in-app "new version available" prompt.

## Deferred from: Story 6.2 (2026-09-01)

- **No notification has ever reached a phone.** Everything up to the push service is verified against a
  local TLS receiver, but the last hop, the browser permission flow, `pushManager.subscribe`, and the
  worker rendering a notification are all untested. This and the 6.1 install check are the same
  real-device pass, and together they are the largest untested surface in the project.
- **`WEB_PUSH_EMAIL` is still `mailto:dev@example.com`.** VAPID requires a contact address that a push
  service can actually reach if it needs to complain about your traffic. Change it before real use.
- **Production `.env` has neither key.** The generated pair lives in the local `.env` only; `/opt/kooks/.env`
  on the VPS still has placeholders, and CI carries no secrets. **Regenerating a different pair for
  production would invalidate every existing subscription** — generate once, then keep it.
- **Push failures are invisible to the user.** A crew member whose subscription was pruned simply stops
  receiving notifications, with nothing in the app to say so. `notification.status` exists and could
  drive a "notifications are off" hint in Settings.
- **No rate limiting or batching.** Rapid check-in edits send one push per mutation, collapsed on the
  lock screen only by the shared `tag`. Fine for a crew of four.
- **The notification body assumes a short Break label.** Long labels are not truncated and will be cut
  by the OS mid-word.

## Deferred from: Story 6.3 (2026-09-01)

- **Neither scheduled job has fired on its own schedule.** Both sweeps were invoked directly; waiting
  until 9pm is not a test. The cron rows and timezone are verified, the trigger is not.
- **The night-before nudge previews the *current* read, not tomorrow.** FR-19 asks for next-day
  conditions and no forecast-ahead data exists. The copy is honest about it, but the requirement is only
  partly met, and it will stay that way until a conditions provider with forecast data is chosen.
- **`APP_TIMEZONE` is one timezone for the whole app.** Correct for one crew at one beach; a crew member
  travelling gets pushes on the home crew's clock.
- **A missing `NotificationPref` row counts as opted in.** That matches the column defaults and every
  user gets a row on join, but a row deleted by hand would silently re-enable notifications.
- **Both pushes fire regardless of conditions.** A flat, blown-out day still gets a 5am notification
  saying so. Arguably correct — "don't bother" is useful information — but it is a nightly interruption
  that nobody has opted into per-condition.

## Deferred from: Story 6.4 (2026-09-01)

- **Nobody has seen the new palette.** The contrast numbers are arithmetic and certain; whether a darker
  `--text-secondary` and an amber `--stale` still look like "Morning Light" is a judgement no one has
  made. First real-device pass should look at this as well as the PWA install.
- **`--divider` is `rgba(26,58,92,0.10)`** — about 1.1:1, far below the 3:1 WCAG 1.4.11 asks of
  meaningful UI boundaries. Left alone: the dividers are decorative separators between rows that are
  already distinguished by spacing and text, and darkening them would change the visual language
  everywhere. Revisit if a divider ever becomes the only thing conveying structure.
- **Focus return and switch semantics are unverified in a browser.** The code records and restores
  `document.activeElement`, and the switches carry `role="switch"`/`aria-checked`/`aria-labelledby`, but
  no screen reader has been near any of it.
- **The accessibility audit was source-and-arithmetic, not assistive-technology.** Contrast, tap targets
  and aria attributes were verified by measurement and inspection. Nobody has run VoiceOver, tabbed
  through the app, or tested with reduced motion actually enabled.
- **The preference switches have no optimistic update**, so each toggle waits a round trip. Correct per
  the V1 rule and fine on a fast connection; noticeable on a bad one.
