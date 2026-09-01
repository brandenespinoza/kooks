---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: complete
completedAt: '2026-05-19'
inputDocuments:
  - _bmad-output/planning-artifacts/briefs/brief-Craps-2026-05-18/brief.md
  - _bmad-output/planning-artifacts/prds/prd-Craps-2026-05-19/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'Kooks'
user_name: 'Reef'
date: '2026-05-19'
---

# Architecture Decision Document — Kooks

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

> ### Where the code has diverged — audited 2026-08-31
>
> This document is the design record. Where the implementation differs, **the code wins**; the deltas below are known and accepted. See [`implementation-artifacts/deferred-work.md`](../implementation-artifacts/deferred-work.md) and [`sprint-plan.md`](../implementation-artifacts/sprint-plan.md).
>
> | This doc says | Reality | Why |
> |---|---|---|
> | `@ducanh2912/next-pwa` | `@serwist/next` (installed, not yet wired) | Chosen at implementation time; Epic 6 owns the wiring |
> | `pino` for structured logging | Not installed; `console` in use | Unresolved — decide in Story 3.1, see deferred-work |
> | `Break.webcamUrls String[]` | **Column dropped** | Contradicted FR-9, which specifies webcams come from `WEBCAM_URLS_JSON` and are not user-editable |
> | Schema built up across 5 story migrations | All 8 models landed in one migration on 2026-08-31 | No production data existed; unblocks real `assertCrewMember` from Story 1.3 |
> | `tailwind.config.ts`, `src/app/globals.css` | Tailwind v4 CSS-first; `src/styles/globals.css` | v4 has no JS config for this project |
> | `next.config.ts` | `next.config.js` | T3 scaffold default |
>
> Two additions not in the original design:
>
> - **`Break.conditionsModelRunAt`** — stores the SwellCloud model-run timestamp so the LLM verdict is regenerated only when the model run changes (FR-8's 4×-daily ceiling) rather than on every 30-minute poll (FR-7's freshness requirement). Without this the two requirements conflict.
> - **Indexes** beyond the original schema: `breaks.created_by_id`, `user_saved_breaks.break_id`, `crew_members.friend_id`, `check_ins.break_id`, `check_ins.eta`, and a unique `push_subscriptions.endpoint`. The `eta` index serves the expiry job; the unique endpoint prevents duplicate subscription rows for one device.

---

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 23 FRs across 6 feature areas — Break management, Conditions, Check-In, Social Graph, Notifications, and Accounts. Core value is delivered by the intersection of real-time presence (Check-In) and scheduled conditions data (Conditions Verdict).

**Non-Functional Requirements:**
- Check-in/break changes visible to crew within 5 seconds → real-time channel required
- Push notifications within 30 seconds of check-in event → server-side push on event
- Conditions data no older than 30 minutes → background polling job
- LLM API key never client-side → all LLM calls server-side
- Friend presence scoped to direct crew only → authorization on all real-time data
- PWA, iOS 16.4+, home screen installation required for push

**Scale & Complexity:**
- Complexity level: Medium
- Primary domain: Full-stack PWA + API server + scheduled jobs
- V1 user scale: 1 primary + 2–3 crew (tiny data volume, non-trivial infrastructure)

### Technical Constraints & Dependencies

- SwellCloud API (`api.swellcloud.net`) — coordinate-based, 4× daily update cadence
- OpenAI GPT-5.4 nano — server-side only, called per SwellCloud update per Break, cached
- Web Push API — PWA push on iOS requires home screen installation (iOS 16.4+)
- No email/password auth — invite-link-only onboarding; device-persistent session
- Webcam links — static, curator-supplied via `.env`, no external webcam API

### Cross-Cutting Concerns Identified

1. **Real-time data sync** — sub-5s propagation of check-in and break changes to all crew
2. **Scheduled jobs** — SwellCloud polling, LLM verdict generation, push notification scheduling (9pm + 5am)
3. **Non-standard auth** — invite-link session; no credentials; device-persistent identity
4. **External API management** — SwellCloud + OpenAI rate/cost management
5. **PWA push** — iOS-specific constraints; service worker lifecycle; permission UX
6. **Check-in auto-expiry** — server-side TTL enforcement; 2h after stated ETA

