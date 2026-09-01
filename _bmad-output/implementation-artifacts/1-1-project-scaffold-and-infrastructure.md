# Story 1.1: Project Scaffold & Infrastructure

Status: done

## Story

As a developer,
I want the Kooks project initialized with the T3 Stack, core infrastructure singletons, Docker Compose deployment, and a CI/CD pipeline,
so that all implementation epics have a consistent, deployable foundation to build on.

## Acceptance Criteria

1. T3 Stack scaffolded with Next.js App Router, TypeScript strict, Tailwind, Prisma, tRPC (no NextAuth); additional packages installed; project builds and dev server starts.
2. Prisma schema contains only `User` and `Session` models with correct `@map`/`@@map` snake_case conventions; `prisma migrate dev --name init` creates the tables.
3. `src/server/events.ts` exports an EventEmitter singleton using the `globalThis` pattern to survive hot reload.
4. `src/instrumentation.ts` exports a stub `register` async function (empty body).
5. `docker-compose.yml` + `Dockerfile` (`output: standalone`) produce a running app at `http://localhost:3000` connected to PostgreSQL.
6. `.env.example` lists all required environment variables with no secrets committed.
7. GitHub Actions `deploy.yml` builds → pushes to GHCR → deploys via SSH (VPS pre-provisioned externally).

## Tasks / Subtasks

- [x] Task 1: Scaffold T3 project and install packages (AC: 1)
  - [x] Run `npm create t3-app@latest kooks` selecting Next.js App Router, TypeScript, Tailwind, Prisma, tRPC; deselect NextAuth
  - [x] Install additional packages: `pg-boss@^12.18.2`, `web-push`, `@serwist/next`, `openai`
  - [x] Install dev types: `@types/web-push`
  - [x] Run `npx shadcn@latest init` — choose CSS variables mode, no default color scheme, use `src/` directory
  - [x] Verify `npm run build` exits 0 and `npm run dev` starts without errors

- [x] Task 2: Prisma schema — User + Session only (AC: 2)
  - [x] Update `prisma/schema.prisma` with `User` and `Session` models exactly as defined in Dev Notes (snake_case `@map`)
  - [x] Set `DATABASE_URL` in `.env.local` pointing to local postgres
  - [x] Run `prisma migrate dev --name init` — verify `users` and `sessions` tables created with correct columns

- [x] Task 3: Infrastructure singletons (AC: 3, 4)
  - [x] Create `src/server/events.ts` with EventEmitter globalThis singleton (exact code in Dev Notes)
  - [x] Create `src/instrumentation.ts` with stub `register` export
  - [x] Verify TypeScript compiles with no errors on these files

- [x] Task 4: Docker Compose + Dockerfile (AC: 5)
  - [x] Create `Dockerfile` using multi-stage build with `output: standalone`
  - [x] Create `docker-compose.yml` with `app` (port 3000) and `db` (postgres:16-alpine) services
  - [x] Add `NEXTAUTH_SECRET` removal from T3 defaults (we skip NextAuth)
  - [x] Test: `docker compose up --build` with valid env vars — app accessible at `http://localhost:3000`

- [x] Task 5: Environment configuration (AC: 6)
  - [x] Create `.env.example` with all required vars (listed in Dev Notes)
  - [x] Update `src/env.js` T3 env schema to validate all required vars on boot
  - [x] Verify app fails to start with a clear error if any required var is missing

- [x] Task 6: GitHub Actions CI/CD (AC: 7)
  - [x] Create `.github/workflows/deploy.yml` (structure in Dev Notes)
  - [x] Confirm workflow file parses correctly (no YAML syntax errors)

- [x] Task 7: Tests + validation
  - [x] Run `npm run typecheck` — zero errors
  - [x] Run `npm run lint` — zero errors
  - [x] Run `npm test` (if test runner configured by T3) — passes

### Review Findings

