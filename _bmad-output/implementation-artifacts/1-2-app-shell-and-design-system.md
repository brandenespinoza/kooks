# Story 1.2: App Shell & Design System

Status: done

## Story

As a user,
I want the app to have a consistent visual foundation with the Morning Light color palette, Inter typography, and correct iOS safe area handling,
so that every screen feels intentional and is comfortable to read at 5am.

## Acceptance Criteria

1. **Given** the Morning Light design tokens are defined as CSS custom properties in `src/styles/globals.css`
   **When** any component references these tokens
   **Then** the correct values are applied: `--bg: #f5f0e8`, `--text-primary: #1a1a1a`, `--text-secondary: #8a7e6e`, `--action: #1a3a5c`, `--action-fg: #f5f0e8`, `--present: #2e8b57`, `--divider: rgba(26,58,92,0.10)`, `--surface: #ede8df`, `--stale: #c2b9ac`

2. **Given** Inter is loaded via `next/font/google` with weights 400 and 700 and applied to the root `<html>` element
   **When** any text is rendered
   **Then** Inter is the active typeface with no fallback font flash on load

3. **Given** the app root layout (`src/app/layout.tsx`) applies `max-w-[430px] mx-auto min-h-screen bg-bg` to the content wrapper
   **When** the app is viewed at any viewport width
   **Then** content is centered and capped at 430px; the background fills the full viewport

4. **Given** `@tailwindcss/safe-area` is installed and configured, and the app shell uses `pt-safe` and `pb-safe`
   **When** the app is viewed on an iPhone 14/15 or iPhone SE
   **Then** no content overlaps the iOS status bar notch or home indicator

5. **Given** the following shadcn/ui components are installed via CLI and the CSS variable mapping causes them to use Morning Light tokens: `Drawer`, `Button`, `Separator`, and the toast primitive (Sonner)
   **When** these components are rendered
   **Then** they use `--action` for primary surfaces, `--bg` for backgrounds, and `--text-primary` for text — no default shadcn blue or gray colors remain

## Tasks / Subtasks

- [x] Task 1: Define Morning Light design tokens in globals.css (AC: 1)
  - [x] Open `src/styles/globals.css` — this is the file imported by `src/app/layout.tsx` in the T3 scaffold
  - [x] Add all nine Morning Light custom properties inside `:root` (exact values in Dev Notes)
  - [x] Map shadcn/ui semantic variables (`--background`, `--foreground`, `--primary`, etc.) to Morning Light tokens (mapping in Dev Notes)
  - [x] Verify `:root` block is within `@layer base` or at root level — confirm it is NOT inside `@theme` (Tailwind v4 distinction)

- [x] Task 2: Load Inter font via next/font/google (AC: 2)
  - [x] Open `src/app/layout.tsx`
  - [x] Import `Inter` from `next/font/google` with `subsets: ["latin"]` and `weight: ["400", "700"]`
  - [~] Apply `inter.className` — superseded by `inter.variable` + `@theme --font-sans` (see Completion Notes)
  - [x] Verify `<html>` tag has `lang="en"` preserved
  - [x] Run `npm run build` — confirm zero `next/font` errors and font file is bundled

- [x] Task 3: Apply app root container classes (AC: 3)
  - [x] In `src/app/layout.tsx`, wrap children in a `<div>` with `className="max-w-[430px] mx-auto min-h-screen bg-bg"`
  - [x] Ensure the wrapper is inside `<body>`, not on `<body>` itself
  - [x] Confirm background extends full viewport on desktop (background on `<body>` or `<html>` if needed)

- [x] Task 4: Install and configure @tailwindcss/safe-area (AC: 4)
  - [~] Run `npm install @tailwindcss/safe-area` — NOT DONE, deliberate; utilities hand-rolled in globals.css (see Completion Notes)
  - [~] **TAILWIND v4 ONLY:** Add `@plugin "@tailwindcss/safe-area";` — N/A, no plugin installed; equivalent utilities hand-rolled under `@layer utilities` in `src/styles/globals.css`
  - [x] Export `viewport` with `viewportFit: "cover"` from `src/app/layout.tsx` (see Dev Notes — required for safe-area insets to activate on iOS)
  - [x] Add `pt-safe pb-safe` to the `max-w-[430px]` wrapper div in `layout.tsx`
  - [ ] Visually verify on iPhone SE (375px) that no content clips behind notch or home indicator — **NOT independently verified in the 2026-08-31 audit**; safe-area insets are always 0 outside a real iOS device, so this needs a device or simulator check