---

## Starter Template Evaluation

### Primary Technology Domain

Full-stack TypeScript PWA — React frontend via Next.js, Node.js backend, PostgreSQL, real-time presence via SSE, scheduled jobs via pg-boss.

### Selected Starter: T3 Stack

**Initialization Command:**

```bash
npm create t3-app@latest kooks
# Select: Next.js, TypeScript, Tailwind, Prisma, tRPC — skip NextAuth
```

**Rationale:** T3 provides end-to-end TypeScript from database to browser with Prisma + tRPC wired together. Tailwind is included. shadcn/ui installs on top via CLI. Self-hosted Next.js with Node.js runtime handles SSE connections without serverless timeout constraints.

**Architectural Decisions Provided by Starter:**

- Language & Runtime: TypeScript strict mode, Node.js, Next.js 15 App Router
- Styling: Tailwind CSS (shadcn/ui compatible)
- API layer: tRPC — end-to-end type-safe, no codegen, mutations + queries
- ORM: Prisma with PostgreSQL
- Build tooling: Next.js bundler, ESLint, Prettier
- Project structure: App Router conventions, `/src/server/`, `/src/app/`, `/src/trpc/`

**Additional Packages:**

| Package | Purpose |
|---|---|
| `pg-boss` | Cron scheduler + job queue on PostgreSQL — SwellCloud polling, LLM generation, push notification scheduling |
| `web-push` | Web Push API for PWA push notifications to crew devices |
| `@ducanh2912/next-pwa` | Service worker + PWA manifest (actively maintained next-pwa fork) |
| `openai` | OpenAI SDK — server-side only, never bundled to client |
| shadcn/ui (CLI) | Component primitives installed per-component into codebase |

**Real-time approach: SSE over WebSockets**
Server-Sent Events via Next.js route handlers (`/api/presence/stream`). Self-hosted removes all timeout constraints. Clients subscribe to SSE; send updates via tRPC mutations. Adequate for V1 crew size of 2–3.

**Note:** Project initialization using this command is the first implementation story.

---

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Session / auth model (invite-link + HttpOnly cookie token)
- SSE broadcast mechanism (in-process EventEmitter)
- Conditions caching location (Break table in PostgreSQL)
- Check-in auto-expiry mechanism (pg-boss cleanup job)

**Important Decisions (Shape Architecture):**
- tRPC router structure (5 routers mapped to feature areas)
- Routing strategy (single `/` route for Break swipe stack)
- Push subscription storage (PushSubscription table)
- pg-boss initialization (inside Next.js app server on boot)

**Deferred Decisions (Post-V1):**
- Multi-instance SSE (Postgres LISTEN/NOTIFY — not needed at V1 scale)
- Monitoring dashboard (logs only in V1)
- Rate limiting (trivial scale in V1)

### Data Architecture

**Conditions caching:** Cached in the `Break` table. Columns: `conditionsVerdict` (string), `rawData` (JSON), `conditionsUpdatedAt` (timestamp). No separate cache layer — Postgres is the source of truth.

**Check-in auto-expiry:** pg-boss recurring job runs every 5 minutes, deletes `CheckIn` rows where `eta + 2 hours < now()`. Explicit, logged, consistent with pg-boss usage elsewhere.

**Migration approach:** Prisma Migrate. `prisma migrate dev` locally. `prisma migrate deploy` runs in Docker startup entrypoint before app server starts.

### Authentication & Security

**Session model:** `Session` table with random UUID token. On invite-link tap → create `User` + `Session` row → set `kooks-session` HttpOnly, SameSite=Strict, Secure cookie. All tRPC context reads this cookie and attaches the authed user.

**Invite link:** Each `User` has a persistent `inviteToken` (UUID). Link format: `/join/[inviteToken]`. Tapping creates a new `User` + `Session` + mutual `Crew` connection, or (if already authed) connects the existing user to the inviter.

**Authorization:** Every tRPC procedure touching Break/CheckIn data calls `assertCrewMember(ctx, breakId)` — verifies requesting user shares a crew connection with the resource. Throws `FORBIDDEN` if not.

**TLS:** Handled by Nginx Proxy Manager upstream. Next.js app runs HTTP internally; NPM terminates TLS.

