---
title: "PRD: Kooks"
status: final
created: 2026-05-19
updated: 2026-05-19
---

# PRD: Kooks

## 0. Document Purpose

This PRD defines the V1 requirements for Kooks — a social-first surf PWA for recreational surfers with a regular crew. It is written for the builder (Reef) and any downstream workflow owners (UX, architecture, epics). The document is organized by feature group with globally numbered functional requirements (FR-N) for stable downstream reference. Assumptions are tagged `[ASSUMPTION]` inline and indexed in §9. This PRD builds directly on the finalized product brief (`_bmad-output/planning-artifacts/briefs/brief-Craps-2026-05-18/brief.md`) and does not duplicate it.

---

## 1. Vision

Kooks is a Progressive Web App for recreational surfers who go out with a regular crew. The real decision to paddle out is social, not meteorological — you go if your friends are going, and conditions confirm or veto. Every existing surf app ignores this. Kooks puts it at the center: friend presence surfaces first, conditions second, raw data one tap away.

The interface is organized by Break. Swipe between your saved Breaks to see live conditions and who among your Crew is heading there and when. Check yourself in from the same screen. Conditions update every 15–30 minutes. Friend status updates the moment someone updates their plans.

Kooks is not a weather instrument. It is not a social feed. It is a presence tool for the surfer who surfs for the people, not the data — built for one surfer and her crew at one break and replicable to any surfer with a crew at any break. V1 validates the thesis at one break with one crew; generalizability is a V2 bet.

**A note on the Conditions Verdict:** Kooks uses an LLM to generate the plain-language verdict rather than a rule-based template. This is a deliberate product bet — LLM = hype-friend voice, personality, and natural language at the cost of per-call latency and recurring API cost. Rule-based = free, deterministic, and flat. The voice is load-bearing; the bet is worth it.

---

## 2. Target User

### 2.1 Primary Persona

**The recreational surfer with a regular crew.** Goes out multiple times a week with the same 2–3 people. Data-curious but not data-dependent — goes unless conditions are genuinely dangerous. The actual morning decision is: "Is Sarah going?" Checks conditions only to confirm she should get up. Currently splits the decision across a surf app and a text thread. Loads the board and drives to the break without a clear answer from either.

The primary user for V1 is Reef's wife: morning surfer at Emerald Isle, NC. Intimate knowledge of her experience is the design ground truth for V1.

### 2.2 Jobs To Be Done (Primary)

- **Functional:** Know in one glance whether conditions are good and whether her people are in — before she loads the board.
- **Social:** Check in so her crew knows she's coming and when; see that they're coming too.
- **Emotional:** Feel like the decision is already made for her by the time the app closes.
- **Contextual:** Get the morning decision resolved before she's fully awake — on her phone, in bed, without parsing numbers.

### 2.3 Secondary Persona

**Her surf friends.** The presence layer only has value when friends use it. V1 success depends on at least one or two friends adopting Kooks. Their barrier to entry is deliberately low — Invite Link, display name only, no App Store. [ASSUMPTION: her surf friends experience similar morning coordination friction — not yet validated beyond the primary user.]

**JTBD (friend):** Know that the crew is going — or isn't — without having to text anyone. See the check-in, decide whether to go, check themselves in if they are.

### 2.4 Non-Users (V1)

- Data-driven surfers seeking detailed forecast analysis (Surfline serves them)
- Surfers without a regular crew (no presence layer to offer them)
- Surfers using Android as primary device [ASSUMPTION: primary user is on iOS; Android is not a V1 target]

### 2.5 Key User Journeys

**UJ-1. She decides whether to paddle out.**
- **Persona + context:** Primary user, waking up at 5am, groggy, on her phone in bed.
- **Entry state:** App installed to home screen; already authenticated from a prior session.
- **Path:** Opens Kooks → lands on her first Break screen → reads the Conditions Verdict (one line) → sees two friends have checked in for 6am → taps "I'm in" → sets her ETA to 6:15am → closes the app.
- **Climax:** She knows conditions are good and her people are already going. Decision made in under 30 seconds.
- **Resolution:** Her Crew sees her check-in immediately and receives a push notification. She loads the board.
- **Edge case:** No friends have checked in yet. She checks conditions, decides they're good enough, checks herself in first — becoming the social signal for the rest of the crew.