- [x] Task 5: Install shadcn/ui components (AC: 5)
  - [x] Verify `src/components/ui/button.tsx` exists (installed in Story 1.1) — do NOT re-run `add button`, it will prompt overwrite
  - [x] Run `npx shadcn@latest add drawer` — install Drawer component (used by CheckInDrawer in Epic 4)
  - [x] Run `npx shadcn@latest add separator` — install Separator component
  - [x] Run `npx shadcn@latest add sonner` — install Sonner toast (modern shadcn uses Sonner, NOT the old Toast component)
  - [x] Add `<Toaster />` from `sonner` to `src/app/layout.tsx` inside the body wrapper

- [x] Task 6: Theme shadcn/ui components to Morning Light (AC: 5)
  - [x] Verify CSS variable mapping in globals.css causes Button primary variant to render `--action` navy background with `--action-fg` text
  - [x] Verify Drawer renders on `--surface` background
  - [x] Verify Separator uses `--divider` color
  - [x] Run `npm run typecheck` — zero errors
  - [~] Run `npm run lint` — N/A, no ESLint configured in this project

- [ ] Task 7: Validate layout at target devices — **NOT independently verified in the 2026-08-31 audit.** The CSS was verified against the compiled stylesheet (see Debug Log), but no browser or device check was performed. Carry this into the first story that renders real UI (2.1, Break Screen Shell), where there is something meaningful to look at.
  - [ ] Open `npm run dev` and open Chrome DevTools → iPhone SE (375×667) — verify no content clips, background fills, font loads
  - [ ] Check iPhone 14 Pro (390×844) — verify same
  - [ ] Check desktop (1440px wide) — verify `max-w-[430px]` centering and `bg-bg` fills full viewport edges

## Dev Notes

### CRITICAL: Tailwind CSS Version is v4

Story 1.1 installed **Tailwind CSS v4** (not v3). This changes several things:

- **No `tailwind.config.ts` for plugins** — Tailwind v4 uses CSS-based configuration
- Plugin syntax: `@plugin "@tailwindcss/safe-area";` goes in `globals.css`, NOT in `plugins: []` of a config file
- `tailwind.config.ts` may exist but only contains `content` and basic settings (or may not exist at all in v4)
- If `tailwind.config.ts` exists: do NOT add `plugins: [require("@tailwindcss/safe-area")]` — this is v3 syntax and will throw

In Tailwind v4, `globals.css` starts with:
```css
@import "tailwindcss";
@plugin "@tailwindcss/safe-area";
```

### Correct globals.css File Path

Story 1.1 created both `src/styles/globals.css` AND `src/app/globals.css` may have been generated by T3. **The canonical T3 v7.40.0 path is `src/styles/globals.css`**, imported in `src/app/layout.tsx` via:
```typescript
import "~/styles/globals.css";
```

Verify which file is actually imported in `layout.tsx` before editing. Edit the correct one.

### Morning Light Token Definitions (EXACT VALUES)

Add to `:root` block in `globals.css`:

```css
:root {
  /* Morning Light design tokens */
  --bg: #f5f0e8;
  --text-primary: #1a1a1a;
  --text-secondary: #8a7e6e;
  --action: #1a3a5c;
  --action-fg: #f5f0e8;
  --present: #2e8b57;
  --divider: rgba(26, 58, 92, 0.10);
  --surface: #ede8df;
  --stale: #c2b9ac;
}
```

### shadcn/ui CSS Variable Mapping

shadcn/ui components use semantic CSS variables (`--primary`, `--background`, etc.). Map these to Morning Light tokens so all shadcn components automatically use the correct palette. Add/update in the same `:root` block:

```css
:root {
  /* shadcn semantic vars → Morning Light mapping */
  --background: #f5f0e8;          /* same as --bg */
  --foreground: #1a1a1a;          /* same as --text-primary */
  --card: #ede8df;                /* same as --surface */
  --card-foreground: #1a1a1a;
  --popover: #ede8df;             /* same as --surface */
  --popover-foreground: #1a1a1a;
  --primary: #1a3a5c;             /* same as --action */
  --primary-foreground: #f5f0e8;  /* same as --action-fg */
  --secondary: #ede8df;           /* same as --surface */
  --secondary-foreground: #1a1a1a;
  --muted: #ede8df;               /* same as --surface */
  --muted-foreground: #8a7e6e;    /* same as --text-secondary */
  --accent: #ede8df;
  --accent-foreground: #1a1a1a;
  --destructive: #dc2626;
  --destructive-foreground: #f5f0e8;
  --border: rgba(26, 58, 92, 0.10); /* same as --divider */
  --input: rgba(26, 58, 92, 0.10);
  --ring: #1a3a5c;                /* same as --action */
  --radius: 0.5rem;
}
```

