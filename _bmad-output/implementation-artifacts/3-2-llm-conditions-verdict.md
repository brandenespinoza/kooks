# Story 3.2: LLM Conditions Verdict

Status: **done** (2026-09-01)
Epic: 3 — Conditions
FRs: FR-5, FR-8
UX: UX-DR1 (verdict at 28px/700 on navy), graceful LLM fallback

## Story

As a user,
I want to see a plain-language conditions verdict of 10 words or fewer in the Break screen header,
So that I can read the go/no-go signal before my brain is fully awake.

## Acceptance Criteria

1. **`generateVerdict(rawData)` exists and is server-only.** `src/lib/openai.ts` calls GPT-5.4 nano
   with a system prompt specifying surfer-dude voice, enthusiasm, safety-awareness and a 10-word
   ceiling, and returns the verdict string. `OPENAI_API_KEY` never reaches the client.
2. **A new model run regenerates the verdict.** When the SwellCloud model-run timestamp differs from
   `Break.conditionsModelRunAt`, the poll calls `generateVerdict`, writes `conditionsVerdict`, and
   advances `conditionsModelRunAt`.
3. **The same model run does not.** `rawData` and `conditionsUpdatedAt` are refreshed;
   `generateVerdict` is not called and `conditionsVerdict` is unchanged.
4. **An LLM failure degrades, it does not throw.** `conditionsVerdict` is set to `null` on that Break,
   the error is logged via pino, nothing propagates, and the remaining Breaks are still processed.
5. **A verdict renders as the headline.** 28px/700 in `--action-fg` on navy, never more than 10 words.
6. **A null verdict renders the raw numbers inline** in the verdict zone in muted typography, and the
   layout does not break.
7. **Missing `OPENAI_API_KEY` fails at boot** via T3 env validation.

## Tasks

- [x] `src/lib/openai.ts` — `generateVerdict`, system prompt, word-ceiling enforcement.
- [x] `conditions-jobs.ts` — model-run gate, verdict write, failure path.
- [x] `break-router.ts` — `break.list` carries parsed `rawData` for the fallback.
- [x] `BreakScreen.tsx` / `VerdictBand.tsx` — render the fallback; retire the Epic-3 placeholder line.
- [x] Verify: `npm run typecheck` + `npm run build` + a live `break.list` call.

## Dev Notes

**No migration.** `conditionsVerdict` and `conditionsModelRunAt` shipped in `20260901005755_full_schema`.

**`gpt-5.4-nano` is not a guess.** It is a member of the installed SDK's own `ResponsesModel` union
(`openai@6.38.0`), so the model id the PRD specifies typechecks against the SDK. That is the one part
of this story with a verified contract.

**Responses API, not chat completions.** `client.responses.create({ model, instructions, input,
max_output_tokens })` and `response.output_text`. Two parameter choices worth keeping:

- **No `temperature`.** Newer OpenAI models reject it outright, and a ten-word verdict does not need
  sampling control.
- **`max_output_tokens: 200`**, which is wildly generous for ten words on purpose: on a
  reasoning-capable model the reasoning tokens come out of the same budget, and a tight cap returns an
  empty string rather than a short verdict.

**The 10-word ceiling is enforced in code, not just requested in the prompt.** `enforceWordCeiling`
collapses whitespace, strips the quotation marks models like to add, and truncates past ten words.
FR-8's ceiling is also a layout constraint — the band renders at 28px, and a rambling verdict pushes
the crew zone off screen. Truncating beats discarding: nine words of a good read is still usable.

**The gate is one comparison, with a synthetic fallback.** `resolveModelRun` returns SwellCloud's
`modelRunAt` when present. When it is absent — likely, since the response shape is an assumed contract
— it buckets the clock into 6-hour windows instead. Either way the comparison against
`conditionsModelRunAt` is identical and regeneration lands at FR-8's 4x daily, with no second code
path to keep honest.

**A failed verdict does not advance the gate.** AC 4 requires writing `conditionsVerdict = null`, which
this does. It deliberately leaves `conditionsModelRunAt` alone, so the next poll retries in 30 minutes
rather than leaving the band empty until the next model run six hours later. The cost of that choice:
a sustained OpenAI outage means one failed call per Break per poll. Failed calls are not billed and the
sweep does not block on them.

**Clearing a good verdict on a transient failure is a real trade-off.** AC 4 says null, so null it is —
the reasoning being that a verdict written for a forecast run that has since moved on is worse than no
verdict. But a 30-second OpenAI blip now blanks a perfectly good headline for up to 30 minutes. Logged
in `deferred-work.md`; if it proves annoying, keeping the old verdict and ageing it with the timestamp
is the alternative.

**`rawData` now travels on `break.list`.** The fallback needs the numbers in the swipe stack, and
`BreakSwipeStack` is the single tRPC caller for that subtree (replan correction 11) — fetching them
per-panel would be N queries for data the list query can carry. It is `safeParse`d server-side, so a
row written by an older shape arrives as `null` and renders "No conditions data yet" instead of
breaking the panel. Verified against a deliberately malformed row.