### API & Communication Patterns

**tRPC routers:**
- `breakRouter` — CRUD, Home Break designation, crew visibility
- `checkInRouter` — create, edit, remove; triggers SSE broadcast
- `crewRouter` — list crew, remove member, generate/consume invite link
- `conditionsRouter` — fetch cached verdict + raw data per break
- `notificationRouter` — save push subscription, update per-type preferences

**SSE endpoint:** Plain Next.js route handler at `/api/presence/stream` (not tRPC — requires streaming response). Client subscribes on Break screen mount. Server broadcasts on check-in and break events.

**SSE broadcast mechanism:** In-process `EventEmitter` singleton (`src/server/events.ts`). tRPC mutations emit events; SSE handler listens and writes to open response streams. Valid for single-instance self-hosted deployment. Migrate to Postgres LISTEN/NOTIFY if multi-instance ever needed.

**Error handling:** `TRPCError` with typed codes (`UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`). Client `onError` → shadcn/ui Toast for user-facing messages.

### Frontend Architecture

**State management:** tRPC + TanStack Query (included in T3). No Zustand or Redux. SSE events call `queryClient.invalidateQueries(['presence', breakId])` to trigger refetch of crew presence data. Full state strategy.

**Routing:**
- `/` — Break swipe stack (client-side swipe state; URL does not change per swipe)
- `/join/[inviteToken]` — invite link handler + onboarding
- `/settings` — settings sheet/modal

**PWA:** `@ducanh2912/next-pwa` — generates service worker and web app manifest. Cache strategy: cache-first for static assets, network-first with stale fallback for conditions API routes.

**Push subscription:** Registered in service worker, stored in `PushSubscription` table via `notificationRouter.subscribe` tRPC mutation. Linked to `User`.

### Infrastructure & Deployment

**Docker Compose:**
```
app   — Next.js standalone (port 3000)
db    — postgres:16-alpine
```

**Next.js config:** `output: 'standalone'` — minimal production image.

**pg-boss:** Initialized inside the Next.js app server on boot (`src/server/jobs/index.ts`). Registers all cron jobs against the same PostgreSQL instance: SwellCloud poll (4× daily), LLM verdict generation (on SwellCloud update), dawn patrol push (5–5:30am), night-before nudge (~9pm), check-in expiry cleanup (every 5 min).

**Reverse proxy:** nginx via Nginx Proxy Manager (already provisioned). NPM handles TLS termination and proxies to Docker `app` container on port 3000.

**Logging:** `pino` — structured JSON logs. V1 logs only; no monitoring dashboard.

**CI/CD:** GitHub Actions → `docker build` → push to GHCR → SSH to VPS → `docker compose pull && docker compose up -d`.

**Required environment variables:**
```
DATABASE_URL
OPENAI_API_KEY
SWELLCLOUD_API_KEY
WEBCAM_URLS_JSON
WEB_PUSH_PUBLIC_KEY
WEB_PUSH_PRIVATE_KEY
WEB_PUSH_EMAIL
SESSION_SECRET
```

### Decision Impact Analysis

**Implementation sequence implied by decisions:**
1. T3 scaffold + Prisma schema + Docker Compose setup
2. Auth system (Session table, invite-link flow, cookie middleware)
3. tRPC routers (break, crew, conditions, checkIn, notification)
4. SSE endpoint + EventEmitter broadcast
5. pg-boss initialization + all cron jobs
6. PWA setup (manifest, service worker, push subscription)
7. Frontend components (BreakScreen, VerdictBand, CrewZone, CheckInDrawer)

**Cross-component dependencies:**
- Auth context is required by all tRPC routers — must be first
- SSE broadcast depends on EventEmitter singleton — must be initialized before app starts accepting requests
- pg-boss depends on DATABASE_URL and must start after Prisma migrations run
- Push notifications depend on push subscription stored during PWA setup

---

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Prisma schema):**
- Model names: `PascalCase` singular — `User`, `Break`, `CheckIn`, `Session`, `PushSubscription`
- Prisma field names: `camelCase` — `userId`, `inviteToken`, `conditionsVerdict`
- DB column mapping: `@map("snake_case")` on every field; `@@map("snake_case")` on every model
- Foreign keys: `userId` in schema → `user_id` in DB

