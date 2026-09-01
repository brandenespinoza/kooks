# Story 1.3: Invite Link Join & Account Creation

Status: done

## Story

As a new user,
I want to tap an invite link, enter only a display name, and immediately access the app,
so that I can join Kooks in under 90 seconds with zero friction.

## Acceptance Criteria

1. **Given** `prisma/seed.ts` creates a primary `User` row with `inviteToken` sourced from `SEED_INVITE_TOKEN`
   **When** `npm run db:seed` is run
   **Then** the primary user exists and `/join/[SEED_INVITE_TOKEN]` is functional — enabling the first crew member to be onboarded. Re-running is idempotent.

2. **Given** a valid `inviteToken` exists for an existing user
   **When** an unauthenticated visitor navigates to `/join/[inviteToken]`
   **Then** they see only a display name input and a confirm button — no email, phone, password, or verification field

3. **Given** the visitor enters a non-empty display name and confirms
   **When** `crew.joinViaInvite` runs
   **Then** a `User` row, a `NotificationPref` row, a `Session` row, and a mutual `CrewMember` pair are created, and a `kooks-session` HttpOnly SameSite=Strict cookie is set on the response

4. **Given** the session cookie is set
   **When** the user lands on `/`
   **Then** `ctx.user` resolves to their `User` record in all tRPC procedures

5. **Given** `src/middleware.ts` guards the app
   **When** an unauthenticated request hits a protected route
   **Then** it redirects to `/join-required` — a static page explaining an invite link is needed, with no sign-up form

6. **Given** `protectedProcedure` reads the `kooks-session` cookie
   **When** a protected procedure is called with a missing or invalid token
   **Then** it throws `TRPCError` with code `UNAUTHORIZED`

7. **Given** `assertCrewMember(ctx, breakId)` is implemented with real crew logic
   **When** called
   **Then** it permits the Break's creator, anyone sharing a `CrewMember` row with the creator, and anyone who has saved the Break; and throws `FORBIDDEN` otherwise

8. **Given** an already-authenticated user taps an invite link from someone not yet in their crew
   **When** the page processes it
   **Then** the mutual pair is created and they are redirected to `/` without re-entering a display name

9. **Given** a user taps **their own** invite link
   **When** the page processes it
   **Then** no crew connection is created, no duplicate rows appear, and they are redirected to `/` with no error

10. **Given** an invalid or unknown `inviteToken`
    **When** the page loads
    **Then** a 404 is rendered — no account-creation form is shown (FR-22)

## Corrections applied (see sprint-plan.md)

- **AC 7 replaces the original always-throwing stub.** Enforcement rule 2 requires calling `assertCrewMember` in every break-scoped procedure; a stub that throws unconditionally would make Epics 2–4 fail closed. The `CrewMember` model exists, so the real check ships here.
- **The mutual `CrewMember` pair is created here, not in Story 5.1.** The join flow cannot work without it. Story 5.1 is reduced to invite-link generation and its settings UI.
- **Middleware does a cookie-presence check only** (AC 5). Next.js middleware runs on Edge Runtime and cannot reach Prisma; real validation is in `protectedProcedure` (AC 6).
- **No schema migration.** All 8 models exist as of `20260901005755_full_schema`.

## Tasks / Subtasks

- [x] Task 1: Session helpers (AC 3, 4, 6)
  - [x] `src/server/auth/session.ts` — `SESSION_COOKIE_NAME`, `getSessionFromHeaders`, `createSession`, `deleteSession`, `serializeSessionCookie`
  - [x] Parse the cookie from the request `Headers` rather than `next/headers`, so the same helper serves both the route handler and the RSC caller
  - [x] `Secure` set only outside development — the cookie must survive plain-HTTP local dev
- [x] Task 2: tRPC context and `protectedProcedure` (AC 4, 6)
  - [x] `createTRPCContext` resolves `{ db, session, user, resHeaders }`
  - [x] `protectedProcedure` throws `UNAUTHORIZED` when `ctx.user` is null and narrows `ctx.user` to non-null for downstream procedures
  - [x] Route handler passes `resHeaders` so mutations can set cookies