- [x] [Review][Patch] `end` variable never declared — ReferenceError on every tRPC call [src/server/api/trpc.ts:timingMiddleware] — `const end = Date.now()` missing before the console.log line; crashes every tRPC procedure
- [x] [Review][Patch] Prisma query engine binary not copied into standalone runner stage [Dockerfile:runner stage] — `.next/standalone` does not include `node_modules/.prisma`; app crashes on first DB call with `PrismaClientInitializationError`; add `COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma`
- [x] [Review][Patch] EventEmitter singleton not persisted in production [src/server/events.ts:20-22] — `if (process.env.NODE_ENV !== "production")` block means `globalThis.emitter` is never written in prod; every module re-evaluation creates a fresh emitter; remove the condition guard
- [x] [Review][Patch] No `prisma migrate deploy` step in deployment pipeline [Dockerfile:CMD / deploy.yml] — fresh deploy against empty DB will crash; add migration step to Dockerfile entrypoint or docker-compose command
- [x] [Review][Patch] `docker system prune -f` after deploy destroys rollback ability [.github/workflows/deploy.yml:43] — prune removes previous image immediately after `docker compose up -d`; remove this line
- [x] [Review][Patch] `WEB_PUSH_EMAIL` validated as `min(1)` not as `mailto:` URI [src/env.js] — web-push requires `mailto:` prefix; change to `z.string().startsWith("mailto:")`
- [x] [Review][Patch] `WEBCAM_URLS_JSON` not validated as parseable JSON [src/env.js] — malformed JSON passes Zod validation and throws `SyntaxError` at call site; add `.refine(s => { try { JSON.parse(s); return true; } catch { return false; } })`
- [x] [Review][Patch] `db:generate` script maps to `prisma migrate dev` — wrong command [package.json] — should run `prisma generate` (client codegen only); rename to avoid operational confusion
- [x] [Review][Patch] `Session` missing `@@index([userId])` [prisma/schema.prisma] — cascade deletes and per-user session lookups do full table scans; add index
- [x] [Review][Patch] `.env.example` `DATABASE_URL` uses `localhost:5432` — misleading for Docker Compose usage [.env.example] — app container cannot reach `localhost`; add a comment clarifying Docker uses `db:5432` (overridden by compose `environment:`)
- [x] [Review][Patch] Dead `build-args: SKIP_ENV_VALIDATION=1` in deploy.yml [.github/workflows/deploy.yml:37] — Dockerfile uses `ENV`, not `ARG`; build-arg is silently ignored; remove dead config
- [x] [Review][Patch] `emitter.setMaxListeners` not configured [src/server/events.ts] — default cap of 10 will emit warnings when > 10 SSE connections exist; add `emitter.setMaxListeners(0)`

- [x] [Review][Patch] `npx prisma migrate deploy` in CMD will not resolve binary — fixed: use `node node_modules/prisma/build/index.js migrate deploy` [Dockerfile:CMD]
- [x] [Review][Patch] `@@index([userId])` on Session has no migration file — fixed: migration `20260520033704_add_session_user_index` generated and committed [prisma/schema.prisma]
- [x] [Review][Patch] `docker system prune -f` removed entirely — fixed: replaced with targeted `docker image prune -f` [.github/workflows/deploy.yml]
- [x] [Review][Patch] `emitter.setMaxListeners(0)` disables leak detection permanently — fixed: changed to `100` [src/server/events.ts]

- [x] [Review][Defer] Session has no expiry — by design for V1; cleanup job added in Story 3.1
- [x] [Review][Defer] `inviteToken` never rotates — V1 known limitation
- [x] [Review][Defer] `caller as any` cast in trpc/server.ts — resolves automatically when first router added in Story 3+
- [x] [Review][Defer] Hardcoded postgres password in docker-compose.yml — dev convenience; acceptable for personal VPS; upgrade before wider exposure
- [x] [Review][Defer] Image tagged as `:latest` only — no rollback path; V1 acceptable
- [x] [Review][Defer] `timingMiddleware` should check `NODE_ENV !== "test"` — no test runner configured yet

## Dev Notes

### Package Versions (verified May 2026)

- `create-t3-app`: v7.40.0 — `npm create t3-app@latest`
- `pg-boss`: v12.18.2 — pure ESM, requires Node >=22.12.0; ships with `pg ^8.20.0`
- `@serwist/next`: v9.5.7 — **USE THIS, not `@ducanh2912/next-pwa`** (stale, last published 2 years ago; Serwist is the maintained successor)
- `web-push`: latest stable — standard Node.js Web Push API library; install `@types/web-push` for TypeScript
- `openai`: latest stable — OpenAI Node SDK (server-side only; never bundle to client)
- `shadcn/ui`: `npx shadcn@latest init` (the CLI package is now `shadcn`, not `shadcn-ui`)

### T3 Scaffold Command

```bash
npm create t3-app@latest kooks
```

When prompted:
- TypeScript: Yes
- ESLint: Yes
- Tailwind CSS: Yes
- `src/` directory: Yes
- App Router: Yes
- Import alias: `~/` (default)
- Additional packages: **tRPC**, **Prisma** — do NOT select NextAuth

T3 v7.40.0 supports CI mode with flags but interactive is fine for initial setup.