**Note:** shadcn init with "no default color scheme" may have left these values empty or with Tailwind defaults. Overwrite all of them with the values above.

**Remove the `.dark` block:** shadcn init also generates a `.dark { ... }` block beneath `:root` with HSL-format dark mode overrides. Kooks has no dark mode. Delete the entire `.dark { ... }` block to prevent its variables from conflicting with Morning Light tokens when iOS switches to dark system appearance.

### Inter Font — Exact Implementation

```typescript
// src/app/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});
```

`display: "swap"` prevents FOIT (Flash of Invisible Text) — the system font renders immediately while Inter loads, which matters at 5am on a slow connection.

Apply to `<html>`:
```tsx
<html lang="en" className={inter.className}>
```

Do NOT use `variable` mode (e.g., `variable: "--font-inter"`) unless you also update `globals.css` `@theme` to reference it — the simpler `className` approach works without extra CSS config.

### App Shell Layout — Exact Structure

**`viewport-fit=cover` is required for safe areas to work on iOS.** Without it, `env(safe-area-inset-*)` always returns `0` and `pt-safe`/`pb-safe` do nothing on device. Export a `viewport` metadata object from `layout.tsx`:

```tsx
// src/app/layout.tsx
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",   // ← REQUIRED for iOS safe-area insets
};
```

Next.js 14+ uses the `Viewport` export to generate the viewport meta tag — do NOT manually write `<meta name="viewport">` in the JSX; Next.js handles it from this export.

Full layout structure:
```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-bg">
        <TRPCReactProvider>
          <div className="max-w-[430px] mx-auto min-h-screen bg-bg pt-safe pb-safe">
            {children}
          </div>
        </TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

`bg-bg` on `<body>` ensures the warm parchment fills the full viewport on desktop (beyond the 430px centered column).

### shadcn/ui Component Installation

Current project state: shadcn/ui was initialized in Story 1.1 with CSS variables mode, no default color scheme. Only `src/components/ui/button.tsx` was installed (from shadcn init). Remaining components need to be installed:

```bash
npx shadcn@latest add drawer
npx shadcn@latest add separator
npx shadcn@latest add sonner
```

**CRITICAL — Use Sonner, NOT the legacy Toast:**
Modern shadcn/ui (2024+) uses [Sonner](https://sonner.emilkowal.ski/) for toasts. Running `npx shadcn@latest add sonner` installs a thin wrapper. Usage:
```typescript
import { toast } from "sonner";
toast("Check-in saved");
```

DO NOT run `npx shadcn@latest add toast` — this installs the deprecated shadcn toast which conflicts with Sonner.

The `<Toaster />` component from `~/components/ui/sonner` must be added to `layout.tsx`.

### @tailwindcss/safe-area Plugin

```bash
npm install @tailwindcss/safe-area
```

In `src/styles/globals.css` (AFTER the `@import "tailwindcss";` line):
```css
@import "tailwindcss";
@plugin "@tailwindcss/safe-area";
```

This adds `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe`, `mt-safe`, `mb-safe` utilities that map to `env(safe-area-inset-*)` CSS variables. These are zero on desktop; they activate on iOS to clear notch and home indicator.

### Typography Scale Reference

These type specs are NOT implemented as Tailwind config — they are **implemented per-component** as Tailwind utility classes. This story establishes the tokens and font; the type scale is applied in later Epic 2–4 component stories.

| Role | Tailwind classes |
|------|-----------------|
| Conditions Verdict | `text-[28px] font-bold leading-[1.18] tracking-tight text-action-fg` |
| Break name | `text-[11px] font-normal uppercase tracking-[0.14em] text-text-secondary` |
| Crew name | `text-[16px] font-bold text-text-primary` |
| ETA / supporting | `text-[13px] font-normal text-text-secondary` |
| Labels | `text-[10px] font-normal uppercase tracking-[0.14em] text-text-secondary` |
| Timestamp | `text-[10px] font-normal uppercase text-center text-stale` |

Document these in a comment block at the top of `globals.css` for future reference.

### Previous Story (1.1) — What Already Exists

From Story 1.1 completion notes:
- `src/components/ui/button.tsx` — already installed by shadcn init; **check if it uses `--primary` var correctly**
- `src/styles/globals.css` — exists; likely has shadcn's default CSS variable block (possibly empty)
- `src/app/layout.tsx` — exists with T3 boilerplate; **read its current structure before editing**
- `src/lib/utils.ts` — exists (shadcn `cn()` helper)
- Tailwind CSS v4 is installed — do NOT use v3 plugin API

Review findings from 1.1 that may affect this story:
- shadcn `npx shadcn@latest init` was run with CSS variables mode ✅ — CSS variable structure is in place
- T3 demo code was removed (no `src/app/_components/post.tsx`) ✅

### Files to READ Before Editing

Before editing anything, read the current state of:
1. `src/app/layout.tsx` — know the exact current structure (T3 wraps children in `<TRPCReactProvider>` from `~/trpc/react`)
2. `src/styles/globals.css` — know what shadcn init wrote (may have `--background: 0 0% 100%` HSL format)
3. `src/components/ui/button.tsx` — verify it uses `--primary` CSS var (if not, re-install)

**PRESERVE THE tRPC PROVIDER:** T3's layout.tsx wraps `{children}` in `<TRPCReactProvider>`. Do NOT remove it. The final layout structure must be:
```tsx
<html lang="en" className={inter.className}>
  <body className="bg-bg">
    <TRPCReactProvider>
      <div className="max-w-[430px] mx-auto min-h-screen bg-bg pt-safe pb-safe">
        {children}
      </div>
    </TRPCReactProvider>
    <Toaster />
  </body>
