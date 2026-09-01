# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-and-infrastructure (2026-05-20)

- Session has no expiry field — by design for V1; cleanup job via pg-boss is planned in Story 3.1
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
- **`pino` is specified but not installed.** architecture.md mandates structured logging via `pino` and forbids `console.error` for server-side errors; the package is absent and the codebase uses `console`. Decide in Story 3.1 (first job code that genuinely needs structured logs): install `pino`, or amend the rule to `console`. Do not leave both states documented.
- **`@tailwindcss/safe-area` never installed.** Story 1.2 AC 4 called for it; equivalent `env(safe-area-inset-*)` utilities are hand-rolled in `globals.css` under `@layer utilities`. Functionally equivalent and one fewer dependency. `viewportFit: "cover"` is correctly exported, which is the part that actually gates the insets on device.
- **Safe-area behaviour never verified on a real device.** Insets always resolve to 0 outside iOS, so no amount of desktop-browser checking proves this. Carry into Story 2.1, the first story with real UI to look at.
- **`Session` still has no expiry** and the 1.1 note pointed at "Story 3.1" for a cleanup job — Story 3.1 as written in epics.md contains no such task. Either add it to 3.1 explicitly or accept sessions as permanent for V1 and say so. Currently it is neither.
- **Tailwind scans only `src/`** via `@import "tailwindcss" source("../")`. Without it, Tailwind v4 auto-scans the whole repo and mints dead utility rules from class names quoted in markdown docs. If component code is ever added outside `src/`, this must be widened.

## Deferred from: Story 1.3 (2026-08-31)

- **`prisma/seed.ts` instantiates `PrismaClient` directly**, violating enforcement rule 3 ("import `db` from `src/server/db.ts` — never instantiate Prisma elsewhere"). The seed runs outside the Next.js runtime, where neither the `~` path alias nor `~/env` validation are available. Deliberate, scoped to this one build-time script; do not use it as precedent in application code.
- **`src/middleware.ts` inlines the `kooks-session` cookie name** rather than importing `SESSION_COOKIE_NAME` from `~/server/auth/session`. Edge Runtime cannot load that module (it reaches Prisma and `~/env`). Two string literals now have to stay in sync — if the cookie name ever changes, change both.
- **Sessions still never expire and are never cleaned up.** `Max-Age` on the cookie is one year; the `sessions` row lives forever. The 1.1 note pointed at "Story 3.1" for a cleanup job, but Story 3.1 as written has no such task. Still unresolved — decide when pg-boss lands in 3.1.
- **`tsx` added as a devDependency** solely to run the TypeScript seed. Prisma's documented approach for ESM TypeScript projects; it does not ship in the runtime image.
- **`crew.joinViaInvite` is unauthenticated and unrate-limited.** Anyone holding an invite token can create unlimited accounts. Accepted at a 2–3 person crew scale — the token is the only secret and is shared privately — but it is the one public write endpoint in the app. Revisit alongside invite-link expiry/revocation if Kooks ever goes beyond a personal crew.
- **No sign-out.** `deleteSession` and `serializeClearedSessionCookie` exist in `src/server/auth/session.ts` but nothing calls them. There is no UI or procedure to end a session; clearing the cookie requires browser settings. Wire into the settings screen in Story 5.3.

## Deferred from: Story 2.1 (2026-08-31)

- **Morning Light fails WCAG AA on parchment for three tokens (NFR-9) — needs a design decision.** Measured against `--bg #f5f0e8`: `--text-secondary` 3.50:1, `--present` 3.74:1, `--stale` 1.71:1. All are used on 10–16px text, which requires 4.5:1. The UX spec states "all text/background pairs exceed WCAG AA" — that claim is wrong. Minimum darkening preserving hue and saturation: `--text-secondary` -> `#776c5f` (4.52:1), `--present` -> `#297c4e` (4.53:1), `--stale` -> `#796c59` (4.51:1). `--stale` at AA stops reading as muted, so the timestamp may want a size increase instead of a colour change. One-line fix per token in `globals.css`. **Decide before Story 6.4**, which otherwise audits a palette that is known to fail.
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