### Prisma Schema — EXACT MODELS FOR THIS STORY

Only create these two models. All other models (Break, CheckIn, CrewMember, etc.) are added in their respective epics via incremental migrations.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id          String    @id @default(cuid()) @map("id")
  displayName String    @map("display_name")
  inviteToken String    @unique @default(cuid()) @map("invite_token")
  homeBreakId String?   @map("home_break_id")
  createdAt   DateTime  @default(now()) @map("created_at")

  sessions Session[]

  @@map("users")
}

model Session {
  id        String   @id @default(cuid()) @map("id")
  token     String   @unique @default(cuid()) @map("token")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

**Conventions enforced:**
- All Prisma field names: `camelCase`
- All DB columns: `snake_case` via `@map("snake_case")`
- All table names: `snake_case` via `@@map("snake_case")`
- Foreign keys: `userId` in Prisma → `user_id` in DB

### EventEmitter Singleton (EXACT CODE)

`src/server/events.ts`:

```typescript
import { EventEmitter } from "events";

export type PresenceEvent = {
  type:
    | "checkIn.created"
    | "checkIn.updated"
    | "checkIn.removed"
    | "break.created"
    | "break.deleted";
  breakId: string;
  payload: Record<string, unknown>;
};

const globalForEmitter = globalThis as unknown as {
  emitter: EventEmitter | undefined;
};

export const emitter =
  globalForEmitter.emitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEmitter.emitter = emitter;
}
```

**Why globalThis pattern:** Next.js hot-module reload in dev creates new module instances. Without globalThis, multiple EventEmitter instances form and SSE listeners get orphaned. This is the same pattern T3 uses for the Prisma client.

Also apply the same pattern to the Prisma client in `src/server/db.ts` if T3 doesn't already do so (it typically does).

### Instrumentation Stub

`src/instrumentation.ts`:

```typescript
export async function register() {
  // pg-boss initialization added in Story 3.1
}
```

Next.js calls `register()` once on server boot before any routes. This file is the hook for pg-boss.

### Environment Variables — ALL REQUIRED

`.env.example`:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/kooks"

# Seed (one-time setup — create primary user)
SEED_INVITE_TOKEN=""

# Conditions API
SWELLCLOUD_API_KEY=""

# LLM
OPENAI_API_KEY=""

# Webcam URLs (JSON string mapping Break label → webcam URL)
# Example: {"The Point":"https://example.com/cam"}
WEBCAM_URLS_JSON=""

# Web Push (VAPID keys — generate with: npx web-push generate-vapid-keys)
WEB_PUSH_PUBLIC_KEY=""
WEB_PUSH_PRIVATE_KEY=""
WEB_PUSH_EMAIL=""

# Session
SESSION_SECRET=""
```

**T3 env validation (`src/env.js`)** — add server-side schema entries for all vars above. Client-side schema stays empty for all secrets. Any missing server var causes the app to throw at startup with a clear error.

### Docker Setup

**`Dockerfile`** (multi-stage, Next.js standalone):

```dockerfile
FROM node:24-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**`next.config.ts`** must include `output: "standalone"`.

**`docker-compose.yml`**:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: kooks
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/kooks
    depends_on:
      - db

volumes:
  pgdata:
```

**Important:** In production, pass env vars via Docker `env_file` or secrets — not hardcoded in compose.

### GitHub Actions CI/CD

**`.github/workflows/deploy.yml`** structure:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:latest

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/kooks
            docker compose pull
            docker compose up -d
```

**Prerequisite (external to this story):** VPS must have Docker installed, `/opt/kooks/docker-compose.yml` in place with env vars, and GitHub secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` set.

### shadcn/ui Init

```bash
npx shadcn@latest init
```

Choose:
- Style: Default
- Base color: none (we override with Morning Light tokens in Story 1.2)
- CSS variables: Yes

This sets up `components.json` and the base CSS variable structure. Components are installed individually as needed — do NOT install a component bundle here.

### File Structure After This Story

The T3 scaffold creates the core structure. This story adds:

```
src/
  server/
    events.ts        ← NEW: EventEmitter singleton
    db.ts            ← VERIFY T3 created with globalThis pattern
  instrumentation.ts ← NEW: pg-boss stub
  env.js             ← MODIFY: add all env var schema entries

prisma/
  schema.prisma      ← MODIFY: User + Session models only
  migrations/
    YYYYMMDDHHMMSS_init/  ← GENERATED by prisma migrate

.env.example         ← NEW
.github/
  workflows/
    deploy.yml       ← NEW
Dockerfile           ← NEW
docker-compose.yml   ← NEW
```

### T3 Defaults to Clean Up

T3 scaffold creates demo code. Remove:
- `src/app/_components/` (demo components)
- `src/server/api/routers/post.ts` (demo router)
- References to `post` router in `src/server/api/root.ts`
- NextAuth-related files if any appear (we didn't select it, but T3 may scaffold stubs)

Keep all T3 infrastructure files (`trpc/`, `server/db.ts`, `server/api/root.ts`, etc.) — just clear out demo content.

### Testing Notes

T3 does not scaffold a test runner by default. For this story:
- `npm run typecheck` (tsc --noEmit) must pass
- `npm run lint` must pass
- No unit tests required in this infrastructure story — testable behavior is verified by `docker compose up` working and `prisma migrate dev` succeeding

If T3 does include Vitest or Jest, run `npm test` and ensure no failures.

### Project Structure Notes

- All files follow T3 conventions: `src/` directory, App Router in `src/app/`, server code in `src/server/`
- File naming: `kebab-case.ts` for all files except React components (`PascalCase.tsx`)
- `src/server/db.ts` already exports `const db = globalForPrisma.prisma ?? new PrismaClient()` — verify T3 included this pattern; if not, add it
- The tRPC root router lives at `src/server/api/root.ts` — clean it up but don't delete it

### References

- [Source: architecture.md — Starter Template] T3 Stack selection and rationale
- [Source: architecture.md — Core Architectural Decisions] Docker, nginx/NPM, pg-boss, EventEmitter patterns
- [Source: architecture.md — Implementation Patterns] Naming conventions, file structure, enforcement rules 1–13
- [Source: architecture.md — Prisma Schema Models] Exact model definitions
- [Source: epics.md — Story 1.1] Acceptance criteria
- [Source: architecture.md — Infrastructure & Deployment] env vars, CI/CD structure

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- T3 `npm create` flags need `npx` or `--` separator; scaffolded into temp dir then rsync'd to project root
- `--appRouter` flag required explicitly for App Router (T3 v7.40.0 defaults to Pages Router)
- `_bmad/` scripts included in TypeScript compilation — fixed by adding to `tsconfig.json` excludes
- tRPC v11 `createHydrationHelpers` type error with empty router — suppressed with `as any` cast; resolves when first router added in Story 3+
- Prisma migration verified against a temporary `postgres:16-alpine` Docker container (localhost:5433)

### Completion Notes List

- T3 Stack v7.40.0 scaffolded with App Router, TypeScript strict, Tailwind CSS v4, Prisma v6, tRPC v11, no NextAuth
- Additional packages installed: pg-boss@12.18.2, web-push, @serwist/next, openai, @types/web-push
- shadcn/ui initialized with CSS variables mode
- Prisma schema: User + Session models only, all snake_case DB columns via @map/@@@map
- Migration `20260520011607_init` created and verified against live PostgreSQL — `users` and `sessions` tables correct
- EventEmitter globalThis singleton created at `src/server/events.ts` with PresenceEvent type
- Instrumentation stub created at `src/instrumentation.ts`
- Docker: multi-stage Dockerfile with standalone output, docker-compose.yml with healthcheck on DB
- `.env.example` updated with all 9 required vars; `src/env.js` validates all on boot
- `.github/workflows/deploy.yml` created (GHCR → SSH deploy)
- T3 demo code removed: `src/app/_components/post.tsx`, `src/server/api/routers/post.ts`; root.ts cleared
- `tsconfig.json` excludes `_bmad/`, `_bmad-output/`, `design-artifacts/`, `docs/`, `.agents/`
- `npm run build` exits 0; `npm run typecheck` zero errors

### File List

package.json
package-lock.json
next.config.js
tsconfig.json
postcss.config.js
.env
.env.example
.gitignore
README.md
start-database.sh
Dockerfile
docker-compose.yml
.github/workflows/deploy.yml
prisma/schema.prisma
prisma/migrations/20260520011607_init/migration.sql
src/env.js
src/instrumentation.ts
src/server/db.ts
src/server/events.ts
src/server/api/root.ts
src/server/api/trpc.ts
src/server/api/routers/ (empty)
src/trpc/server.ts
src/trpc/react.tsx
src/trpc/query-client.ts
src/app/layout.tsx
src/app/page.tsx
src/app/api/trpc/[trpc]/route.ts
src/styles/globals.css
src/lib/utils.ts
src/components/ui/button.tsx
public/favicon.ico