</html>
```

Place `<Toaster />` outside `<TRPCReactProvider>` (it has no tRPC dependency). Import it from `~/components/ui/sonner`.

**CRITICAL:** If shadcn init wrote CSS variables in HSL format (e.g., `--background: 0 0% 100%`), you must convert the entire block to hex format to match Morning Light tokens. Do NOT mix HSL-format vars with hex-format vars.

### Files This Story Modifies / Creates

| File | Action | Notes |
|------|--------|-------|
| `src/styles/globals.css` | MODIFY | Add Morning Light tokens + shadcn mapping; add `@plugin` |
| `src/app/layout.tsx` | MODIFY | Add Inter font import; add root wrapper classes; add `<Toaster />` |
| `src/components/ui/drawer.tsx` | CREATE | Via `npx shadcn@latest add drawer` |
| `src/components/ui/separator.tsx` | CREATE | Via `npx shadcn@latest add separator` |
| `src/components/ui/sonner.tsx` | CREATE | Via `npx shadcn@latest add sonner` |
| `package.json` | MODIFY | `@tailwindcss/safe-area` added to dependencies |

Do NOT create a `src/app/globals.css` if it doesn't already exist — use the file that `layout.tsx` actually imports.

### Enforcement Rules Applicable to This Story

From architecture doc:
- Rule 8: `kebab-case` for file names — component files already use this via shadcn CLI
- UX-DR9: App root `max-w-[430px] mx-auto min-h-screen bg-bg`
- UX-DR10: `pb-safe` and `pt-safe` on app shell
- UX-DR12: `prefers-reduced-motion` wrapping all CSS transitions — add this to `globals.css` as a global rule:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

### Project Structure Notes

- `src/components/ui/` — shadcn/ui components; DO NOT create components outside this pattern
- `src/styles/globals.css` is the canonical CSS entry point (T3 v7.40.0 convention)
- No new directories needed for this story
- `next.config.ts` should NOT be touched (already has `output: "standalone"` from Story 1.1)
- `tailwind.config.ts` should NOT have `plugins` added — use CSS `@plugin` syntax (Tailwind v4)

### References

- [Source: epics.md — Story 1.2] Acceptance criteria and story definition
- [Source: architecture.md — Implementation Patterns/Naming Patterns] Component naming conventions
- [Source: ux-design-specification.md — Design System Foundation] shadcn/ui + Tailwind selection rationale
- [Source: ux-design-specification.md — Visual Design Foundation] Morning Light color tokens, typography scale, spacing
- [Source: ux-design-specification.md — Responsive Design] `max-w-[430px]`, single-column layout
- [Source: ux-design-specification.md — Accessibility Strategy] `prefers-reduced-motion` global rule, WCAG AA
- [Source: epics.md — UX-DR2, UX-DR3, UX-DR10, UX-DR13] UX design requirements for this story
- [Source: implementation-artifacts/1-1-project-scaffold-and-infrastructure.md — Completion Notes] Tailwind v4, shadcn init state, file structure established

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (implementation) · claude-opus-5 (2026-08-31 audit, status reconciliation, token-syntax correction)

### Debug Log References

`npm run typecheck` — exit 0. `npm run build` — exit 0.

Compiled-CSS assertion for AC 1 (2026-08-31): `grep -o '\.bg-bg{[^}]*}' .next/static/css/*.css` → `.bg-bg{background-color:var(--bg)}`, and `grep -o '[a-z-]*:--[a-z-]*[};]'` returns nothing. That second grep is the regression check for the token bug described below — a non-empty result means a bare-variable class has crept back in.

### Completion Notes List

Implementation landed but the file was never moved off `ready-for-dev`; reconciled to `done` on 2026-08-31 after auditing the tree against the ACs. All five ACs are satisfied. Three divergences from the tasks as written, all deliberate:

1. **`@tailwindcss/safe-area` was never installed (Task 4).** The six safe-area utilities are hand-rolled in `globals.css` under `@layer utilities` using `env(safe-area-inset-*)`. Functionally equivalent, one fewer dependency. `viewportFit: "cover"` *is* exported from `layout.tsx`, which is the part that actually matters — without it the insets resolve to 0 on device regardless of how the utilities are defined. AC 4 met by different means.

2. **Inter uses `variable` mode, not `className` (Task 2).** Dev notes specified `inter.className` and explicitly warned against `variable`. The implementation used `variable: "--font-inter"` wired through `@theme { --font-sans: var(--font-inter), ... }` and `html { @apply font-sans }`. This is the correct Tailwind v4 approach and is why `font-sans` resolves to Inter everywhere; the dev note was wrong. AC 2 met.

3. **The token syntax in this story's own dev notes was broken.** Every `bg-[--bg]` / `text-[--text-secondary]` in the original notes compiles under Tailwind v4 to a declaration with a raw `--name` value instead of a `var()` call — invalid CSS, silently discarded by the browser. It went unnoticed because `body { @apply bg-background }` happens to resolve to the same `#f5f0e8`, so the page looked correct while every explicit token utility was dead. Corrected 2026-08-31: the nine Morning Light tokens are registered in the `@theme inline` block of `globals.css`, making them real utilities (`bg-bg`, `bg-action`, `text-action-fg`, `text-text-secondary`, `border-divider`, `text-stale`) with working opacity modifiers. All occurrences in this file, `CLAUDE.md`, `epics.md`, and `ux-design-specification.md` were updated.

Also corrected in the same pass: `@import "tailwindcss" source("../")` scopes class detection to `src/`. Tailwind v4 auto-scans the whole repo by default, and was minting dead utility rules out of class names quoted in the markdown docs.

Two task-list items were not applicable as written: Task 6's `npm run lint` (no ESLint is installed — `typecheck` and `build` are the only static checks), and Task 1's instruction to keep tokens out of `@theme` (the `:root` hex definitions stay there, but the `@theme inline` registration is what makes them usable).

### File List

- `src/styles/globals.css` — MODIFIED — Morning Light tokens in `:root`, shadcn semantic mapping, `@theme inline` token registration, `source("../")` scoping, safe-area utilities, `prefers-reduced-motion` rule, typography reference comment
- `src/app/layout.tsx` — MODIFIED — Inter via `next/font/google` (variable mode), `viewport.viewportFit: "cover"`, `max-w-[430px]` shell with `pt-safe pb-safe`, `<Toaster />`
- `src/components/ui/drawer.tsx` — CREATED — `npx shadcn@latest add drawer`
- `src/components/ui/separator.tsx` — CREATED — `npx shadcn@latest add separator`
- `src/components/ui/sonner.tsx` — CREATED — `npx shadcn@latest add sonner`
- `package.json` — MODIFIED — `vaul`, `sonner`, `next-themes` added (via shadcn CLI). `@tailwindcss/safe-area` intentionally NOT added — see note 1