**UJ-2. She plans the next morning the night before.**
- **Persona + context:** Primary user, 9pm, winding down.
- **Entry state:** Receives a night-before nudge push notification.
- **Path:** Notification previews tomorrow's conditions at her usual Break — she taps it → lands on that Break screen → sees conditions forecast → texts her crew ("looks clean tomorrow, I'm going at 6") → optionally pre-checks in with a morning ETA.
- **Climax:** Coordination happens before bed, not in a rushed 5am text thread.
- **Resolution:** Crew is aligned before anyone goes to sleep.

**UJ-3. She gets the dawn patrol push.**
- **Persona + context:** Primary user, 5:15am, phone on nightstand.
- **Entry state:** Dawn patrol push fires — one line, current conditions at her usual Break.
- **Path:** Reads the notification without opening the app.
- **Climax:** She knows whether to get up in two seconds.
- **Resolution:** Opens the app only if she wants to check friend presence or check in.

**UJ-4. She onboards a friend.**
- **Persona + context:** Primary user wants to bring a surf friend into Kooks.
- **Entry state:** Authenticated, in-app.
- **Path:** Opens invite link → copies it → texts it to friend → friend taps link, enters a display name, account created → connection is mutual and immediate.
- **Climax:** Friend appears in her Crew; they can both see each other's check-ins from that moment forward.
- **Resolution:** No further setup required. Friend receives their own dawn patrol and night-before nudges from the next day on.

---

## 3. Glossary

- **Break** — A user-defined surf spot: a coordinate pin on a map plus a user-assigned label. Identity is the coordinate; the label is a display name only. Two Breaks pinned within 250m are likely duplicates — resolution by social convention (one owner deletes), not system enforcement.
- **Home Break** — A single Break designated by the user as their primary spot. Governs the dawn patrol push and night-before nudge. One per user; always set to exactly one Break.
- **Break screen** — The per-Break view showing the Conditions Verdict, Raw Data (tap to expand), friend presence, and the Check-In CTA. The primary surface of the app.
- **Check-In** — A user's declared intent to surf at a specific Break at a specific time. Carries: Break and ETA. Binary — either present or not. Auto-expires 2 hours after stated ETA.
- **Conditions Verdict** — The LLM-generated plain-language read of current surf conditions at a Break. Maximum 10 words. Voice: surfer dude, stoked best friend, safety-aware. Generated by GPT-5.4 nano from SwellCloud Raw Data per Break coordinates, cached per model update cycle (4x daily).
- **Crew** — A user's full set of mutually connected friends within Kooks. Friendship is mutual opt-in; once connected, both parties see each other's Check-Ins and Break additions automatically.
- **Dawn Patrol** — The pre-dawn surf window, approximately 5:00–7:30am. The dawn patrol push targets this window.
- **ETA** — Expected arrival time on a Check-In. User-set, editable. Governs auto-expiry (Check-In expires 2 hours after ETA).
- **Invite Link** — A shareable URL that creates a Crew connection when a new user taps it and creates an account. The sole onboarding and friend-connection mechanism.
- **Raw Data** — The underlying marine forecast values for a Break: swell height, swell period, wind speed, wind direction, tide height. Displayed one tap below the Conditions Verdict.

---

## 4. Features

### 4.1 Break Management

**Description:** A Break is the atomic unit of the app. Users create Breaks by dropping a pin on a map and assigning a label. All Crew members see newly created Breaks immediately. Users can delete Breaks they created and save Breaks created by others. The Break screen is the primary navigation surface — users swipe horizontally between their saved Breaks. Breaks are coordinate-first: the pin is the identity, the label is a display name. [ASSUMPTION: no limit on number of Breaks a user can create or save in V1.]

**Functional Requirements:**

#### FR-1: Create a Break
User can create a Break by dropping a pin on a map and entering a label. The Break is immediately visible to all Crew members.

**Consequences (testable):**
- Break appears on all connected Crew members' Break lists within 5 seconds of creation.
- Break is associated with the coordinate of the dropped pin.
- Label is free-text, no format restriction.

#### FR-2: Swipe navigation between Breaks
User can swipe left/right on the Break screen to move between their saved Breaks.

**Consequences (testable):**
- Swiping navigates to the adjacent Break screen.
- Order of Breaks is persistent across sessions. [ASSUMPTION: manual ordering; no algorithm-driven sort in V1.]

