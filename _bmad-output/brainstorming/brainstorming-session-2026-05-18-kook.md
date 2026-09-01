---
stepsCompleted: [1, 2]
inputDocuments: []
session_topic: 'Kooks — PWA surf conditions app for wife at Emerald Isle, NC'
session_goals: 'Sharpen the product concept using SCAMPER; find what is missing or worth cutting'
selected_approach: 'ai-recommended'
techniques_used: ['Role Playing', 'What If Scenarios', 'SCAMPER Method']
ideas_generated: []
context_file: ''
---

## Session Overview

**Topic:** Kooks — PWA surf conditions app for the user's wife  
**Goals:** Surface a focused, buildable concept with clear differentiator; sharpen via SCAMPER after Role Playing + What If Scenarios

### Session Setup

User: Reef. Wife is the primary user — morning surfer at Emerald Isle, NC. BI professional, data-literate but data-fatigued at 5:45am. Three spots: The Point, Land's End, Bogue Inlet Pier.

Target feeling: "Clean. Like spring morning sunshine."

---

## Technique Selection

**Approach:** AI-Recommended  
**Techniques:**
- Role Playing — understand the real user and real morning ✅ Complete
- What If Scenarios — expand and generate ideas ✅ Complete
- SCAMPER Method — sharpen and refine the concept 🔄 In progress

---

## Phase 1 + 2 Ideas (from Role Playing + What If Scenarios)