**Code:**
- React components: `PascalCase.tsx` — `BreakScreen.tsx`, `CheckInDrawer.tsx`
- All other files: `kebab-case.ts` — `break-router.ts`, `session-utils.ts`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Zod schemas: `camelCase` + `Schema` suffix — `createCheckInSchema`, `updateBreakSchema`
- tRPC routers: `camelCase` + `Router` suffix — `breakRouter`, `checkInRouter`
- tRPC procedures: verb-first camelCase — `create`, `update`, `remove`, `list`, `getById`

**SSE events:** dotted camelCase — `checkIn.created`, `checkIn.updated`, `checkIn.removed`, `break.created`, `break.deleted`

### Structure Patterns

```
src/
  app/                      # Next.js App Router
    (app)/                  # Authenticated route group
      page.tsx              # Break swipe stack
    join/[inviteToken]/     # Invite link handler
    api/
      presence/
        stream/route.ts     # SSE endpoint
  components/               # React components (PascalCase files)
  server/
    api/routers/            # tRPC routers (one file per router)
    db.ts                   # Prisma client singleton (export const db)
    events.ts               # EventEmitter singleton (export const emitter)
    jobs/                   # pg-boss job definitions (one file per job group)
    push/                   # web-push helpers
    auth/                   # Session helpers, assertCrewMember
  trpc/                     # tRPC setup (router.ts, client.ts, server.ts)
  lib/                      # Shared pure utilities
  types/                    # Shared TypeScript types
```

Tests: co-located `*.test.ts` files next to the file they test. No separate `__tests__` directory.

### Format Patterns

**tRPC responses:** return typed data directly — no envelope wrapper. Never return `{ success: true, data: ... }` — just return the data.

**Dates:** `DateTime` in Prisma → ISO 8601 string in tRPC output → `Date` object only when needed client-side. Never pass Unix timestamps; always ISO strings across the wire.

**SSE event shape** — all agents must use this exact type:
```typescript
type PresenceEvent = {
  type: 'checkIn.created' | 'checkIn.updated' | 'checkIn.removed' | 'break.created' | 'break.deleted'
  breakId: string
  payload: Record<string, unknown>
}
```

### Communication Patterns

**tRPC context:** The `ctx` object always contains `{ db, user, session }`. `user` is `null` on public procedures, typed `User` on protected procedures.

**Protected vs public procedures:**
- `publicProcedure` — invite link handler and onboarding only
- `protectedProcedure` — everything else; reads `kooks-session` cookie, throws `UNAUTHORIZED` if invalid

**`assertCrewMember(ctx, breakId)`** — must be called at the top of any procedure that reads or writes break-specific data. Throws `FORBIDDEN` if the requesting user is not crew with the break owner.

**SSE broadcast:** emit on the singleton `emitter` from `src/server/events.ts`. Never import and re-create the emitter. Emit only after a successful DB write.

### Process Patterns

**Loading states:** use TanStack Query's `isLoading` / `isPending` — never create custom `useState` loading booleans for server data.

**Optimistic updates:** not used in V1. All updates are server-confirmed before UI reflects them.

