---
status: draft
last_reviewed: 2026-11-03
---

# Key screens

Annotated specs for the four surfaces that decide whether the product works. Microcopy and tone:
[feedback-microcopy.md](feedback-microcopy.md). Message keys in `en` / `zh-Hant`.

---

## 1. Calendar (home)

**Month grid**, one cell per day. Cell contents, in priority order:

```
┌ 14  六 ───────────────┐   1  date number  ·  weekday label (locale)
│ ● Long 18 km          │   2  session kind + hero number (distance or the key set)
│   ⌁ easy 40′ · ⚠ 6/10 │   3  secondary: tomorrow-relevant chips
│ ✓ 🔵 ⚡               │   4  state glyphs: logged ✓ · comment 🔵 · review ⚡ · safety ⛔
│ because: legs 4/5     │   5  adjustment reason chip (only when the day was changed)
└───────────────────────┘
```

- **Week strip header**: planned km, planned hard sessions, logged %, and a small phase label
  (`Build · wk 3/5`). The phase label is how a runner learns the plan's shape without reading docs.
- **Day-type colour** = intensity class only (`rest`, `easy`, `moderate`, `hard`, `long`, `race`),
  with a word/glyph always — never colour alone.
- **Gaps read as invitations**: an unlogged past day shows a faint `+` that opens the entry form
  pre-filled with that date. No red, no broken-streak alarm.
- **Future cells beyond the content horizon** show only the session kind (`Tempo`) with a `~` mark:
  honest coarseness beats fake detail ([planner-engine §5](../engine/planner-engine.md)).
- **Pull-down / "today" button** jumps to today; keyboard `←/→` move a day, `e` opens entry, `r`
  opens review. The calendar is genuinely usable from a keyboard on desktop.
- **Review banner** sits above the grid when a review is `suggested` or `open`, with severity colour
  and one sentence. `critical` renders as a modal on first open, then as a persistent banner.

### Mobile adaptations
Month grid → swipeable week strip + a vertical "today card" (session, entry CTA, latest comment).
The FAB is the entry form. The month grid becomes an overview, not the interaction surface.

---

## 2. Day drawer (the centre of the product)

Three stacked sections, always in the same order so the runner builds a habit of reading top-down.

```
┌─ 14 Nov (Sat) · Week 3 of Build ──────────────────────── ✕ ─┐
│  LONG RUN · 18 km easy, last 4 km at MP                    │  ← WHAT
│  Purpose: aerobic durability at race effort                │
│  Targets: pace 5:45–6:10/km · HR ≤ 150 · RPE 4  (RPE wins) │
│  If today goes wrong → 12 km easy [choose alternate]       │
│  Why this session →                                        │
├───────────────────────────────────────────────────────────┤
│  HOW DID IT GO?                              (30 s)        │  ← EVIDENCE
│  [✓ Done] [~ Partial] [✕ Skipped] [Rest as planned] [Alt]  │
│  Effort   1 2 3 4 5 6 7 8 9 10            → 6              │
│  Legs     feathered · normal · heavy · very · wrecked  → 3 │
│  ⌄ Sleep 6.5 · RHR 48 · Stress 2 · Mood 4                  │
│  ⌕ Pain (tap a map or type)  → Knee (R): 4/10, worse       │
│  Note: 28′ of wind on the way back…                        │
│                                        [Save] (saved ✓ loc│
├───────────────────────────────────────────────────────────┤
│  FROM THE PLAN                          (the loop closes)  │  ← MEANING
│  🗨 18 km with 4 at MP and legs at 3/10 — the MP section    │
│     held, which is the point of this block. Thu is easy    │
│     40′, and I'll keep it that way even if you feel great. │
│     [👍 useful] [👎 not useful]                             │
│  ⚡ Review suggested · 3 red days in a row → view          │
│  ── Tomorrow: Easy 40′ (was: Tempo) — because legs 3/5 +   │
│     6.5 h sleep.  [Undo]                                   │
└───────────────────────────────────────────────────────────┘
```

Interaction rules:
- **Save before interpret.** The comment area shows a skeleton for < 2 s; if the worker is behind,
  the comment appears when it lands and the drawer does not block. The entry is already saved — a
  runner must never lose an entry waiting on a model.
