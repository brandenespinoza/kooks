# Deferred Work

## Deferred from: code review of 1-1-project-scaffold-and-infrastructure (2026-05-20)

- Session has no expiry field — by design for V1; cleanup job via pg-boss is planned in Story 3.1
- `inviteToken` never rotates — V1 known limitation; revisit if app goes beyond personal crew
- `caller as any` cast in `src/trpc/server.ts` — temporary bootstrap; resolves automatically when first tRPC router is added in Story 3+
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