**Error handling:**
- tRPC layer: `TRPCError` with typed codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`)
- React layer: `onError` callback on tRPC mutation → shadcn/ui `toast()` for user-facing messages
- Never `console.error` user-facing errors; use `pino` logger server-side

**Prisma client:** always import from `src/server/db.ts` as `db`. Never instantiate `new PrismaClient()` elsewhere.

**pg-boss client:** always import from `src/server/jobs/index.ts`. Never instantiate `new PgBoss()` elsewhere.

### Enforcement Rules

All agents MUST:

1. Use `protectedProcedure` for every tRPC procedure except invite-link/onboarding
2. Call `assertCrewMember(ctx, breakId)` before accessing any break-specific data
3. Import `db` from `src/server/db.ts` — never instantiate Prisma directly
4. Import `emitter` from `src/server/events.ts` — never create a new EventEmitter
5. Emit SSE events only after a successful DB write, never speculatively
6. Use the `PresenceEvent` type for all SSE payloads — no freeform event shapes
7. Return typed data directly from tRPC procedures — no response envelope wrappers
8. Use `kebab-case` for file names except React components (`PascalCase.tsx`)
9. Map all Prisma fields to `snake_case` DB columns via `@map`
10. Never expose `OPENAI_API_KEY`, `WEB_PUSH_PRIVATE_KEY`, or `SESSION_SECRET` to client bundles

---

## Project Structure & Boundaries

### Complete Project Directory Structure

```
kooks/
├── .env.example
├── .env.local                        # Never committed
├── .gitignore
├── .github/
│   └── workflows/
│       └── deploy.yml                # Build → GHCR → SSH deploy
├── docker-compose.yml                # app + db services
├── Dockerfile                        # Next.js standalone build
├── next.config.ts                    # output: standalone, PWA plugin
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── prisma/
│   ├── schema.prisma                 # All models: User, Break, CheckIn, Session, etc.
│   └── migrations/                   # Prisma migration history
├── public/
│   ├── manifest.json                 # PWA web app manifest
│   ├── icons/                        # PWA icons (192, 512)
│   └── sw.js                         # Service worker (generated by next-pwa)
└── src/
    ├── middleware.ts                  # Session cookie auth guard
    ├── env.js                         # Type-safe env vars (T3 env)
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                 # Root layout, error boundary, PWA meta
    │   ├── page.tsx                   # Break swipe stack (authenticated)
    │   ├── join/
    │   │   └── [inviteToken]/
    │   │       └── page.tsx           # Invite link handler + onboarding (FR-15, FR-16)
    │   ├── settings/
    │   │   └── page.tsx               # Settings sheet (breaks, crew, notifications)
    │   └── api/
    │       ├── trpc/
    │       │   └── [trpc]/route.ts    # tRPC HTTP handler
    │       └── presence/
    │           └── stream/route.ts    # SSE endpoint (FR-10, FR-11, FR-12)
    ├── components/
    │   ├── BreakScreen.tsx            # Full-viewport root (FR-2)
    │   ├── VerdictBand.tsx            # Navy header zone (FR-5, FR-6, FR-7, FR-9)
    │   ├── CrewZone.tsx               # Parchment crew zone (FR-10–13)
    │   ├── CrewMemberRow.tsx          # Single presence entry
    │   ├── CheckInCTA.tsx             # Primary action button (default + checked-in states)
    │   ├── CheckInDrawer.tsx          # Bottom sheet check-in flow (FR-10, FR-11, FR-12)
    │   ├── ETAPicker.tsx              # Custom time wheel
    │   ├── EmptyCrewState.tsx         # No crew checked in state
    │   ├── RawDataPanel.tsx           # Tap-to-reveal conditions data (FR-6)
    │   ├── WebcamLink.tsx             # Webcam shortcut (FR-9)
    │   ├── SwipeDots.tsx              # Break position indicator (FR-2)
    │   ├── BreakSwipeStack.tsx        # Horizontal swipe container (FR-2)
    │   ├── OnboardingForm.tsx         # Display name entry (FR-23)
    │   ├── NotificationPrompt.tsx     # PWA push permission (FR-18–20)
    │   └── ui/                        # shadcn/ui primitives (Drawer, Button, Toast, etc.)
    ├── server/
    │   ├── db.ts                      # Prisma client singleton (export const db)
    │   ├── events.ts                  # EventEmitter singleton (export const emitter)
    │   ├── api/
    │   │   ├── root.ts                # tRPC app router (merges all sub-routers)
    │   │   └── routers/
    │   │       ├── break-router.ts    # FR-1, FR-2, FR-3, FR-4a, FR-4b
    │   │       ├── check-in-router.ts # FR-10, FR-11, FR-12, FR-13
    │   │       ├── conditions-router.ts # FR-5, FR-6, FR-7, FR-8
    │   │       ├── crew-router.ts     # FR-14, FR-15, FR-16, FR-17
    │   │       └── notification-router.ts # FR-18, FR-19, FR-20, FR-21
    │   ├── auth/
    │   │   ├── session.ts             # getSession(), createSession(), deleteSession()
    │   │   └── assert-crew-member.ts  # assertCrewMember(ctx, breakId)
    │   ├── jobs/
    │   │   ├── index.ts               # pg-boss init + register all jobs
    │   │   ├── conditions-jobs.ts     # SwellCloud poll + LLM verdict gen (FR-7, FR-8)
    │   │   ├── notification-jobs.ts   # Dawn patrol + night-before push (FR-19, FR-20)
    │   │   └── checkin-jobs.ts        # Auto-expiry cleanup every 5 min (FR-13)
    │   └── push/
    │       ├── web-push.ts            # send(), vapidKeys, subscription helpers
    │       └── notification-templates.ts # Push message copy per notification type
    ├── trpc/
    │   ├── server.ts                  # Server-side tRPC caller
    │   ├── client.ts                  # Client-side tRPC hooks
    │   └── react.tsx                  # tRPC React provider
    ├── lib/
    │   ├── utils.ts                   # cn() and other pure utilities
    │   ├── swellcloud.ts              # SwellCloud API client
    │   ├── openai.ts                  # OpenAI client (server-only)
    │   └── time.ts                    # ETA helpers, expiry calculations
    └── types/
        ├── presence.ts                # PresenceEvent type + SSE payload types
        └── api.ts                     # Shared API input/output types
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Location | Auth |
|---|---|---|
| tRPC API | `/api/trpc/[trpc]` | `protectedProcedure` (all except join) |
| SSE stream | `/api/presence/stream` | Session cookie validated on connect |
| Invite link handler | `/join/[inviteToken]` | `publicProcedure` |
| SwellCloud API | `src/lib/swellcloud.ts` | Server-only, API key from env |
| OpenAI API | `src/lib/openai.ts` | Server-only, API key from env |
| Web Push | `src/server/push/web-push.ts` | Server-only, VAPID keys from env |