#### FR-3: Delete a Break
User can delete a Break they created. Deletion removes the Break from all Crew members' views.

**Consequences (testable):**
- Deleted Break no longer appears for any Crew member.
- Any active Check-Ins on that Break are voided on deletion.

#### FR-4a: Set Home Break
User can designate exactly one saved Break as their Home Break. Home Break governs the dawn patrol push and night-before nudge. User can change their Home Break at any time.

**Consequences (testable):**
- Only one Break can be designated Home Break per user at any time.
- Setting a new Home Break deselects the previous one.
- Home Break is visually distinguished in the swipe stack.
- Dawn patrol push and night-before nudge target the Home Break (FR-19, FR-20).

#### FR-4b: Save a Break created by a Crew member
User can save a Break created by another Crew member to their own Break list.

**Consequences (testable):**
- Saved Break appears in the user's swipe stack.
- Unsaving removes it from the user's swipe stack without affecting the Break for others.

---

### 4.2 Conditions

**Description:** Each Break screen surfaces a live read of surf conditions at that Break's coordinates. The Conditions Verdict is the hero element — a single LLM-generated line in a hype-friend voice, capped at 10 words, designed to deliver the go/no-go signal before the user is fully awake. Raw Data is one tap below for the data-curious. Conditions refresh every 15–30 minutes from a third-party marine forecast API (TBD — see OQ-1). The Bogue Inlet Pier webcam is accessible one tap from any Break screen and auto-surfaces when conditions cross a notably good or gnarly threshold. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-5: Conditions Verdict per Break
Each Break screen displays a Conditions Verdict generated by an LLM from Raw Data at that Break's coordinates. Maximum 10 words. Hype-friend voice.

**Consequences (testable):**
- Verdict is present on every Break screen.
- Verdict text does not exceed 10 words.
- Verdict reflects current conditions data, not a cached forecast snapshot.

**Out of Scope:** Multi-sentence analysis; forecast-window summaries; comparisons across Breaks.

#### FR-6: Raw Data tap-to-reveal
Raw Data (swell height, swell period, wave direction, wind speed, wind direction) is hidden by default and revealed with one tap below the Conditions Verdict. Sourced from SwellCloud API by Break coordinates.

**Consequences (testable):**
- Raw Data is not visible on initial Break screen load.
- Single tap toggles Raw Data into view.
- Values match the source data used to generate the Conditions Verdict.

**Out of Scope:** Tide data is deferred to V2. SwellCloud does not provide tide; a separate tide integration (e.g. NOAA CO-OPS) will be added post-V1.

#### FR-7: Conditions data refresh
Conditions data refreshes automatically every 15–30 minutes per Break.

**Consequences (testable):**
- Data timestamp is visible to the user (or derivable from the UI).
- No Break screen displays data older than 30 minutes during active use.

#### FR-8: LLM Conditions Verdict generation
Conditions Verdict is generated by calling GPT-5.4 nano (OpenAI) once per SwellCloud model update (4x daily) per Break. Input: raw SwellCloud data for that Break's coordinates. System prompt specifies voice (surfer dude, stoked best friend, safety-aware, 10-word ceiling). Verdict is cached at the Break level and served to all users — no per-user LLM call. API key stored in `.env`, never exposed to the client.

**Consequences (testable):**
- LLM API key is not present in any client-side bundle or network request.
- Verdict generation fails gracefully — fallback to Raw Data display if LLM call fails. [ASSUMPTION: plain "data only" fallback is acceptable; no cached prior verdict displayed.]

#### FR-9: Webcam links
Each Break screen surfaces curated webcam links associated with that Break. Links are defined at build time via `.env` and keyed to each Break. Webcams are always visible when present. Tapping a link opens the feed in an external browser.

**Consequences (testable):**
- Break screen displays webcam links when one or more are configured for that Break in `.env`.
- Webcam section is hidden when no links are configured for a Break.
- Tapping a link opens the webcam feed in an external browser.
- Webcam links are static — not dynamically fetched or user-editable.

**Notes:** Webcam links are curator-supplied (Reef) at build time. No external webcam API. Adding or changing webcam links requires a redeployment.

---

### 4.3 Check-In