- [x] Task 3: `assertCrewMember` with real logic (AC 7)
- [x] Task 4: `crewRouter` (AC 3, 8, 9, 10)
  - [x] `joinViaInvite` public mutation handling new-user, existing-user, and self-invite cases
  - [x] `me` protected query — smallest possible proof that AC 4 and AC 6 work
  - [x] Merge into `appRouter`; drop the `caller as any` cast in `src/trpc/server.ts`
- [x] Task 5: Join UI (AC 2, 8, 9, 10)
  - [x] `/join/[inviteToken]/page.tsx` — RSC, 404s on unknown token, branches on auth state
  - [x] `JoinFlow.tsx` + `OnboardingForm.tsx` — 48px tap targets, Morning Light tokens
  - [x] `/join-required/page.tsx` — static, no form
- [x] Task 6: Middleware (AC 5)
- [x] Task 7: Seed (AC 1)
- [x] Task 8: Verification
  - [x] `npm run typecheck`, `npm run build`
  - [x] End-to-end join against the real dev database
  - [x] Restore the `push: branches: [main]` deploy trigger

## Dev Notes

### Setting a cookie from a tRPC mutation

The fetch adapter exposes `resHeaders` on `createContext`. That object is threaded into the tRPC context and the mutation appends `Set-Cookie` to it. This is preferred over `cookies().set()` from `next/headers`, which is only valid inside a Server Action or Route Handler and couples the procedure to that execution context — the RSC caller in `src/trpc/server.ts` has no `resHeaders`, so the field is optional and cookie-setting procedures are only ever reached over HTTP.

### Why the join page is a Server Component wrapping a client component

The page must 404 on an unknown token *before* rendering any form (AC 10, FR-22), which requires a DB read at request time. It must also branch on whether the visitor is already authenticated (AC 8). Both are server concerns. The interactive part — the name field and the mutation — is a small client island.

### Edge Runtime

`src/middleware.ts` must not import anything that reaches Prisma or `~/env`, both of which pull in Node built-ins unavailable on Edge. It reads `request.cookies` directly. This is the same constraint already recorded for `src/server/events.ts` in deferred-work.

### Seed script and enforcement rule 3

`prisma/seed.ts` instantiates `PrismaClient` directly rather than importing `~/server/db`. Rule 3 forbids this in application code; the seed runs outside the Next.js runtime, where the `~` path alias and `~/env` validation are unavailable. This is a deliberate, documented exception — see deferred-work.md.

`tsx` was added as a devDependency to run the TypeScript seed; it is Prisma's documented approach for an ESM TypeScript project.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

`npm run typecheck` exit 0. `npm run build` exit 0 — routes `/`, `/join/[inviteToken]`, `/join-required`, `/api/trpc/[trpc]` plus middleware all compiled.

End-to-end against the real dev database (`npm run dev` on :3001, seeded via `npm run db:seed`):

| Check | Result |
|---|---|
| AC 5 — `/` unauthenticated | `307` -> `/join-required` |
| AC 5 — `/join-required` | `200`, zero `<form>` elements |
| AC 10 — unknown token | `404`, zero `<form>` elements |
| AC 2 — valid token | `200`, single `displayName` input; zero password/email/tel fields |
| AC 3 — `joinViaInvite` | `200`; `Set-Cookie: kooks-session=…; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000` (no `Secure` in dev, as designed) |
| AC 3 — DB state | 2 users, mutual `crew_members` pair in **both** directions, `notification_prefs` all-true for both, 1 session |
| AC 4 — `/` with cookie | `200`, renders the display name |
| AC 6 — `crew.me` no cookie | `401 UNAUTHORIZED` |
| AC 6 — `crew.me` forged cookie | `401 UNAUTHORIZED` (rejected, not a crash) |
| AC 6 — `crew.me` valid cookie | `200` with the user record |
| AC 9 — own invite link | `connectedTo: null`; crew rows stay 2, users stay 2 |
| AC 8 — re-tap inviter's link while authed | idempotent; crew 2, users 2, sessions 1 (no second session) |