- **Progressive disclosure**: tier-2 wellness is collapsed and remembers the previous value (one tap
  to accept yesterday's), pain opens on demand; the *minimum* viable save is status + effort + legs.
- **`Skipped` opens a one-tap "why"** row (illness · travel · work · family · sleep · motivation ·
  pain · weather · just didn't) — this is the highest-value, lowest-cost field in the whole product,
  because intent drives the decision more than the miss.
- **"Why this session →"** opens the explanation sheet: rule ids, phase purpose, the knowledge file
  in plain language, and the evidence the plan used. No jargon wall; a "tell me more" per item.
- **Undo** on any adjustment chip, with the reversal recorded as calibration.

---

## 3. Entry-first quick log

Cold start → today card → "Log today" → 3 taps → done. No screen changes, no modal stack, works
offline, and the confirmation *is* the comment (or its skeleton). Time-to-value target: **under 30
seconds from app open to saved**, measurable in a Playwright test with a tap counter.

---

## 4. Review screen (consent, not notification)

```
┌─ Review your plan ────────────────────────────────── 2026-11-14 ─┐
│ VERDICT: The build block is too fast for your current recovery.  │
│ Why: CTL +18% over 3 weeks · HRV 7-day mean 12% below baseline   │
│      (3 consecutive readings) · legs ≥4 on 4 of the last 7 days  │
│      · effort-vs-prescription gap +1.6 on quality sessions.      │
│      Confidence: medium — no HR data on 2 of 4 sessions.         │
│                                                                  │
│ OPTIONS  (≤ 2 changes)                                           │
│  A  Keep the plan, note the risk   cost: none · risk: continued  │
│     deviation → possible illness before the tune-up race         │
│  B  Cut volume 15% for 2 weeks, keep one short MP session        │
│     cost: ~−6 km/wk, one fewer key session · gain: recovery      │
│     margin before 2026-12-06 (recommended by your recent data)   │
│  C  Restart the build block from week 1 loads                    │
│     cost: ~3 weeks of fitness timing · gain: clearest reset      │
│                                                                  │
│ DIFF (B) — from 2026-11-16                                       │
│  − 12 km → 10 km (Long)      − Tue cruise intervals → strides    │
│  weekly km 62 → 55 · key sessions 3 → 2 · phase end unchanged    │
│                                                                  │
│ [Choose B] [Choose C] [Keep A] [Not now — ask me 2026-11-18]     │
│ Decline with a reason ↓   Everything before 2026-11-14 unchanged.│
└──────────────────────────────────────────────────────────────────┘
```

Non-negotiables on this screen: the **verdict is one sentence**, the **why lists the actual
evidence with its confidence**, **an option always exists to change nothing**, **the cost of every
option is explicit**, **the past is stated as untouched**, and **declining is a first-class answer**
that invites a reason (which the system uses to recalibrate its triggers).

For `critical` safety reviews the option list contains only reductions plus a clinician-referral
path — no "keep going" button at all ([safety-layer.md §1](../engine/safety-layer.md)).

---

## 5. Weekly summary (the light-touch review)

Sent/shown on the runner's chosen day: last week (what happened, adherence, what we changed and
how it went), this week (the shape, not every session), one thing to watch, and **"this is a good
time to ask for a review"** CTA. It also reports *what we did not change* and why — the quiet
counterweight to an adaptive app feeling twitchy. Exportable as a shareable image (a real retention
channel) with a privacy check on what the image contains (no route maps by default).

---

## 6. Onboarding (≤ 5 minutes to a plan)

Three steps, skippable, each with an "I don't know" that produces a safe default and schedules a
later question:

1. **Who you are now** — years running, recent weekly km, longest recent long run, runs per week,
   recent races (optional), aches and injuries, health flags.
2. **When you can train** — day-of-week availability picker with time budgets, long-run day, hard
   days allowed, known travel dates. This screen is where most plan quality comes from; it is
   designed to be *edited later* and re-asked quarterly.
3. **What you want** — race/distance/date, or "no race, just get fitter"; goal type (finish /
   time / experience); plan style (structured ↔ flexible) and risk appetite.

Then: **the first plan renders immediately** with its assumptions listed ("I assumed you can do 3
runs and a long Saturday; you have a 10K in 9 weeks; paces are estimated from your 5K in August —
confidence medium, so week 1 includes a easy test to check them"). Day 1 ends with a demo of the
entry form, because the entry habit is the thing that must start tonight.
