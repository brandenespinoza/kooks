# Story 2.3: Break Swipe Navigation & Saving Crew Breaks

Status: **done** (2026-09-01)
Epic: 2 — Breaks & Navigation
FRs: FR-2, FR-4b
UX: UX-DR9 (BreakSwipeStack + SwipeDots), UX-DR12 (`prefers-reduced-motion`)

## Story

As a user,
I want to swipe horizontally between my saved Breaks and save Breaks created by crew members to my own list,
So that I can quickly move between my spots and stay in sync with where my crew surfs.

## Acceptance Criteria

1. **Swipe moves between Breaks.** Two or more saved Breaks → swiping left/right animates the
   adjacent Break screen into view, `SwipeDots` reflects the new active position, the URL stays `/`.
2. **Order is stable across sessions.** `break.list` returns saved Breaks in `sortOrder` sequence;
   re-opening the app restores the same stack order.
3. **`break.save` adds a crew Break.** A `UserSavedBreak` row is created and the Break appears in the
   user's swipe stack.
4. **`break.unsave` removes it.** The `UserSavedBreak` row is deleted, the Break leaves the swipe
   stack, the underlying `Break` row is untouched.
5. **Reduce Motion is respected.** With `prefers-reduced-motion: reduce`, the swipe transition is
   instant — no smooth-scroll animation.

## Tasks

- [x] Add `break.save`, `break.unsave`, and `break.crewBreaks` to `break-router.ts`.
- [x] Create `BreakSwipeStack.tsx` — owns `break.list`, `activeIndex`, the drawers, and the
      scroll-snap swipe container.
- [x] Reduce `BreakScreen.tsx` to a presentational panel (one per saved Break).
- [x] Point `src/app/page.tsx` at `BreakSwipeStack`.
- [x] Move the screen-reader position announcement out of `SwipeDots` into a single live region.
- [x] Surface Save / Remove in `BreaksDrawer.tsx`.
- [x] Add the `.swipe-stack` utility (hidden scrollbar + reduced-motion scroll behaviour).
- [x] Verify: `npm run typecheck` + `npm run build`.

## Dev Notes

**No migration.** `UserSavedBreak` (with `sortOrder`) shipped in `20260901005755_full_schema`
(replan correction 2).

**Component tree inverted relative to `architecture.md`.** The doc has `BreakSwipeStack` rendering
one `BreakScreen` per break, with each `BreakScreen` fetching its own data. The tree is now the
former but *not* the latter: `BreakSwipeStack` runs a single `break.list` query and passes each row
down as props. N screens × N queries for data that arrives in one list is waste, and it would break
the "one tRPC caller in this subtree" rule that 2.1/2.2 established. The rule moves up one level:
**`BreakSwipeStack` is now the only component in this subtree that calls tRPC.**

**Swipe is native scroll-snap, not a gesture library.** `overflow-x-auto` + `snap-x snap-mandatory`
with one full-width panel per Break. No `framer-motion`/`embla` dependency, momentum and rubber-band
come from the platform, and it works with a trackpad on desktop. `activeIndex` is derived from
`scrollLeft / clientWidth` in the scroll handler rather than tracked through pointer events.

**Reduced motion.** The gesture itself is user-driven, so there is no animation to disable there.
What is animatable is the *programmatic* scroll (arrow keys), which uses
`behavior: "smooth"` normally and `"auto"` under `prefers-reduced-motion`. The `.swipe-stack`
utility disables `scroll-behavior: smooth` in CSS as well, so the AC holds even if a future caller
forgets the JS check. The global reduced-motion block in `globals.css` only clamps
`animation-duration`/`transition-duration`; it does not touch `scroll-behavior`.

**Keyboard.** The scroll container is `tabIndex={0}` with `role="region"` — a scrollable region has
to be keyboard-reachable. Arrow Left/Right page between Breaks. The dots stay decorative (UX spec
calls them an indicator, and a 48px tap target per dot does not fit beside the break label).

**Screen readers.** With every panel mounted, `SwipeDots`' old `sr-only` "Break 2 of 3" rendered
once per panel. It now lives once, in an `aria-live="polite"` region in `BreakSwipeStack`, and each
panel carries `role="group"` + `aria-label`.

**`unsave` refuses Breaks you created.** Unsaving your own Break would drop it out of your stack
with no route back — `break.crewBreaks` only surfaces *other people's* Breaks. Creators get
`break.delete`; everyone else gets `break.unsave`.

**`save` inherits the first-Break rule from `create`.** Saving a crew Break when you have none makes
it your Home Break, for the same reason `create` does it (FR-4a) — the dawn patrol push has nowhere
to point otherwise.

**`break.crewBreaks` is a stopgap for discovery.** Story 5.2 widens `break.list` itself to include
crew Breaks; until then, this query is the only way a user can reach a Break they did not create, so
`break.save` would be unreachable from the UI without it. It filters to direct crew members and
excludes anything already saved (NFR-7 — no friend-of-friend).

## Files

| File | Change |
|---|---|
| `src/server/api/routers/break-router.ts` | `save`, `unsave`, `crewBreaks` |
| `src/components/BreakSwipeStack.tsx` | new — query, `activeIndex`, scroll-snap container, drawers |
| `src/components/BreakScreen.tsx` | reduced to a presentational panel |
| `src/components/SwipeDots.tsx` | dropped the per-panel `sr-only` announcement |
| `src/components/BreaksDrawer.tsx` | Remove (unsave) action + "Your crew's breaks" section |
| `src/app/page.tsx` | renders `BreakSwipeStack` |
| `src/styles/globals.css` | `.swipe-stack` utility |