**Description:** Check-In is the core social action. A user declares intent to surf at a specific Break at a specific time. The whole Crew sees it immediately. Check-Ins are editable — change Break or ETA at any time. To cancel, the user removes the Check-In entirely. There is no "Out" status: you're either checked in or you're not. Auto-expiry at 2 hours after ETA keeps presence clean without manual cleanup. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-10: Create a Check-In
User can check in by selecting a Break and setting an ETA. Check-In is immediately visible to all Crew members.

**Consequences (testable):**
- Check-In appears for all Crew members within 5 seconds of submission.
- Check-In displays: Break name, user display name, ETA.
- ETA is required; user cannot check in without setting one.
- A user can only have one active Check-In at a time.

#### FR-11: Edit a Check-In
User can change their Break selection or update their ETA at any time before expiry.

**Consequences (testable):**
- Edit is reflected for all Crew members within 5 seconds.
- Each edit triggers a push notification to Crew (see FR-18).

#### FR-12: Remove a Check-In
User can remove their Check-In at any time. Removal is immediate and visible to all Crew members.

**Consequences (testable):**
- Removed Check-In disappears from all Crew members' views within 5 seconds.
- Removal triggers a push notification to Crew (see FR-18).

#### FR-13: Check-In auto-expiry
A Check-In automatically expires 2 hours after the stated ETA. Expired Check-Ins are removed from all Crew members' views.

**Consequences (testable):**
- Check-In is no longer visible to any user 2 hours after ETA.
- Expiry requires no user action.
- Expired Check-Ins do not generate notifications.

---

### 4.4 Social Graph

**Description:** The Crew is built through Invite Links. No discovery, no search, no follow requests — just a link forwarded through existing channels (text, DM, group chat). Friendship is mutual and immediate: both parties see each other's Check-Ins and Break additions from the moment of connection. Breaks are visible across the whole friend network — no per-Break access control. Realizes UJ-4.

**Functional Requirements:**

#### FR-14: Invite Link generation
User can generate a shareable Invite Link from within the app. The link can be copied and forwarded through any channel.

**Consequences (testable):**
- Invite Link is unique per user (not per invite action). [ASSUMPTION: single persistent invite link per user, not one-time-use links.]
- Link opens the onboarding flow for new users and the connection confirmation for existing users.

#### FR-15: Onboarding via Invite Link
A new user who taps an Invite Link creates an account by entering a display name only. No email or password required. [ASSUMPTION: no account recovery path in V1 — if access is lost, user re-onboards via a new Invite Link from a Crew member.]

**Consequences (testable):**
- Account creation requires only a display name.
- On account creation, the inviting user and the new user are immediately connected as Crew.
- New user can access the full app immediately after naming.

#### FR-16: Mutual opt-in friendship
Crew connection is mutual and automatic upon Invite Link onboarding. Both parties automatically see each other's Check-Ins, Break additions, and receive each other's check-in notifications from that moment.

**Consequences (testable):**
- No additional confirmation step required after invite link onboarding.
- Both users see each other's content immediately.

#### FR-17: Remove a Crew member
User can remove a Crew member from their Crew. Removal is one-directional — the removed user loses visibility of the remover's Check-Ins and vice versa. [ASSUMPTION: mutual removal — removing someone severs both directions of visibility.]

**Consequences (testable):**
- Removed user no longer appears in Crew member's friend list.
- Removed user no longer sees the remover's Check-Ins or Break additions.

---

### 4.5 Notifications

**Description:** Three notification types anchor the product's daily rhythm: the night-before nudge coordinates plans before bed; the dawn patrol push delivers the go/no-go signal without requiring the app to be opened; friend check-in notifications close the coordination loop in real time. All are push notifications delivered via PWA push. [NOTE FOR PM]: iOS PWA push requires iOS 16.4+ and the app must be installed to the home screen — this is a known platform constraint, not a bug. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-18: Friend check-in notification
A push notification fires to all Crew members when a user creates or edits a Check-In.

**Consequences (testable):**
- Notification fires within 30 seconds of Check-In creation or edit.
- Notification text identifies who checked in, at which Break, and at what ETA.
- Notification fires on both create and edit (including removals).

#### FR-19: Night-before nudge
A push notification fires at approximately 9pm with a plain-language preview of next-day conditions at the user's Home Break.

