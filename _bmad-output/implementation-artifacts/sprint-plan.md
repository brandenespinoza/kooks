# Kooks — Sprint Plan

Single source of truth for story status. Individual story files carry their own `Status:` line; **this file is the index that keeps them honest.** Story 1.2 sat at `ready-for-dev` for months while fully implemented because nothing reconciled the two — that is what this file exists to prevent.

Last reconciled: **2026-08-31** (full audit of tree vs. artifacts).

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
| 1.2 App Shell & Design System | `done` | — | UX-DR2/3/10/13. Reconciled 2026-08-31; three documented divergences. Device-level safe-area check still outstanding — carried into 2.1. |
| 1.3 Invite Link Join & Account Creation | `backlog` | FR-22, FR-23 | **Next up.** Scope expanded — see corrections below. |

## Epic 2 — Breaks & Navigation

| Story | Status | FRs | Notes |
|---|---|---|---|
| 2.1 Break Screen Shell with D3 Layout | `backlog` | — | UX-DR1/8/9. First real UI — do the deferred device/viewport validation here. |
| 2.2 Break Creation & Management | `backlog` | FR-1, 3, 4a | No migration task (schema landed 2026-08-31). Leaflet needs `ssr: false`. `break.delete` must null dependent `homeBreakId`. |
| 2.3 Swipe Navigation & Saving Crew Breaks | `backlog` | FR-2, 4b | |

## Epic 3 — Conditions

| Story | Status | FRs | Notes |
|---|---|---|---|
| 3.1 SwellCloud Conditions Polling | `backlog` | FR-7 | Owns pg-boss init in `instrumentation.ts` — Epics 4 and 6 depend on it. No migration task. |
| 3.2 LLM Conditions Verdict | `backlog` | FR-5, FR-8 | **Corrected:** regenerate only when the SwellCloud model run changes, not per poll. See below. |
| 3.3 Raw Data Panel & Webcam Links | `backlog` | FR-6, FR-9 | Webcams from `WEBCAM_URLS_JSON`, not the DB. |

## Epic 4 — Check-In & Real-Time Presence

| Story | Status | FRs | Notes |
|---|---|---|---|
| 4.1 Check-In Creation & CrewZone UI | `backlog` | FR-10 | No migration task. |
| 4.2 Real-Time Presence via SSE | `backlog` | FR-11 (partial) | Needs `export const dynamic = 'force-dynamic'` (rule 11). |
| 4.3 Edit, Remove & Auto-Expiry | `backlog` | FR-11, 12, 13 | Expiry job depends on pg-boss from 3.1. |

## Epic 5 — Crew & Social Graph

| Story | Status | FRs | Notes |
|---|---|---|---|
| 5.1 Invite Link Generation & Crew Connection | `backlog` | FR-14, 16 | **Reduced** — model and mutual-pair creation moved to 1.3. |
| 5.2 Crew-Aware Break & Presence Visibility | `backlog` | FR-16, NFR-7 | Narrows existing `assertCrewMember`; no longer a from-scratch rewrite. |
| 5.3 Crew Management & Settings Screen | `backlog` | FR-17 | |

## Epic 6 — Push Notifications & PWA

| Story | Status | FRs | Notes |
|---|---|---|---|
| 6.1 PWA Manifest & Service Worker | `backlog` | NFR-4, 5 | Wire `@serwist/next` — installed but currently connected to nothing. |
| 6.2 Push Subscriptions & Friend Check-In Notifications | `backlog` | FR-18 | No migration task. |
| 6.3 Scheduled Push Notifications | `backlog` | FR-19, FR-20 | Depends on pg-boss from 3.1. |
| 6.4 Notification Preferences & Accessibility Audit | `backlog` | FR-21, NFR-9, 10 | Final V1 story. |

---

## Cross-cutting corrections (2026-08-31 replan)

These supersede the corresponding text in `epics.md` and `architecture.md`. Apply them when generating each story file.

**1. `assertCrewMember` ships real in Story 1.3, not stubbed.**
epics.md Story 1.3 specified a stub that throws `FORBIDDEN` unconditionally until Epic 5, while enforcement rule 2 requires calling it in every break-scoped procedure. Followed literally, Epics 2–4 would have been untestable. Since the full schema (including `CrewMember`) landed on 2026-08-31, implement the real check immediately: the requesting user must share a crew row with the Break's creator, or have the Break in their own `UserSavedBreak`.

**2. Full Prisma schema already exists.** All 8 models were created in migration `20260901005755_full_schema`. Delete the "add model X via `prisma migrate dev`" task from Stories 2.2, 3.1, 4.1, 5.1, and 6.2. A migration is only needed if a story genuinely changes the schema.

**3. FR-8 vs. Story 3.2 — verdict regeneration frequency.** FR-8 requires the LLM verdict be generated "once per SwellCloud model update (4× daily)". Story 3.2's AC said generate on every successful poll, which Story 3.1 schedules every 30 min — 48× daily. Resolution: `Break.conditionsModelRunAt` stores the SwellCloud model-run timestamp; regenerate the verdict only when it changes. Satisfies FR-7 freshness and FR-8's ceiling together.

**4. Middleware cannot validate sessions.** Next.js middleware runs on Edge Runtime and cannot reach Prisma. `src/middleware.ts` does a cookie-presence check and redirects to `/join-required`; real session validation lives in `protectedProcedure` against the DB.

**5. Design tokens are Tailwind utilities, not bracket syntax.** Write `bg-action` / `text-text-secondary`, never `bg-[--action]`. The latter compiles to invalid CSS that browsers discard silently. See `CLAUDE.md` for the full token list.

**6. Deploy is manual-dispatch only.** `deploy.yml` was gated during the replan. **Restore the `push: branches: [main]` trigger as the final task of Story 1.3**, once there is a working authenticated app to deploy.