AC 7 has no router calling it yet, so `assertCrewMember` was exercised directly against the database rather than shipped unverified (throwaway script, run with `NODE_OPTIONS=--conditions=react-server` because `server-only` resolves to its client entry in plain Node):

```
PASS  creator (Reef) -> allowed
PASS  crew of creator (Sarah) -> allowed
PASS  unconnected stranger -> FORBIDDEN
PASS  unauthenticated -> UNAUTHORIZED
PASS  unknown break -> NOT_FOUND
PASS  saved-but-not-crew (stranger) -> allowed
```

All test rows were removed afterwards; the dev database holds only the seeded `Reef` and the `Sarah` account created by the join flow.

### Completion Notes List

All 10 ACs met and verified. Epic 1 is complete and the `push: branches: [main]` deploy trigger has been restored.

**Design decisions worth carrying forward:**

1. **Cookies are set via the fetch adapter's `resHeaders`**, threaded through the tRPC context, rather than `cookies().set()` from `next/headers`. The latter is only legal inside a Server Action or Route Handler, which would couple the procedure to its execution context; `resHeaders` is optional on the context precisely because the RSC caller has none. `joinViaInvite` throws `INTERNAL_SERVER_ERROR` if it is ever reached without one instead of silently returning a session the caller cannot use.

2. **`connectCrew` uses `createMany({ skipDuplicates: true })`**, so re-tapping an invite link is a no-op rather than a unique-constraint error. Self-invites short-circuit before any write (AC 9).

3. **`assertCrewMember` grants access on three paths, not two** — creator, crew-of-creator, *and* has-saved-it. The third matters because a Break stays in your swipe stack after its creator leaves your crew (FR-4b); without it `break.list` could return Breaks that every subsequent procedure then rejects.

4. **`src/app/page.tsx` catches the `UNAUTHORIZED` from `crew.me` and redirects.** Middleware only proves a cookie *exists*; a stale or forged one reaches the page and would otherwise render an error. Epic 2 replaces this placeholder.

5. **`protectedProcedure` narrows `ctx.user` to non-null** by re-passing it through `next({ ctx })`, so downstream procedures need no null checks.

**Two deliberate rule exceptions**, both recorded in deferred-work.md: `prisma/seed.ts` instantiates `PrismaClient` directly (rule 3) because it runs outside the Next.js runtime; `src/middleware.ts` inlines the cookie name rather than importing it (rule: single source of truth) because Edge Runtime cannot load the module that exports it.

**Not done:** no UI for *generating* an invite link — that is Story 5.1. The only way to obtain one today is `SEED_INVITE_TOKEN` or reading `users.invite_token`.

### File List

- `src/server/auth/session.ts` — CREATED — cookie parse/serialize, session CRUD
- `src/server/auth/assert-crew-member.ts` — CREATED — real crew authorization (rule 2)
- `src/server/api/routers/crew-router.ts` — CREATED — `joinViaInvite`, `me`
- `src/server/api/trpc.ts` — MODIFIED — session-aware context, `protectedProcedure`
- `src/server/api/root.ts` — MODIFIED — mount `crewRouter`
- `src/app/api/trpc/[trpc]/route.ts` — MODIFIED — pass `resHeaders` into context
- `src/trpc/server.ts` — MODIFIED — dropped the `caller as any` cast (deferred-work item resolved)
- `src/middleware.ts` — CREATED — Edge-safe cookie-presence guard
- `src/app/join/[inviteToken]/page.tsx` — CREATED — RSC token validation + auth branch
- `src/components/JoinFlow.tsx` — CREATED — client island, auth-state branch
- `src/components/OnboardingForm.tsx` — CREATED — display-name-only form
- `src/app/join-required/page.tsx` — CREATED — static, no sign-up affordance
- `src/app/page.tsx` — MODIFIED — proves AC 4; placeholder until Epic 2
- `prisma/seed.ts` — CREATED — idempotent primary-user seed
- `package.json` — MODIFIED — `db:seed` script, `prisma.seed` config, `tsx` devDependency
- `.github/workflows/deploy.yml` — MODIFIED — restored `push: branches: [main]`