**Component Boundaries:**
- `BreakSwipeStack` owns swipe state and renders one `BreakScreen` per saved break
- `BreakScreen` receives `breakId` and fetches its own data via tRPC
- `VerdictBand` and `CrewZone` are purely presentational — data passed as props from `BreakScreen`
- `CheckInDrawer` manages its own open/closed state; opened by `CheckInCTA` tap
- No component below `BreakScreen` makes direct tRPC calls

**Data Boundaries:**
- Conditions data cached in `Break` table — written by `conditions-jobs`, read by `conditions-router`
- Check-in presence in `CheckIn` table — written by `check-in-router`, expired by `checkin-jobs`
- Push subscriptions in `PushSubscription` table — written by `notification-router`, read by `push/web-push.ts`
- Session tokens in `Session` table — managed exclusively by `server/auth/session.ts`

### Requirements to Structure Mapping

| Feature area | FRs | Primary files |
|---|---|---|
| Break management | FR-1–4b | `break-router.ts`, `BreakScreen.tsx`, `BreakSwipeStack.tsx` |
| Conditions | FR-5–9 | `conditions-router.ts`, `conditions-jobs.ts`, `VerdictBand.tsx`, `RawDataPanel.tsx`, `WebcamLink.tsx` |
| Check-In | FR-10–13 | `check-in-router.ts`, `checkin-jobs.ts`, `events.ts`, `stream/route.ts`, `CheckInDrawer.tsx`, `CheckInCTA.tsx` |
| Social graph | FR-14–17 | `crew-router.ts`, `join/[inviteToken]/page.tsx`, `OnboardingForm.tsx` |
| Notifications | FR-18–21 | `notification-router.ts`, `notification-jobs.ts`, `web-push.ts`, `notification-templates.ts` |
| Auth | FR-22–23 | `session.ts`, `assert-crew-member.ts`, `middleware.ts`, `join/[inviteToken]/page.tsx` |

**Cross-cutting concerns:**

| Concern | Location |
|---|---|
| Auth enforcement | `src/middleware.ts` + `protectedProcedure` in tRPC root |
| Crew authorization | `src/server/auth/assert-crew-member.ts` |
| SSE broadcast | `src/server/events.ts` (singleton) |
| Env validation | `src/env.js` (T3 env — throws at startup if vars missing) |
| Error toasts | shadcn/ui `toast()` called in tRPC `onError` handlers |

### Data Flow