**Consequences (testable):**
- Fires once per day at approximately 9pm local time. [ASSUMPTION: fixed time, not user-configurable in V1.]
- Content reflects forecast data for the following morning at the user's Home Break.
- Notification identifies the Home Break by name.

#### FR-20: Dawn patrol push
A push notification fires between 5:00–5:30am with one line of current conditions at the user's Home Break.

**Consequences (testable):**
- Fires once per day in the 5:00–5:30am window. [ASSUMPTION: fixed window, not user-configurable in V1.]
- Content is current conditions (not forecast) at the Home Break at time of send.
- Single line — readable from the lock screen without opening the app.

#### FR-21: Notification preferences
User can enable or disable each notification type independently.

**Consequences (testable):**
- Disabling a notification type stops future sends of that type only.
- Preference is persistent across sessions.

---

### 4.6 Accounts and Auth

**Description:** Accounts are lightweight by design — a display name is the only required field. There is no standalone sign-up flow; the only entry point is an Invite Link from a Crew member. This reflects the trust-based distribution model: if you're in Kooks, someone you know put you there. Realizes UJ-4.

**Functional Requirements:**

#### FR-22: Account creation via Invite Link only
There is no standalone registration page. Account creation is gated by an Invite Link.

**Consequences (testable):**
- Navigating to the app root without an invite link does not present a sign-up form.
- Account creation form is accessible only from a valid Invite Link URL.

#### FR-23: Display name only
Account creation requires only a display name. No email, phone number, or password.

**Consequences (testable):**
- User can create an account and access the full app with a display name only.
- No verification step (email, SMS) is required.

---

## 5. Scope

### 5.1 In Scope

- Break-centric layout: one Break screen per saved Break, swipe to navigate
- Home Break: user-designated primary Break governing dawn patrol and night-before nudge
- Break creation: drop a pin, assign a label; visible to whole Crew immediately
- Conditions Verdict: LLM-generated (GPT-5.4 nano), 10-word ceiling, surfer-dude voice, cached per SwellCloud update (4x daily)
- Raw Data: tap-to-reveal (swell height, period, wave direction, wind speed, wind direction)
- Webcam links: curated per Break via `.env`, opens in external browser
- Check-In: Break selection + ETA; editable; removable; auto-expires 2h after ETA
- Friend presence: real-time display of Crew Check-Ins on each Break screen
- Social graph: Invite Link onboarding; mutual opt-in friendship; display-name-only accounts
- Push notifications: friend check-in, night-before nudge (~9pm at Home Break), dawn patrol (5:00–5:30am at Home Break)
- Notification preferences: enable/disable per type
- PWA: iOS-first, installs to home screen from Safari (iOS 16.4+)

### 5.2 Out of Scope

- **AI webcam analysis** (V2+) [NOTE FOR PM]: emotionally load-bearing — revisit if timeline permits
- **Geolocation-based "Arrived" status** (V2+) — auto-detect arrival at Break; V1 uses ETA only
- **GPS-based Break deduplication** (V2+) — 250m radius threshold logged; V1 uses social convention
- **Tide data** (V2+) — SwellCloud does not provide tide; NOAA CO-OPS flagged as V2 candidate
- **Session window / best-time-of-day forecast** (V2+)
- **"Best Break now" recommendations** (V2+) — no cross-Break comparison or ranking
- **Surf history or session logging** (V2+)
- **Account recovery** (V2+) — lost access requires re-onboarding via Invite Link
- **Multiple / user-configurable webcam links** (V2+) — V1 links are curator-supplied via `.env`
- **Webcam feed embedding** — webcams open in external browser only
- **App Store distribution** (V2+) — PWA only in V1
- **Android-optimized experience** (V2+) — PWA works on Android but is not a V1 target
- **Invite link expiry or revocation** — single persistent link per user; acceptable at 2–3 person crew scale
- **Monetization** — not planned
- **Broader user acquisition** — growth is invite-only; no marketing or SEO

---

## 6. Success Metrics

**Primary**
- **SM-1:** Primary user opens Kooks on surf mornings instead of her current surf app + text thread — target: at least 4 mornings/week for 3 consecutive weeks post-launch. Validates FR-5, FR-10.
- **SM-2:** Primary user checks in at a Break regularly — target: at least 3 Check-Ins/week for 3 consecutive weeks. Validates FR-10, FR-11.

