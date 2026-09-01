# Story 3.3: Raw Data Panel & Webcam Links

Status: **done** (2026-09-01)
Epic: 3 — Conditions — **complete**
FRs: FR-6, FR-9
UX: UX-DR16 (`RawDataPanel`), `aria-expanded` on the toggle, 48px tap targets

## Story

As a user,
I want to tap to reveal the raw surf data beneath the verdict, and see a webcam link when one is
configured for my Break,
So that I can dig into the numbers when I want them, and check the live feed before paddling out.

## Acceptance Criteria

1. **Tapping "Raw data" expands the panel** inline within `VerdictBand`, showing swell height, swell
   period, wave direction, wind speed and wind direction in small muted typography on navy;
   `aria-expanded` becomes `true`.
2. **Tapping again collapses it** and `aria-expanded` returns to `false`.
3. **A configured Break shows a `WebcamLink` row.** `WEBCAM_URLS_JSON` maps Break label → URL; the row
   opens the URL externally via `target="_blank" rel="noopener noreferrer"`.
4. **An unconfigured Break shows no row at all** — no empty row, no placeholder.
5. **A missing or malformed `WEBCAM_URLS_JSON` logs a warning and behaves as an empty map**; the app
   does not crash.

## Tasks

- [x] `src/lib/webcams.ts` — parse, validate, normalise and cache the label → URL map.
- [x] `break.list` returns a resolved `webcamUrl` per Break.
- [x] `src/components/RawDataPanel.tsx` — two-column disclosure panel.
- [x] `src/components/WebcamLink.tsx` — external link row.
- [x] `VerdictBand.tsx` — toggle button with `aria-expanded`/`aria-controls`, panel, webcam row.
- [x] Verify: `npm run typecheck` + `npm run build` + four live config cases.

## Dev Notes

**The toggle is hidden when the verdict is null.** AC 1 reads as though the toggle is always present,
but with a null verdict the band is already showing the raw values inline (Story 3.2's FR-8 fallback),
and offering to "reveal" what the reader is looking at is noise, not disclosure. The toggle appears
only when a verdict occupies the headline and the numbers are genuinely hidden. Same information, one
fewer dead control.

**Two columns, not five rows.** The band shares a fixed viewport with the crew zone, and five stacked
rows grow it by ~100px when expanded. A two-column `<dl>` costs three rows instead.

**No units, again.** Same reasoning as the 3.2 fallback: SwellCloud's units are unknown, the labels say
what each number *is*, and printing "ft" or "kt" would be a confident lie about someone's surf session.

**`webcamUrl` is resolved server-side and rides on `break.list`.** The env map is server-only, and
shipping the whole curator config to every browser to find one URL would be silly. One resolved string
(or `null`) per Break, alongside `rawData` — same single-query rule as everything else in this subtree.

**Label matching is case- and whitespace-insensitive.** A curator typing `"the point"` into a JSON file
should not have to match `Break.label` byte for byte to make the link appear.

**Only `http(s)` URLs are accepted.** This value lands in an anchor's `href`, and `javascript:` in a
config file is script injection with extra steps. Rejected entries are skipped with a warning rather
than failing the whole map.

**AC 5 conflicts with `src/env.js`, and env.js wins for the malformed case.** The env schema already
refuses to boot on a `WEBCAM_URLS_JSON` that is not parseable JSON, so "does not crash" is not literally
reachable for that input — the app never starts. That is the better behaviour (a config typo should
fail at deploy, not silently drop features), and it was chosen in Story 1.1, not here. What `webcams.ts`
adds is the case env.js cannot catch: **valid JSON of the wrong shape** — an array, or non-string
values — which warns and degrades to an empty map exactly as AC 5 intends. If the fail-fast boot is
ever unwanted, relaxing it is a one-line change to `src/env.js`.

**`conditions.getForBreak` still has no caller, and that is now a decision.** The sprint plan asked this
story to either use it or delete it. It is kept: Story 3.1's AC 3 requires the procedure to exist, and
`break.list` already carries `rawData` for the whole stack, so calling it per-panel would be a second
round trip for data that is already on screen. It stays as the documented single-Break read path with
no V1 caller. Delete it in Story 5.2 if `break.list` absorbs everything.

## Verification

`npm run typecheck` and `npm run build` pass. Four `WEBCAM_URLS_JSON` values were run through a real
production server against local Postgres, each on its own port, reading `break.list` with a live session
cookie:

| Config | Result |
|---|---|
| `{"the point":"https://example.com/cam"}` | The Point resolved the URL — lowercase key matched the label |
| `{"Somewhere Else":"…"}` | both Breaks `null` — no row rendered, no warning |
| `["not","a","map"]` | `null`, warned `WEBCAM_URLS_JSON is not a map of label -> URL; treating as empty` |
| `{"The Point":"javascript:alert(1)"}` | `null`, warned `entry is not an http(s) URL; skipping` |

**A testing note worth keeping.** The first pass at this appeared to show the wrong-shape case failing
silently. It was the harness, not the code: each new `npm start` hit `EADDRINUSE` against the previous
still-running server, and curl was answered by the *old* process, shifting every result by one run. One
port per case fixed it. If a future check produces a result that contradicts the code you are reading,
check for a stale listener before believing it.

The panel's expand/collapse and `aria-expanded` were not exercised in a browser — there is no test
runner and no browser automation in this project (the gap is already logged from Story 2.1). The markup
carries `aria-expanded`, `aria-controls` and a `min-h-12` tap target; behaviour is a `useState` toggle.

## Files

| File | Change |
|---|---|
| `src/lib/webcams.ts` | new — env map parsing, shape + scheme validation, label normalisation |
| `src/components/RawDataPanel.tsx` | new — two-column disclosure panel (FR-6) |
| `src/components/WebcamLink.tsx` | new — external webcam row (FR-9) |
| `src/components/VerdictBand.tsx` | toggle button, panel, webcam row; now a client component |
| `src/components/BreakScreen.tsx` | passes `webcamUrl` through |
| `src/server/api/routers/break-router.ts` | `break.list` resolves `webcamUrl` per Break |