```
SwellCloud API (4× daily)
  → conditions-jobs.ts (pg-boss cron)
  → openai.ts (GPT-5.4 nano verdict generation)
  → Break table (conditionsVerdict, rawData, conditionsUpdatedAt)
  → conditions-router.ts (read by client on mount)
  → VerdictBand.tsx (rendered)

User taps "I'm in"
  → CheckInDrawer.tsx (tRPC mutation: checkIn.create)
  → check-in-router.ts (writes CheckIn row to DB)
  → events.ts (emit checkIn.created)
  → stream/route.ts (SSE push to all open crew connections)
  → queryClient.invalidateQueries (crew presence refetch on client)
  → CrewZone.tsx (re-renders with new presence)
  → web-push.ts (send push notification to crew devices) ← parallel

pg-boss every 5 min
  → checkin-jobs.ts
  → DELETE CheckIn WHERE eta + 2h < now()
  → events.ts (emit checkIn.removed for each expired row)
  → SSE stream pushes removal to connected clients
```

---

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** ✅ All technology choices compose cleanly. T3 + Prisma + PostgreSQL + pg-boss + SSE + web-push + shadcn/ui stack has no version conflicts.

**Issues Found & Resolved:**

1. **pg-boss initialization** — Next.js App Router has no startup lifecycle hook. Resolution: `src/instrumentation.ts` (Next.js 13.4+) runs once on server boot before any routes are served. pg-boss initialization moves here. File added to project structure.

2. **EventEmitter singleton in dev** — Next.js hot reload can create multiple EventEmitter instances. Resolution: global singleton pattern in `src/server/events.ts` using `globalThis`:
```typescript
const globalForEmitter = globalThis as { emitter?: EventEmitter }
export const emitter = globalForEmitter.emitter ?? new EventEmitter()
if (process.env.NODE_ENV !== 'production') globalForEmitter.emitter = emitter
```

3. **SSE route caching** — Next.js may statically optimize route handlers. Resolution: `export const dynamic = 'force-dynamic'` required in `src/app/api/presence/stream/route.ts`.

### Requirements Coverage Validation

All 23 FRs across 6 feature areas are architecturally supported. All NFRs addressed:
- 5s presence propagation → SSE + in-process EventEmitter
- 30s push notification → web-push triggered synchronously on check-in mutation
- 30min conditions freshness → pg-boss 4× daily SwellCloud poll
- API keys never client-side → T3 env validation + server-only file boundaries
- Crew-scoped data access → `assertCrewMember()` on all break-specific procedures
- PWA iOS 16.4+ → `@ducanh2912/next-pwa` service worker + Web Push API

### Prisma Schema Models

