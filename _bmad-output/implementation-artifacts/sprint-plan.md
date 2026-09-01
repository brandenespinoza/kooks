# Kooks — Sprint Plan

Single source of truth for story status. Individual story files carry their own `Status:` line; **this file is the index that keeps them honest.** Story 1.2 sat at `ready-for-dev` for months while fully implemented because nothing reconciled the two — that is what this file exists to prevent.

Last reconciled: **2026-08-31** (Story 2.1 complete).

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
| 1.3 Invite Link Join & Account Creation | `done` | FR-22, FR-23 | Landed 2026-08-31. Absorbed the `CrewMember` pair and real `assertCrewMember` from Epic 5. **Epic 1 complete.** |

## Epic 2 — Breaks & Navigation

| Story | Status | FRs | Notes |
|---|---|---|---|
| 2.1 Break Screen Shell with D3 Layout | `done` | — | Landed 2026-08-31. UX-DR1/8/9 + early UX-DR6. Verified in a real browser at both viewports; caught and fixed the Inter font bug carried since 1.2. |
| 2.2 Break Creation & Management | `ready-for-dev` | FR-1, 3, 4a | **Next up.** No migration task. Leaflet needs `ssr: false`. `break.delete` must null dependent `homeBreakId`. Wire the existing `EmptyBreaksState` CTA to the pin-drop flow. |
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
| 4.1 Check-In Creation & CrewZone UI | `backlog` | FR-10 | No migration task. `EmptyCrewState` (UX-DR6) already built in 2.1 — reuse it. Adds `CheckInCTA` between the crew list and timestamp, the gap 2.1 deliberately left. |
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

**1. ~~`assertCrewMember` ships real in Story 1.3, not stubbed.~~ DONE 2026-08-31** — implemented in `src/server/auth/assert-crew-member.ts` and verified against all six cases.

Original note:
epics.md Story 1.3 specified a stub that throws `FORBIDDEN` unconditionally until Epic 5, while enforcement rule 2 requires calling it in every break-scoped procedure. Followed literally, Epics 2–4 would have been untestable. Since the full schema (including `CrewMember`) landed on 2026-08-31, implement the real check immediately: the requesting user must share a crew row with the Break's creator, or have the Break in their own `UserSavedBreak`.

**2. Full Prisma schema already exists.** All 8 models were created in migration `20260901005755_full_schema`. Delete the "add model X via `prisma migrate dev`" task from Stories 2.2, 3.1, 4.1, 5.1, and 6.2. A migration is only needed if a story genuinely changes the schema.

**3. FR-8 vs. Story 3.2 — verdict regeneration frequency.** FR-8 requires the LLM verdict be generated "once per SwellCloud model update (4× daily)". Story 3.2's AC said generate on every successful poll, which Story 3.1 schedules every 30 min — 48× daily. Resolution: `Break.conditionsModelRunAt` stores the SwellCloud model-run timestamp; regenerate the verdict only when it changes. Satisfies FR-7 freshness and FR-8's ceiling together.

**4. Middleware cannot validate sessions.** Next.js middleware runs on Edge Runtime and cannot reach Prisma. `src/middleware.ts` does a cookie-presence check and redirects to `/join-required`; real session validation lives in `protectedProcedure` against the DB.

**5. Design tokens are Tailwind utilities, not bracket syntax.** Write `bg-action` / `text-text-secondary`, never `bg-[--action]`. The latter compiles to invalid CSS that browsers discard silently. See `CLAUDE.md` for the full token list.

**6. ~~Deploy is manual-dispatch only.~~ RESOLVED 2026-08-31.** `deploy.yml` was gated during the replan and the `push: branches: [main]` trigger was restored when Story 1.3 landed. `workflow_dispatch` is retained for manual runs. **The next push to `main` will deploy** — it requires the `VPS_HOST`, `VPS_USER`, and `VPS_SSH_KEY` repository secrets.

**7. Design tokens fail WCAG AA on parchment (NFR-9) — decision needed.** Measured during Story 2.1: `--text-secondary` 3.50:1, `--present` 3.74:1, `--stale` 1.71:1 against `--bg`, all below the 4.5:1 required for the 10–16px text they are used on. The UX spec asserts these pass; they do not. Minimum darkening that preserves hue and saturation: `--text-secondary` -> `#776c5f`, `--present` -> `#297c4e`, `--stale` -> `#796c59`. Note `--stale` at AA is no longer visually "muted", which fights its purpose — the alternative is to enlarge the timestamp instead. This is a one-line change per token in `globals.css` because everything uses the token utilities. Resolve before the Story 6.4 accessibility audit, not during it.