**[UX #1]**: The Morning Verdict  
_Concept_: One screen. A single human-voice assessment of current conditions — always positively framed, tuned to her skill level. "Clean waist-high sets, offshore glass."  
_Novelty_: Every surf app shows data. None have a voice that roots for the user and makes her smile at 5:45am.

**[UX #2]**: The Mood Icon  
_Concept_: Single expressive visual capturing the vibe — glassy and golden vs. choppy grey mess. Conditions as feeling, not measurement.  
_Novelty_: Designed for 5:45am brain. Sensory over analytical.

**[UX #3]**: The Webcam Shortcut  
_Concept_: One-tap link to Bogue Inlet Pier cam. Auto-surfaces on notably good or bad days with nudge: "don't take our word for it."  
_Novelty_: Ground truth. The cam becomes a trust signal.

**[UX #4]**: The Skill Filter  
_Concept_: Conditions translated through her ability level. Big day = "grab breakfast and watch the sets roll in." Perfect day = "get out there."  
_Novelty_: Built for her, not the data-literate power surfer.

**[UX #5]**: The Tap-to-Reveal  
_Concept_: Simple human verdict on top. Tap → actual data underneath (swell height, period, wind direction, tide). Progressive disclosure tuned to morning brain.  
_Novelty_: Other apps lead with data. This one leads with the answer.

**[SPOT #1]**: My Spots  
_Concept_: Pre-loaded with three local breaks; add/remove as needed. Each gets its own verdict card.  
_Novelty_: Hyper-local by default, flexible by design.

**[SPOT #2]**: Best Break Now  
_Concept_: One tap shows which saved spot has best conditions right now. "Today's best bet."  
_Novelty_: Removes decision fatigue when plans fall through.

**[VOICE #1]**: The Hype Friend  
_Concept_: Every verdict written in the voice of an enthusiastic surf-obsessed friend who always roots for her. Warm, funny, specific.  
_Novelty_: Surf apps sound like weather instruments. This one sounds like a person.

**[CAM #1]**: Conditions-Triggered Webcam  
_Concept_: On exceptionally good or gnarly days, cam link surfaces automatically. Average days — one tap away.  
_Novelty_: Webcam as trust signal, not just a feature.

**[NOTIF #1]**: The Smart Window Ping  
_Concept_: Single push 5:00–5:30am on surf days. One sentence. Current conditions, no app opening required.  
_Novelty_: The app works before she's fully awake.

**[NOTIF #2]**: The Night-Before Nudge  
_Concept_: Evening push ~8–9pm when tomorrow looks notably good or bad. "Tomorrow at The Point is shaping up nicely."  
_Novelty_: Moves decision to night-before where it belongs. Morning = execution, not deliberation.

**[GROWTH #1]**: The Forwarded Link  
_Concept_: No App Store, no sign-up. Just a PWA URL she texts to her crew.  
_Novelty_: Distribution through trust, not marketing.

---

## Phase 3: SCAMPER Method — In Progress

### S — Substitute

**[SCAMPER-S1]**: AI Webcam Analysis  
_Concept_: Instead of (or alongside) forecast API data, use AI vision to analyze the live Bogue Inlet Pier webcam feed and generate a real-time conditions read. "We're seeing clean lines right now" based on what's actually in the water — not a buoy prediction from 6 hours ago.  
_Novelty_: Every surf app uses the same forecast APIs. This is ground truth — the actual ocean, right now, interpreted for her.

**[SCAMPER-S2]**: Hyper-Local Tide Tables  
_Concept_: Substitute generic offshore tide predictions with local tide tables specific to Bogue Inlet / Emerald Isle. Different breaks behave differently at specific tidal states — this data is knowable and localizable.  
_Novelty_: Tailored to her exact spots, not the nearest offshore buoy.

### R — Reverse

**[SCAMPER-R1]**: Social-First, Conditions-Second  
_Concept_: Flip the information hierarchy. The primary screen shows who among her surf friends is in — "Sarah's in at The Point." Conditions confirm or veto. Social signal leads; data follows. She's 80% decided the moment she sees a friend is going.  
_Novelty_: Every surf app treats conditions as primary and social as an afterthought. Kooks treats the real human decision-making process as primary.

**App name updated: Kook → Kooks** (plural, reflects the mildly social nature)

### E — Eliminate

**Cut: Best Break Now** — she knows where she's going the night before. Rare use case doesn't earn screen real estate.  
**Cut: Session window forecast** — "maybe" = not yet. Adds data complexity against marginal benefit.  
**Cut: Mood icon** — redundant if the 10-word verdict is doing its job. Visual noise.

### P — Put to Other Uses

**Design decision:** Stay tightly focused on wife + her existing surf friends. No "crew" or group object. Instead: a friends/surf-buddies list. When she checks in (I'm in / I'm out), she selects which friends to notify. When a friend checks in and includes her, she gets a push notification. Bidirectional, opt-in per check-in. Implies lightweight accounts for identity — invite-link model (she texts a link, friend taps, creates a name + account, they're connected).

### M — Modify

**[SCAMPER-M1]**: The 10-Word Rule  
_Concept_: Hard constraint — if she has to read more than 10 words before knowing whether to go, the design failed. Every feature must either fit within 10 words on the main screen or be one tap away. Nothing else exists.  
_Novelty_: Not a design guideline — a product law. Enforces the "clean spring morning" feeling structurally, not just aesthetically.

### A — Adapt

**[SCAMPER-A1]**: The Session Window (maybe)  
_Concept_: A plain-language read on the best 2-hour window of the morning — "cleans up by 8am." She can choose to leave later and catch better conditions rather than paddling into slop.  
_Novelty_: Surf apps show now. This shows when.

**[SCAMPER-A2]**: Wordle-Style Ephemerality  
_Concept_: The morning verdict is intentionally ephemeral — exists only for this morning, expires when the session window closes, no history to scroll. One thing, once a day, gone.  
_Novelty_: Creates urgency and daily ritual without feature bloat. The app has nothing to do after 10am — and that's a feature, not a bug.

### C — Combine

**[SCAMPER-C1]**: The Spot Card  
_Concept_: A shareable link tied to a specific spot + morning. Friends open it, see the same conditions verdict, and tap "I'm in" or "I'm out." No account, no install — just a name field and a button. Night-before nudge could summarize: "The Point looks good tomorrow. Sarah and Mike are in. You?"  
_Novelty_: Collapses the conditions check and friend confirmation into one gesture. The social coordination that currently lives across Band/text/FB becomes one tap inside Kook.

**Design note:** Crew is small (2-3 regulars). Bails happen morning-of, not night-before — so the Spot Card must show live status right up until she leaves. The verdict and the headcount need to be the same real-time view.

