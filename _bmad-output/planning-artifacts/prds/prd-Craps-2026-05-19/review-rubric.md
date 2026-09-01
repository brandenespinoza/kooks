# PRD Quality Review — Kooks

## Overall verdict

This PRD is lean, purposeful, and unusually honest for a V1 document — the thesis is sharp, the persona is grounded in a real person, and the Assumptions Index is doing real work. The primary risk is not missing scope but missing resolution: six Open Questions govern core product behavior (API selection, LLM cost model, notification targeting logic, webcam threshold) and the PRD does not pressure them toward a decision window. A secondary risk is that the two most ambiguous FRs — FR-9 (webcam threshold) and FR-20 (dawn patrol "primary Break") — would block engineering without further clarification.

---

## Decision-readiness — adequate

The PRD makes real decisions. Invite-Link-only onboarding, no account recovery, display name only, PWA/no App Store — these are sharp calls with trade-offs named (see §5 Non-Goals, §4.4). The [NOTE FOR PM] in FR-6 (tide data accuracy) and FR-9 (webcam scope) are genuine tension markers, not boilerplate.

Where it slips: the six Open Questions are enumerated clearly but carry no urgency framing. OQ-1 (conditions API) and OQ-2 (LLM model + cost) are prerequisite to any backend spike — the PRD doesn't call this out. A reader scanning §10 doesn't know which OQs must resolve before any code ships versus which can trail into sprint 2. The trade-off between "LLM-generated verdict = personality, cost, and API dependency" versus "rule-based verdict = free, deterministic, boring" is surfaced only implicitly in OQ-2; it deserves a named trade-off statement.

### Findings

- **high** Missing OQ prioritization / blocking dependency call-out (§10) — OQ-1 and OQ-2 are blocking to any backend build; the PRD treats all six OQs as equivalent and deferred. *Fix:* Add a "Blocking before sprint 1" marker to OQ-1 and OQ-2; add a cost-vs-personality trade-off statement to §1 or §10.
- **medium** LLM trade-off not surfaced as a decision (§4.2, OQ-2) — the choice to use an LLM for a 10-word verdict (vs. a rule-based template) is a meaningful product and cost bet; it's buried in an OQ. *Fix:* Elevate to a stated decision with the trade-off named: LLM = hype-friend voice at recurring cost and latency; rule-based = free and deterministic but flat.
- **low** Out check-in display duration is an OQ *and* an ASSUMPTION simultaneously (FR-13, §11) — the assumption entry says "TBD" and OQ-6 re-asks the same question. Redundant and slightly confusing. *Fix:* Remove the ASSUMPTION tag from FR-13; OQ-6 is sufficient.

---

## Substance over theater — strong