**The fallback prints no units.** SwellCloud's are unknown, and inventing "ft" or "kt" is a confident
lie about someone's surf session. Two muted lines — `Swell 1.4 at 11s from 145°` / `Wind 8.5 from
220°` — which hold the band's height so nothing below shifts.

## Verification

`npm run typecheck` and `npm run build` pass. Live check against local Postgres with both dev fixtures
seeded, `break.list` called with a real session cookie:

- A Break with a verdict returns it alongside parsed `rawData` (the verdict wins in the band).
- A Break with `conditionsVerdict: null` returns typed `rawData` — the fallback's input.
- A row set to `{"nope":1}` returns `rawData: null`, so the guard holds.
- The boot poll ran, failed on SwellCloud as expected, and left the seeded `rawData` untouched.

**What could not be verified, and why.** `OPENAI_API_KEY` in `.env` is the literal string `placeholder`,
and `api.swellcloud.net` resolves but never completes a TCP connection (checked 2026-09-01,
unauthenticated, from this machine). So:

- `generateVerdict` has never run against the real API. The model id typechecks; the request shape,
  the prompt's output and the failure taxonomy have not been exercised.
- The model-run gate has never been exercised either, because no poll has ever succeeded.

No live OpenAI call was attempted at the time — there was no usable key, and spending someone's API
budget is not a verification step to take unasked.

### Addendum — verdict generation verified (2026-09-01, same day)

A real `OPENAI_API_KEY` was supplied and `generateVerdict` was exercised **against the live API**, one
call, through the actual module rather than a copy:

```
npx tsx --env-file=.env --conditions=react-server <script importing ~/lib/openai>
```

- **Success path:** `gpt-5.4-nano` returned `"Clean little knee-chest lines, light offshore—worth a chill
  paddle."` — 9 words, ~1.8s, from the seeded fixture data. The model id is live, not merely typed; the
  Responses API call shape, `instructions`/`input`, `max_output_tokens` and `output_text` are all
  correct; and the prompt lands inside the ten-word ceiling on its own.
- **Failure path:** with `OPENAI_BASE_URL` pointed at a dead port (no API call, no cost), the SDK's
  `APIConnectionError` came back wrapped as `VerdictGenerationError` with the cause chain intact — which
  is exactly what `generateVerdictOrNull` catches to null the verdict and continue the sweep.

**Still unexercised:** the model-run gate, because it needs a *successful poll* and SwellCloud is down.
Story 3.2's own logic is now proven; what stands between it and a working Break screen is the
conditions source, not this story.

### Addendum 2 — the whole pipeline ran, and it found two defects (2026-09-01)

With `CONDITIONS_SOURCE=mock` (added the same day — see Story 3.1's addendum) and a real
`OPENAI_API_KEY`, the conditions pipeline ran end to end for the first time. **The model-run gate is now
proven**, which was the last unverified piece of Epic 3:

| Sweep | Result |
|---|---|
| First (both Breaks had `conditionsModelRunAt = null`) | `refreshed:0, regenerated:2` — the LLM was called and verdicts were written |
| Second, same 6-hour model run | `refreshed:2, regenerated:0` — raw data refreshed, **no LLM call**, verdicts untouched |

That is exactly FR-8's ceiling behaviour: freshness every poll, generation only on a new model run.

**Two real defects surfaced, both now fixed:**

1. **The model invented a unit.** A verdict came back as "Middling **1.9ft** swell…" despite the prompt
   saying not to state units. SwellCloud's units are unknown — 1.9 could be metres, which is the
   difference between knee-high and overhead, on a screen whose entire job is telling someone whether to
   paddle out. The instruction is now explicit ("NEVER write a unit — no ft, m, kt, mph…") and suggests
   body-scale language instead. Re-generated verdicts contain no units.
2. **The ten-word cut landed mid-phrase.** A verdict was stored as "Knee to waist high, light wind;
   should be clean—**go get**". Truncation was the deliberate choice (a short verdict beats none), but a
   hard cut reads as broken. `enforceWordCeiling` now backs off to the last clause boundary when the cut
   does not land on sentence punctuation, and keeps the hard cut only when no usable boundary exists.

`enforceWordCeiling` is exported and exercised directly — it is the one piece of verdict handling that
needs no API call to test, and its failure mode reaches the user:

| Input | Output |
|---|---|
| the exact truncated verdict above | `Knee to waist high, light wind; should be clean` (9w) |
| twelve words, no punctuation | hard cut at 10 — no boundary to back off to |
| already under the ceiling | untouched |
| model-added surrounding quotes | stripped, cut at 10 |
| ragged whitespace | collapsed |

Current verdicts on mock data read as intended: *"Middlin' knee-chest, but wind's punchy—probably not
worth it today."* and *"Clean little shoulder-breathers, nice 12-second sets—worth paddling out."* —
surfer voice, safety-aware, no invented units, complete thoughts.

## Files

| File | Change |
|---|---|
| `src/lib/openai.ts` | new — `generateVerdict`, prompt, word-ceiling enforcement |
| `src/server/jobs/conditions-jobs.ts` | model-run gate, verdict write, failure path |
| `src/server/api/routers/break-router.ts` | `break.list` returns parsed `rawData` |
| `src/components/VerdictBand.tsx` | `RawDataFallback`; Epic-3 placeholder line retired |
| `src/components/BreakScreen.tsx` | passes `rawData` through |
