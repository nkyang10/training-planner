---
status: draft
last_reviewed: 2026-11-03
---

# Information architecture

One screen is the product. Everything else supports it.

```
                          ┌──────────────────────────┐
                          │      CALENDAR (home)     │  ← "what is today, and what did the
                          │  month · week · day      │    system say about yesterday?"
                          └────┬────────────┬────────┘
              tap a day cell   │            │  tap the review banner
                               ▼            ▼
                     ┌──────────────────┐  ┌──────────────────────┐
                     │   DAY DRAWER     │  │   REVIEW SCREEN      │
                     │ session · entry  │  │ verdict · options ·  │
                     │ comment thread   │  │ diff · cost · accept │
                     └──────────────────┘  └──────────────────────┘
        ▲                                   ▲
        │ quick-entry FAB (any screen)      │ "review my plan" (always available)
        │                                   │
   ┌────┴─────┐   ┌───────────┐   ┌─────────┴────┐   ┌──────────────┐
   │ PROGRESS │   │ WEEKLY    │   │ PLAN SETTING │   │ ACCOUNT      │
   │ trends   │   │ SUMMARY   │   │ goal,races,  │   │ devices, i18n│
   │ (display │   │ (the      │   │ availability,│   │ privacy,     │
   │  only)   │   │  review   │   │ plan style   │   │ export,      │
   └──────────┘   │  preview) │   └──────────────┘   │ delete       │
                  └───────────┘
   Onboarding (first run): profile → availability → goal → first plan → first entry demo
```

## Routes

| Route | Job | Notes |
|---|---|---|
| `/` → `/{yyyy}/{mm}` | calendar, month view | home; deep-linkable to any date |
| `/d/{yyyy-MM-dd}` | day drawer (opens as a drawer over the calendar; a real URL on mobile) | the product's centre of gravity |
| `/week` | 7-day list, best on phones for "what's this week" | dense, scannable |
| `/review/{id}` | review: verdict → options → diff → consent | also `/review/new?intent=…` |
| `/summary/{iso-week}` | weekly summary (the light-touch review preview) | shareable image export |
| `/progress` | trends: load, wellness, pace evidence, adherence | **display-only**: no control here mutates the plan |
| `/plan` | goal, priority race, availability, plan style, paces + how they were derived | changes here queue a regeneration or open a review |
| `/profile` | background, history, injuries, health flags, tests/races | the evidence store; most-ignored screen — designed to be filled in 3 minutes and updated 3 times a season |
| `/settings` | language, units, timezone, day start, notifications, integrations | |
| `/privacy` | what we store, export, delete | linked from the plan header, not buried |

## The day cell carries the whole argument

A cell must answer, without a tap: **what was planned** (kind + one line), **what happened**
(logged/partial/skipped/unlogged), **what the system said** (comment badge), **whether something is
wrong** (safety chip / review dot), and **why it changed** (adjustment chip). That is five facts, so
the cell is designed as a *stack of chips with one hero number*, not as text. Colour encodes session
intensity class only; every non-colour state has a glyph and a word (colour-blind safety, and
"hard day" must survive a phone on max brightness outdoors).

## Object model the UI must keep straight

| Object | Mutability | UI consequence |
|---|---|---|
| `PlanVersion` | immutable | "this is the plan you followed in October" is always viewable |
| `SessionOccurrence` | derived (base + overrides) | shows effective session + "was: …" on demand |
| `DayEntry` | append-only revisions | correction history visible |
| `SystemComment` | immutable | never edited in place; a new comment can supersede with a reason |
| `Review` | stateful (`open` → `accepted` / `rejected` / `deferred` / `expired` / `superseded` → checkpointed) | a decision is never lost; a rejected review stays visible |

## Two navigation rules

1. **Nothing that changes the plan lives on `/progress`.** Reading a chart must never be one swipe
   away from mutating a season. Chart → "ask for a review" is the only bridge, and it opens the
   review screen with the chart as the stated reason.
2. **The daily loop is reachable in one tap from cold start.** App opens on today. If the entry is
   missing, today's cell shows the entry affordance, not the plan — because the entry is the thing
   we are asking for, and the plan is what we are giving.

## Empty and degraded states are designed states

| State | What the user sees |
|---|---|
| No device connected | "Log by typing or just tap: did you run?" — never a greyed-out metric wall |
| Device connected, no activity | "No run found. If you ran, tap to add it." (never "no data") |
| Not logged for 3 days | neutral gap marker + one nudge, no streak shaming, entry still one tap for each past day |
| Safety stop active | calendar shows rest with the reason; hard sessions visibly cancelled, not hidden |
| Plan infeasible | the two-goal-options card from [planner-engine §8](../engine/planner-engine.md) |
| LLM unavailable | comments still appear (template path) — the user must never see "AI is down" |
