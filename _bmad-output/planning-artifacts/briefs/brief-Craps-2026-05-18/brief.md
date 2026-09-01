---
title: "Product Brief: Kooks"
status: final
created: 2026-05-18
updated: 2026-05-19
---

# Product Brief: Kooks

## Executive Summary

Kooks is a Progressive Web App for recreational surfers who go out with a regular crew. Built for a specific user — a morning surfer at Emerald Isle, NC — it solves a problem every existing surf app ignores: the real decision to paddle out is social, not meteorological. You go if your friend is going. Conditions confirm or veto. Kooks puts that truth at the center of the product: friend presence surfaces first, conditions second, raw data one tap away.

The interface is organized by break. Swipe between your saved breaks to see live conditions and who among your friends is heading there and when. Check yourself in from the same screen. The app is always live — conditions update every 15–30 minutes, friend status updates the moment someone changes their plans.

## The Problem

Checking surf conditions looks like this: open the surf app, stare at a wall of numbers — swell height, period, tide charts, wind direction — while the brain is not yet awake enough to parse any of it. Then open Instagram to kill time while the brain boots up. Thirty minutes later, still in bed.

Meanwhile, the actual decision — "is Sarah going?" — happens in a separate text thread. Or a Band app group. Or a Facebook message. The social coordination and the conditions check are two separate acts across two or more apps, with no connection between them. ETA? Another text. Changed plans? Another text.

Existing surf apps are weather instruments for data-literate surfers. They were not designed for the recreational surfer who mostly goes regardless, wants one clear signal, and needs to know if her people are in — and where, and when — before she loads the board.

## The Solution

Kooks is organized around breaks, not a feed. Each saved break has its own screen: a plain-language conditions verdict at the top in the voice of a surf-obsessed friend who always wants you in the water — "Clean waist-high sets, offshore glass — get out there" — with raw data one tap below for the data-curious. Swipe left or right to move between breaks.

Below the conditions verdict: a live view of which friends are heading to this break, and when they expect to arrive. She adds herself to a break with a tap — picks her expected arrival time. She can change her answer, her break, or her ETA at any time. All friends see the update immediately and get a push notification. No text required.

Friends connect via invite link — she texts it once, they tap it, create a name and account, and they're connected. Friendship is mutual opt-in: once connected, both parties automatically see each other's check-ins and receive each other's notifications. No per-check-in picker, no manual selection.

Two notifications anchor the day:
- **Night-before nudge** (~9pm): "Tomorrow at The Point is shaping up nicely" — so she can coordinate with friends before bed.
- **Dawn patrol push** (5:00–5:30am): one line, current conditions at her usual break, no app opening required.

The Bogue Inlet Pier webcam is one tap away from the break screen — surfacing automatically when conditions are notably good or gnarly.

## What Makes This Different

Every surf app treats conditions as the decision. Kooks treats the social signal as the decision and conditions as the confirmation. That is not a feature — it is a different product philosophy that reflects how recreational surfers actually decide to paddle out.

The break-centric layout makes this concrete: you don't open a dashboard, you open The Point. You see the conditions and you see who's going. Those two things live together because they belong together.

Conditions are always live — updated every 15–30 minutes, not a forecast snapshot. The plain-language verdict on each break screen holds to a ten-word ceiling: if she has to read more than ten words to know what she's walking into, the design failed. The raw data is still one tap below for the surfer who wants it.

Check-ins are time-bounded without requiring manual cleanup: they auto-expire two hours after the stated arrival time. No stale presence, no ghost check-ins from yesterday.

Distribution is trust-based: a PWA URL forwarded through the surf group chat. No App Store friction. No marketing. The product spreads the way surf plans spread — person to person.

## Who This Serves

**Primary: The recreational surfer with a regular crew.** Goes out multiple times a week with the same 2–3 people. Data-curious but not data-dependent. Goes unless conditions are genuinely dangerous. Needs one clear signal and to know where her people are headed before she loads the board. [ASSUMPTION: her surf friends share similar coordination friction — not yet validated beyond the primary user.]

**Secondary: Her surf friends.** The presence layer only has value when friends use it. V1 success depends on at least one or two friends adopting the app. Their barrier to entry is low — invite link, one tap, no App Store.

## Success Criteria

**V1 success:** Primary user opens Kooks when planning a surf instead of her current surf app and text threads. She marks herself in at a break regularly.

**Big success:** Two or more of her regular surf friends adopt it. She sees friend presence before she texts anyone.

**Not a goal for now:** Broader user acquisition, App Store listing, or monetization.

## Scope

**In for V1:**
- Break-centric layout: one screen per saved break, swipe to navigate
- Live conditions verdict per break: plain-language, hype-friend voice, updates every 15–30 minutes
- Tap-to-reveal raw data (swell, period, wind, tide)
- Hyper-local tide data per break
- Friend presence per break: who's going, expected arrival time
- Check-in from break screen: I'm in / I'm out, arrival time; fully editable; auto-expires 2 hours after stated ETA
- All friends automatically notified on check-in; mutual opt-in friendship model (no per-check-in picker)
- Push notifications: night-before nudge + dawn patrol alert + friend check-in
- Webcam shortcut (Bogue Inlet Pier cam; auto-surfaces on notably good/bad days)
- Saved breaks: user-defined, add/remove any break anywhere at any time
- Lightweight accounts via invite link
- PWA, iOS-first (installs to home screen from Safari)

**Explicitly out for V1:**
- AI webcam analysis (v2+)
- Geolocation-based "Arrived" status indicator (v2+): auto-detects when a friend reaches the break, upgrading presence from "planning to be there at 7am" to "actually there now"
- Session window / best-time-of-day forecast
- "Best break now" recommendations
- Surf history or logging
- App Store distribution

## Open Questions

**Break identity model:** Are breaks universal objects (pre-defined database, searchable), location-matched (GPS proximity deduplication), or invite-linked (creator shares a link; friends join that specific break object)? The invite-link model fits the existing friend model and avoids duplicates — but limits discoverability. Needs a decision before the PRD.

## Vision

If Kooks works for one surfer and her crew at one break, it works for every recreational surfer with a regular crew at any break. The product is hyperlocal by design and replicable by architecture — saved breaks, local webcams, local tide tables. A v2 could open break configuration and webcam linking to any user anywhere, with AI webcam analysis layering real-time visual reads on top of forecast data.

The longer arc: a social-first conditions layer that lives alongside — not instead of — existing surf apps. Not a weather instrument. Not a community platform. A presence tool for the surfer who surfs for the people, not the data.