```prisma
model User {
  id          String   @id @default(cuid()) @map("id")
  displayName String   @map("display_name")
  inviteToken String   @unique @default(cuid()) @map("invite_token")
  homeBreakId String?  @map("home_break_id")
  createdAt   DateTime @default(now()) @map("created_at")

  sessions          Session[]
  pushSubscriptions PushSubscription[]
  checkIns          CheckIn[]
  createdBreaks     Break[]            @relation("BreakCreator")
  savedBreaks       UserSavedBreak[]
  crewAsUser        CrewMember[]       @relation("CrewUser")
  crewAsFriend      CrewMember[]       @relation("CrewFriend")
  notificationPrefs NotificationPref?

  @@map("users")
}

model Session {
  id        String   @id @default(cuid()) @map("id")
  token     String   @unique @default(cuid()) @map("token")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model Break {
  id          String   @id @default(cuid()) @map("id")
  label       String   @map("label")
  lat         Float    @map("lat")
  lng         Float    @map("lng")
  createdById String   @map("created_by_id")
  createdAt   DateTime @default(now()) @map("created_at")

  conditionsVerdict   String?   @map("conditions_verdict")
  rawData             Json?     @map("raw_data")
  conditionsUpdatedAt DateTime? @map("conditions_updated_at")
  // Added 2026-08-31 — SwellCloud model-run timestamp; gates verdict regeneration (FR-8)
  conditionsModelRunAt DateTime? @map("conditions_model_run_at")
  // REMOVED 2026-08-31: webcamUrls String[] — contradicted FR-9 (webcams come from
  // WEBCAM_URLS_JSON, static and not user-editable). See deferred-work.md.

  createdBy User             @relation("BreakCreator", fields: [createdById], references: [id])
  savedBy   UserSavedBreak[]
  checkIns  CheckIn[]

  @@map("breaks")
}

model UserSavedBreak {
  userId    String @map("user_id")
  breakId   String @map("break_id")
  sortOrder Int    @default(0) @map("sort_order")
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  break     Break  @relation(fields: [breakId], references: [id], onDelete: Cascade)

  @@id([userId, breakId])
  @@map("user_saved_breaks")
}

model CrewMember {
  userId   String @map("user_id")
  friendId String @map("friend_id")
  user     User   @relation("CrewUser", fields: [userId], references: [id], onDelete: Cascade)
  friend   User   @relation("CrewFriend", fields: [friendId], references: [id], onDelete: Cascade)

  @@id([userId, friendId])
  @@map("crew_members")
}

model CheckIn {
  id        String   @id @default(cuid()) @map("id")
  userId    String   @unique @map("user_id")
  breakId   String   @map("break_id")
  eta       DateTime @map("eta")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  break     Break    @relation(fields: [breakId], references: [id], onDelete: Cascade)

  @@map("check_ins")
}

model PushSubscription {
  id        String   @id @default(cuid()) @map("id")
  userId    String   @map("user_id")
  endpoint  String   @map("endpoint")
  p256dh    String   @map("p256dh")
  auth      String   @map("auth")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("push_subscriptions")
}

model NotificationPref {
  userId        String  @id @map("user_id")
  friendCheckIn Boolean @default(true) @map("friend_check_in")
  nightBefore   Boolean @default(true) @map("night_before")
  dawnPatrol    Boolean @default(true) @map("dawn_patrol")
  user          User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notification_prefs")
}
```

### Updated Enforcement Rules (additions to rules 1–10)

11. Add `export const dynamic = 'force-dynamic'` to `src/app/api/presence/stream/route.ts`
12. Use global singleton pattern for `emitter` in `src/server/events.ts` (prevents dev HMR duplication)
13. Initialize pg-boss in `src/instrumentation.ts`, not in a route handler or component

**Added 2026-08-31:**

14. **Design tokens are Tailwind utilities, never bracket syntax.** Write `bg-action`, `text-text-secondary`, `border-divider`. Never `bg-[--action]` — Tailwind v4 dropped the bare-variable shorthand and it compiles to a declaration the browser discards silently, so the style vanishes with no error anywhere. Tokens are registered in the `@theme inline` block of `src/styles/globals.css`. Arbitrary *values* remain fine (`max-w-[430px]`, `text-[28px]`).
15. **`src/middleware.ts` must not touch the database.** Next.js middleware runs on Edge Runtime, which cannot reach Prisma. Middleware does a `kooks-session` cookie-presence check only; real session validation belongs in `protectedProcedure`. This is the same Edge constraint already noted for `src/server/events.ts`.
16. **Do not add a schema migration unless the story genuinely changes the schema.** All 8 models exist as of migration `20260901005755_full_schema`.

### Updated Project Structure (addition)

```
src/
  instrumentation.ts    # pg-boss init + job registration (runs on server boot)
```

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- All 23 FRs mapped to specific files
- Non-standard auth (invite-link session) fully specified
- Real-time strategy (SSE + EventEmitter) appropriate for V1 scale with no extra infrastructure
- Scheduled jobs consolidated on pg-boss against existing PostgreSQL
- Prisma schema fully defined with all models and relations
- Three implementation issues found and resolved during validation

**Areas for Future Enhancement:**
- Multi-instance SSE via Postgres LISTEN/NOTIFY if horizontal scaling is ever needed
- VAPID key rotation process for push notifications
- Monitoring and alerting beyond pino logs

### Implementation Handoff

**First implementation story:**
```bash
npm create t3-app@latest kooks
# Select: Next.js, TypeScript, Tailwind, Prisma, tRPC — skip NextAuth
```

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use enforcement rules 1–13 as a checklist before submitting any implementation
- Refer to the Prisma schema section for exact model definitions — do not invent models
- Respect the project structure — no file created outside the defined tree
- Consult the data flow diagram before implementing any feature that touches SSE or pg-boss
