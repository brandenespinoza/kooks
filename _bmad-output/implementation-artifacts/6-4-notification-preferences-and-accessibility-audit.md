# Story 6.4: Notification Preferences & Accessibility Audit

Status: **done** (2026-09-01)
Epic: 6 — Push Notifications & PWA — **complete. V1 feature work is complete.**
FRs: FR-21
NFRs: NFR-9 (WCAG 2.1 AA contrast), NFR-10 (48px tap targets)

## Story

As a user,
I want to enable or disable each notification type independently, and know that the app meets
accessibility standards,
So that I only receive the alerts I care about and the app works for everyone.

## Acceptance Criteria

1. **Three switches** in Settings, reflecting the user's `NotificationPref` row.
2. **Toggling calls `notification.updatePrefs`**, the row updates, later notifications respect it.
3. **Every new user gets a `NotificationPref` row** with all three defaulting to `true`.
4. **Accessibility audit passes**: `aria-live` on the verdict, `aria-label` on crew rows, `aria-expanded`
   on the raw-data toggle, focus trapped in `CheckInDrawer` and returned to the CTA, 48px tap targets,
   WCAG AA contrast on every text/background pair.

## Tasks

- [x] `notification.prefs` and `notification.updatePrefs`.
- [x] Real switches in `SettingsNotifications`.
- [x] Audit every colour pair; fix the failures.
- [x] Fix the 44px ETA wheel slots and the missing focus return.

## Dev Notes

**The palette failed AA in seven places, not three.** Replan correction 7 recorded three failures from
the Story 2.1 spot-check. A full sweep of every pair actually used found seven, because the earlier pass
never checked text on `--surface` (the drawer/settings background, which is darker than `--bg` and
therefore harder), `--destructive`, or the `action-fg/50` labels this project added in Story 3.3.

Fixes preserve each token's hue and saturation, darkened in HSL until the *harder* of the two
backgrounds passes:

| Token | Was | Now | On surface | On bg |
|---|---|---|---|---|
| `--text-secondary` | `#8a7e6e` (3.25) | `#71675a` | 4.54:1 | 4.88:1 |
| `--present` | `#2e8b57` (3.48) | `#27764a` | 4.56:1 | 4.90:1 |
| `--destructive` | `#dc2626` (3.96) | `#cc2121` | 4.52:1 | 4.86:1 |
| `--stale` | `#c2b9ac` (1.71) | `#8b601c` | — | 4.89:1 |
| raw-data labels | `action-fg/50` (3.81) | `action-fg/70` | — | 5.88:1 on navy |

**`--stale` changes meaning, and that is deliberate.** The UX spec signals staleness by *fading* the
timestamp. At 10px that is impossible to do accessibly — WCAG's large-text exemption starts at 18.66px
bold, so a small timestamp needs the full 4.5:1 no matter what, and any compliant grey lands within a
hair of the new `--text-secondary`, erasing the fresh-vs-stale distinction entirely. Staleness is now
carried by **hue** instead: a muted amber (`#8b601c`) against the neutral secondary. It reads as *aged*
rather than *faint* — which is arguably the better signal anyway, since old data deserves more attention,
not less.

**A bug in my own audit tool, worth recording.** The first search returned `#8b2f2e` — a red — as the
replacement for the green `--present`. The HSL round-trip divided hue by 360 twice, so every colour came
back rotated. It was caught by looking at the output rather than trusting it, and the conversion is now
verified round-tripping three known colours exactly. **A contrast tool that silently changes hue would
have shipped a red "present" indicator.**

**The ETA wheel's slots were 44px** — the only NFR-10 violation in the codebase, and a real one, since
each slot is a tap target. Now 48px, which the wheel's geometry derives from automatically.

**Focus never returned from the drawers.** vaul traps focus while open and restores it to the
`DrawerTrigger` — but these drawers open from state, so there is no trigger and focus landed on `<body>`.
A keyboard or screen-reader user closing the check-in sheet was dropped at the top of the document.
`BreakSwipeStack` now records `document.activeElement` when opening and restores it one frame after
close (immediately gets overridden by vaul's teardown).

**No optimistic updates on the switches** (V1 rule). Each reflects the server and is disabled while a
write is in flight, so it can never show a state the database does not have.

## Verification

`npm run typecheck` and `npm run build` pass.

**Contrast, all 13 pairs in use — 0 failures** (measured, not asserted):

```
PASS 15.34  text-primary on bg        PASS 10.26  action on bg
PASS 14.26  text-primary on surface   PASS  4.52  destructive on surface
PASS  4.88  text-secondary on bg      PASS 10.26  action-fg on action
PASS  4.54  text-secondary on surface PASS  5.88  action-fg/70 on action
PASS  4.89  stale on bg               PASS  7.90  action-fg/85 on action
PASS  4.90  present on bg             PASS  5.88  action-fg/70 raw-data labels
PASS  4.56  present on surface
```

**Preferences**, against a production server:

| Check | Result |
|---|---|
| `prefs` with no row touched | all three `true` |
| `updatePrefs {dawnPatrol:false}` | returns the full row, `dawnPatrol:false` |
| Read back | persisted |
| Partial update of a different key | leaves the others untouched |
| Empty payload | `BAD_REQUEST` |
| `/settings` after all of it | `200` |

**Aria attributes**, present and verified in source: `aria-live="polite"` on the verdict container,
`aria-label="[Name] is going at [time]"` on every crew row, `aria-expanded`/`aria-controls` on the
raw-data toggle, `role="switch"` + `aria-checked` + `aria-labelledby` on each preference.

**Tap targets:** every interactive element is `min-h-[48px]`, `size-12`, `min-h-12` or `h-12` — swept
across the codebase, one violation found and fixed.

**Not verified:** that focus actually returns in a browser, that the switches read correctly to
VoiceOver, and how the new palette looks on a real screen. The contrast numbers are arithmetic and
certain; the *aesthetics* of a darker secondary and an amber stale state have never been seen by anyone.

## Files

| File | Change |
|---|---|
| `src/server/api/routers/notification-router.ts` | `prefs`, `updatePrefs` |
| `src/components/SettingsNotifications.tsx` | real switches |
| `src/styles/globals.css` | four AA-compliant token values |
| `src/components/RawDataPanel.tsx` | labels `/50` → `/70` |
| `src/components/ETAPicker.tsx` | 44px → 48px slots |
| `src/components/BreakSwipeStack.tsx` | focus return on drawer close |
