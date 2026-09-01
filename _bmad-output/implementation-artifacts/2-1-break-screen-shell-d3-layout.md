# Story 2.1: Break Screen Shell with D3 Layout

Status: done

## Story

As a user,
I want to see the Break screen with the Verdict Band layout — a navy top zone and a warm parchment crew zone — even before conditions or crew data is loaded,
so that the app feels structured and intentional on first launch.

## Acceptance Criteria

1. Authenticated `/` renders two full-width zones: navy `VerdictBand` (top, `--action`) and parchment `CrewZone` (bottom, `--bg`), filling the viewport with no scroll
2. `VerdictBand` loading state shows a 2-line skeleton on navy — no spinner
3. `CrewZone` loading state shows 2 skeleton rows on parchment — no spinner
4. `SwipeDots` renders one dot per saved Break, active in `--action-fg`, inactive at 20% opacity
5. With no saved Breaks, an empty state prompts the user to add their first Break, with a visible CTA

## Tasks / Subtasks

- [x] Task 1: `break.list` query (data dependency for AC 4 and AC 5)
- [x] Task 2: `VerdictBand` + verdict skeleton (AC 1, 2)
- [x] Task 3: `CrewZone` + crew skeleton + `EmptyCrewState` (AC 1, 3)
- [x] Task 4: `SwipeDots` (AC 4)
- [x] Task 5: `EmptyBreaksState` (AC 5)
- [x] Task 6: `BreakScreen` composition; replace the `page.tsx` placeholder (AC 1)
- [x] Task 7: Carried-over device/viewport validation from Story 1.2 Task 7
- [x] Task 8: `npm run typecheck`, `npm run build`

## Dev Notes

### Safe-area insets moved out of the app shell

UX-DR1 requires the navy band to paint *behind* the iOS status bar. Story 1.2 put `pt-safe pb-safe` on the shared shell wrapper in `layout.tsx`, which would have left a parchment strip above the band. The wrapper is now `flex flex-col` with no insets, and each page or zone declares its own: `VerdictBand` owns the top inset, `CrewZone` the bottom, and the join/join-required pages declare both.

The band uses `pt-[max(3.5rem,calc(env(safe-area-inset-top)+1rem))]` rather than a flat 56px. The UX spec's "56px status bar clearance" was written before safe-area handling existed; stacking 56px on top of a real ~47px notch inset would push the verdict far down the screen. `max()` gives 56px on desktop and inset+16px on device.

### Contrast: the spec's colour assignment fails on navy

The UX spec assigns `--text-secondary` to the break name, but that is **2.93:1 on `--action`** and fails WCAG AA (NFR-9). There is no muted Morning Light token that passes on navy — `--present` is 2.74:1 and `--stale` passes at 6.00:1 but reads as "stale data", which is the wrong meaning. All secondary text on the band therefore uses `action-fg` at 70%, which composites to **5.88:1**.

Measured ratios are recorded in the audit below; several parchment pairings also fail and need a palette decision — see deferred-work.md.

### What is deliberately not here

- **`CheckInCTA`** — belongs between the crew list and the timestamp, but it is Epic 4. Shipping a button that does nothing is worse than a gap.
- **Swipe gesture** — Story 2.3. `activeIndex` is local state fixed at 0; 2.3 lifts it into `BreakSwipeStack`.
- **Real crew rows** — Epic 4. `CrewZone` always renders `EmptyCrewState` once loaded, which is the honest state until check-ins exist.
- **The "Add a break" handler** — Story 2.2 attaches the Leaflet pin-drop flow. It currently raises a toast rather than being a dead tap.

`EmptyCrewState` is an early delivery of UX-DR6 (scheduled for Epic 4) because `CrewZone` needs a real loaded-and-empty state now; Story 4.1 reuses it rather than building it.

`EmptyBreaksState` is not in architecture.md's component list. Added because "no breaks saved" is a distinct full-screen state with nowhere sensible to live inside the two-zone layout.

## Dev Agent Record

### Agent Model Used