**Secondary**
- **SM-3:** At least one Crew member connects and creates a Check-In within 2 weeks of launch. Validates FR-14, FR-15, FR-16.

**Counter-metrics (do not optimize)**
- **SM-C1:** Do not optimize for daily opens or session length. Kooks is a morning decision tool — 60 seconds of value is a success. A longer session is not a better session.

---

## 7. Non-Functional Requirements

### Performance
- Conditions data no older than 30 minutes during active use (FR-7).
- Check-In and Break creation changes visible to all Crew within 5 seconds (FR-1, FR-10).
- Friend check-in notification delivered within 30 seconds of action (FR-18).

### Platform
- PWA; installs to home screen via Safari on iOS 16.4+.
- Push notifications require home screen installation on iOS — this is a known platform constraint and must be communicated during onboarding.
- LLM API key and conditions API key stored in `.env`; never exposed to the client or bundled into client-side code.

### Privacy
- Friend presence data (Check-Ins, Break locations) is visible only to directly connected Crew members — not to the public, not to friends-of-friends. [ASSUMPTION: no friend-of-friend visibility in V1.]
- No location tracking beyond the coordinates of user-created Break pins. The app does not track user device location.

---

## 8. Aesthetic and Tone

**Voice:** The Conditions Verdict speaks like a surf-obsessed friend who always wants you in the water. Enthusiastic. Direct. Never technical. "Clean waist-high sets, offshore glass — get out there." The 10-word ceiling enforces discipline — if she has to read more than 10 words to know what she's walking into, the design failed.

**Visual feel:** [ASSUMPTION: clean and minimal — the data and the presence layer are the content; chrome should disappear. No feed, no cards, no algorithmic noise. One Break at a time.]

**Anti-references:** Surfline (data-dense, instrument-grade), Instagram (social feed, algorithmic), Band (group-app clutter).

---

## 9. Information Architecture

- **Home:** Swipeable stack of Break screens. Each Break screen: Conditions Verdict (hero), Raw Data (tap to reveal), friend presence list (who's In and their ETA), Check-In CTA.
- **Add Break:** Map view with pin drop + label field.
- **Settings:** Manage Breaks (add/remove from swipe stack), Manage Crew (view connections, remove), Notification preferences, Invite Link (copy/share).
- **Onboarding:** Invite Link → display name entry → app home. No other entry point.

---

## 10. Decisions Log Summary

All six open questions resolved. Full rationale in `.decision-log.md`.

| # | Topic | Decision |
|---|---|---|
| OQ-1 | Conditions API | SwellCloud (`api.swellcloud.net`), coordinate-based, 4x daily |
| OQ-2 | LLM model | GPT-5.4 nano (OpenAI), called per SwellCloud update per Break, cached |
| OQ-3 | Webcam source | Manual curation via `.env`, keyed per Break |
| OQ-4 | Night-before nudge target | User's Home Break |
| OQ-5 | Dawn patrol target | User's Home Break |
| OQ-6 | Check-Out behavior | Concept dropped — Check-In is binary (present or removed) |

---

## 11. Assumptions Index

- **§2.3** — Friends share similar morning coordination friction (not yet validated)
- **§2.3** — Primary user is iOS; Android not a V1 target
- **§4.1 / FR-2** — No Break limit; manual swipe-stack ordering
- **§4.1 / FR-4a** — App prompts for Home Break during onboarding; nudges undefined until set
- **§4.2 / FR-8** — Raw data fallback acceptable when LLM call fails; no cached prior verdict shown
- **§4.3** — Check-In is binary (present or removed); no Out status
- **§4.4 / FR-14** — Single persistent Invite Link per user
- **§4.4 / FR-15** — No account recovery in V1; lost access = re-onboard via Invite Link
- **§4.4 / FR-17** — Crew removal is mutual; severs both directions of visibility
- **§4.5 / FR-19** — Night-before nudge fixed at ~9pm; not user-configurable
- **§4.5 / FR-20** — Dawn patrol fixed at 5:00–5:30am window; not user-configurable
- **§8 NFRs** — Friend presence visible to direct Crew only; no friend-of-friend visibility
- **§9 Aesthetic** — Clean and minimal; chrome disappears; no feed or algorithmic elements