No meaningful theater detected. The persona (§2.1) is not a generic archetype — it is a named real person (Reef's wife, Emerald Isle, NC) with a specific morning routine. This is as grounded as a persona gets without a research report. The JTBDs (§2.2) are differentiated and behavioral, not marketing copy. The Vision (§1) is product-specific: "friend presence surfaces first, conditions second, raw data one tap away" is a design constraint, not a tagline that could swap into any surf app.

NFRs (§7) are sparse but each one is product-specific: the 5-second Crew visibility SLA, the 30-minute conditions staleness ceiling, the 30-second notification delivery window are all directly traceable to FR numbers. No "the system shall be responsive" boilerplate.

### Findings

- **low** Secondary persona (§2.2 "Her surf friends") is thin — described as a barrier-to-entry problem rather than a user with JTBDs. The PRD acknowledges "their barrier to entry is deliberately low" but doesn't articulate what the friend's experience is or whether the friend has any value independent of the primary user's decision. *Fix:* Add one JTBD line for the friend persona, or explicitly note that the friend is a network-effect node rather than a designed-for user.

---

## Strategic coherence — strong

The thesis is stated explicitly and early (§1): "The real decision to paddle out is social, not meteorological." Every feature section traces back to this. Check-In and Social Graph are the core; Conditions is the confirming layer. The feature ordering (Break → Conditions → Check-In → Social → Notifications → Auth) follows the product logic cleanly.

Success metrics are absent from the PRD. For a hobby-grade V1 built for one surfer and a two-person crew, this is acceptable — but the PRD does not state what "V1 success" looks like, leaving the builder with no exit criterion. The Vision closes with "built for one surfer and her crew at one break, replicable to any surfer with a crew at any break" — this is a coherent bet, but the replication premise is not validated in scope, which is fine for V1 as long as it's acknowledged.

### Findings

- **medium** No success metric or exit criterion for V1 (no §SM section) — the PRD has no stated threshold for what makes V1 a success or failure. For a solo builder, even one informal metric ("primary user opens the app at least 4 mornings per week for 3 weeks") would anchor iteration decisions. *Fix:* Add a §SM section with 1–2 behavior-level metrics specific to the primary user and one adoption metric for the friend persona (e.g., at least one friend connected and active within 2 weeks of launch).
- **low** "Replicable to any surfer with a crew" (§1) is not validated in MVP scope — this is a V2+ thesis; current Non-Goals and scope decisions (Bogue Inlet webcam only, iOS only, invite-only) are correctly V1-constrained but the gap between V1 and "replicable" is not acknowledged. *Fix:* Add a one-line note: "Generalizability is a V2 thesis; V1 validates the thesis at one break with one crew."

---

## Done-ness clarity — adequate

The Consequences (testable) blocks are the PRD's strongest mechanical feature. Most FRs have 2–4 specific, testable assertions — no "handles gracefully" language detected. The 10-word ceiling on Conditions Verdict (FR-5), the 5-second propagation SLA (FR-1, FR-10), the 30-second notification window (FR-18), and the 2-hour auto-expiry (FR-12) are all bounds, not adjectives.

Gaps exist where OQs are unresolved:

- FR-9 (webcam auto-surface): "notably good or gnarly threshold" is a direct quote — this is a vague adjective, not a bound. The OQ correctly flags this, but the FR consequence reads as untestable until OQ-3 resolves.
- FR-19 (night-before nudge, best Break): "or highlights the best one" is unresolved — the consequence cannot be tested until OQ-4 resolves.
- FR-20 (dawn patrol, primary Break): consequences reference "user's primary Break" which is itself defined by an assumption that may change (OQ-5 lists three options). The test cannot be written until this resolves.

### Findings

- **high** FR-9 consequence is untestable (§4.2) — "Webcam shortcut becomes visually prominent when conditions threshold is met" — the threshold is undefined. An engineer cannot write a passing test. *Fix:* Define the threshold in the FR (e.g., "swell height ≥ 3ft AND wind speed ≤ 10mph AND offshore wind direction") or block FR-9 implementation on OQ-3 resolution explicitly.
- **medium** FR-19 and FR-20 consequences reference undefined inputs (§4.5) — "best one" (OQ-4) and "primary Break" (OQ-5) are placeholders. Consequences written against them are theater. *Fix:* Either resolve the OQs and update the consequences, or add a [BLOCKED: OQ-4/OQ-5] marker to the relevant consequence lines so the engineer knows to wait.
- **low** FR-13 Out behavior consequence: "Out status displays on the Break screen for all Crew members" — passes for now, but the duration is tagged [TBD]. The consequence will need a time-bound once OQ-6 resolves. *Fix:* Add a [BLOCKED: OQ-6] marker to FR-13's duration consequence so it's tracked.

---

## Scope honesty — strong

Non-Goals (§5) is doing real work. Ten explicit exclusions, each with a rationale or V2 pointer. The GPS deduplication note in §6.2 ("250m radius threshold logged for V2 consideration; V1 uses manual social convention") is a model of scope-boundary writing. The "AI webcam analysis" out-of-scope item carries a [NOTE FOR PM] "emotionally load-bearing — revisit if timeline permits," which is an honest signal about a contested cut.

The Assumptions Index (§11) has 15 entries, all sourced to specific section/FR numbers. This is unusually thorough and directly usable by a downstream architect or story writer.

One gap: the invite link security model is not scoped. A single persistent invite link per user (FR-14 ASSUMPTION) means a leaked link gives permanent app access. The PRD does not name this as a risk or a non-goal. For a trust-based crew of 2–3 friends this is probably fine, but it should be named.

### Findings

- **medium** Persistent invite link security model not acknowledged (§4.4 / FR-14) — a single, non-expiring invite link per user means anyone with the link can join the user's Crew. At 2–3 person crew scale this is low stakes, but it is an implicit security trade-off that is not named anywhere. *Fix:* Add a Non-Goal entry: "Invite link expiry or one-time-use links — V1 uses a single persistent link per user; link revocation is not supported. At 2–3 person crew scale this is acceptable."

---

## Downstream usability — strong

The Glossary (§3) is present, well-formed, and used consistently across the document. Every term used in FRs ("Break," "Check-In," "Conditions Verdict," "Crew," "ETA," "Invite Link," "Raw Data") has a Glossary entry. Cross-usage is consistent — no synonym drift detected ("Check-In" is always "Check-In," never "check in" in a functional claim).

FR IDs are contiguous (FR-1 through FR-23) with no gaps. Each Feature section names the UJs it realizes (e.g., "Realizes UJ-1, UJ-2, UJ-3") and those UJs are defined in §2.5. The secondary persona (§2.2 duplicate heading — see Mechanical Notes) is the only ID/label issue.

The Information Architecture (§9) is a short outline but sufficient for a UX designer to understand the screen count and flow. Story creation from this PRD would be straightforward: each FR maps to testable consequences that can become acceptance criteria directly.

### Findings

- **low** §2.2 heading is duplicated — "2.2 Jobs To Be Done" and "2.2 Secondary Persona" share the same section number (§2.2). The Secondary Persona should be §2.3 and Non-Users should shift to §2.4. *Fix:* Renumber §2.2 Secondary Persona → §2.3, §2.3 Non-Users → §2.4, §2.5 Key User Journeys → §2.5 (unchanged).

---

## Shape fit — strong

The PRD is calibrated correctly for a hobby-grade, single-builder, single-primary-user PWA. Two personas, four UJs, 23 FRs — this is not over-formalized. The UJ paths are short, scenario-specific, and grounded in a real person's morning behavior rather than abstract user flows. The Aesthetic section (§8) is brief but earns its place because voice and visual register are load-bearing for this product's differentiation.

The Assumptions Index and testable consequence blocks represent slight over-engineering for a project of this scale, but they are net positive: they protect Reef from scope creep and give him a concrete checklist to build against. The formalism serves the solo builder here rather than creating ceremony for its own sake.

No shape mismatch detected.

---

## Mechanical notes

- **§2.2 section number collision:** "2.2 Jobs To Be Done" and "2.2 Secondary Persona" are both labeled §2.2. This will cause downstream cross-reference failures if UX or stories cite "§2.2."
- **ASSUMPTION and OQ duplication:** FR-13 carries an `[ASSUMPTION]` tag with "exact behavior TBD" while OQ-6 asks the same question. One reference is sufficient.
- **§9 Information Architecture** does not cross-reference FR numbers. This is acceptable at this PRD's formalism level but a story writer would benefit from FR citations per screen (e.g., "Break screen: FR-5, FR-6, FR-7, FR-9, FR-10, FR-11").
- **Assumptions Index roundtrip check:** All 15 Assumptions Index entries point to a real section or FR. No orphan assumptions. No inline `[ASSUMPTION]` tags without Index entries detected.
- **OQ roundtrip check:** OQ-1 through OQ-6 are each referenced from at least one FR or NFR section. No orphan OQs. OQ-3 is referenced in FR-9 consequences and FR-9 Notes; OQ-5 is referenced in FR-20 consequences and §11 — clean.