claude-opus-5

### Debug Log References

`npm run typecheck` exit 0. `npm run build` exit 0.

Driven in a real browser (Playwright over system Chrome, dev server on :3001) at iPhone SE 375x667 and iPhone 14 Pro 390x844:

| Check | Result |
|---|---|
| AC 1 — two zones, no scroll | Both viewports, all three states: `vscroll=no hscroll=no`, status 200 |
| AC 2/3 — skeletons | 8 skeleton elements while the tRPC response was held open; **0** spinners |
| AC 4 — SwipeDots | 2 dots for 2 saved Breaks, active solid / inactive faint |
| AC 5 — empty state | Renders with a visible 48px CTA |
| NFR-10 — tap targets | "Add a break" 48px, display-name input 48px, "I'm in" 48px — all PASS |

**Measured contrast (NFR-9)** — computed from the token hexes, not eyeballed:

| Pair | Ratio | AA |
|---|---|---|
| `action-fg` on navy | 10.26:1 | PASS |
| `action-fg/70` on navy | 5.88:1 | PASS |
| `text-secondary` on navy | 2.93:1 | **FAIL** — avoided, see Dev Notes |
| `text-primary` on parchment | 15.34:1 | PASS |
| `action` on parchment | 10.26:1 | PASS |
| `text-secondary` on parchment | 3.50:1 | **FAIL** |
| `present` on parchment | 3.74:1 | **FAIL** |
| `stale` on parchment | 1.71:1 | **FAIL** |

The three parchment failures are palette-level and affect tokens, not this story's markup — a one-line fix in `globals.css` once the values are chosen. Raised in deferred-work.md; the timestamp's illegibility is visible in the captured screenshots.

**Bug found by looking at the screen — Inter had never rendered.** `@theme inline` contained `--font-sans: var(--font-sans)`, shipped by shadcn's base-nova registry. That is self-referential, resolves to an empty string, and silently drops the entire font stack, so every page fell back to Times. Confirmed via computed style (`computedHtmlFont: "Times"`), fixed by removing the line, re-confirmed (`"Inter, Inter Fallback, ui-sans-serif, …"`).

This means **Story 1.2 AC 2 was never actually met** despite being marked done, and the 2026-08-31 audit missed it because it verified that the CSS *compiled*, not what it *computed to*. The compiled stylesheet looked correct in both cases.

### Completion Notes List

All 5 ACs met and verified in a browser. The device/viewport validation carried over from Story 1.2 Task 7 is now complete at both target viewports — and it is what caught the font bug, which is the argument for not deferring visual checks again.

`break.list` deliberately returns only the caller's own saved Breaks and calls no `assertCrewMember`: it reads `UserSavedBreak` rows rather than a specific Break, so there is no break-scoped resource to authorize. Story 5.2 widens it to crew-created Breaks, and *that* is where crew filtering belongs.

### File List

- `src/server/api/routers/break-router.ts` — CREATED — `list` query
- `src/server/api/root.ts` — MODIFIED — mount `breakRouter`
- `src/components/BreakScreen.tsx` — CREATED — full-viewport root, only tRPC caller in the subtree
- `src/components/VerdictBand.tsx` — CREATED — navy zone + verdict skeleton
- `src/components/CrewZone.tsx` — CREATED — parchment zone + crew skeleton + timestamp
- `src/components/SwipeDots.tsx` — CREATED — position indicator
- `src/components/EmptyCrewState.tsx` — CREATED — UX-DR6, early delivery
- `src/components/EmptyBreaksState.tsx` — CREATED — AC 5
- `src/app/page.tsx` — MODIFIED — renders `BreakScreen`
- `src/app/layout.tsx` — MODIFIED — shell is a flex column; safe-area insets moved into pages/zones
- `src/app/join-required/page.tsx`, `src/components/OnboardingForm.tsx`, `src/components/JoinFlow.tsx` — MODIFIED — declare their own insets
- `src/styles/globals.css` — MODIFIED — **removed the circular `--font-sans`**; Inter now applies
