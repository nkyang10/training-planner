---
id: feedback-and-autoregulation/interpretation-windows
title: How long before a signal means anything — windows, patience, and the noise floor
status: draft
confidence: high
evidence: [review, cohort, practitioner]
applies_to: [all]
last_reviewed: 2026-11-03
owner: fb-agent
supersedes: []
sources: [FB-S1, FB-S4, FB-S5]
---

## Key takeaways

- **Every signal has a minimum observation window below which it is noise.** Reacting earlier is not
  fast, it is random — and random interventions are what make runners distrust data.
- Subjective fields are **same-day actionable**; endurance-derived metrics are **7–28 day** signals;
  performance beliefs need **weeks to a season**.
- The system's most valuable safety behaviour is *patience with a stated reason*: "three easy days of
  heavy legs — I am watching, not reacting yet" teaches the runner how to read themselves.
- One bad day is an anecdote; **three consecutive readings** is a trend; the day after that is a
  decision. That 3-day rule is the backbone of every micro-adjustment in this product.
- Nothing that changes the plan tomorrow may be driven by a single reading, with exactly two
  exceptions: pain-based stops and illness stops. Both subtract, never add.

## Facts — the windows

| Signal | Noise floor | First meaningful reading | Can drive `micro` from | Can drive `review` from | Why |
|---|---|---|---|---|---|
| `legs` ≥ 4 | 1 day | same day | **next day** (swap to easy/alternate) | 3 consecutive | direct subjective report; reversible action |
| `rpe` vs prescribed band | 1 session | same day | 2–3 sessions of a *consistent* gap | 5 sessions | single-session RPE is noisy; a gap that repeats is a zone error |
| `pain` trajectory | **0 days** | same day | **immediately** (constrain) | immediately (escalate) | safety is not a slow signal |
| Illness (below-neck/fever) | 0 days | same day | immediately (hard stop) | immediately | [FB-S1] — continuing is the known harm |
| Sleep hours | 1 night | 3 nights | 3 nights < personal baseline | 2 weeks chronic | one short night does not change fitness; a pattern does |
| Resting HR deviation | ~3–5 bpm | 3 mornings | 3 consecutive above band | 7 consecutive | day-to-day SD is large; illness/life-stress confounds |
| HRV (lnRMSSD) deviation | ±0.5 ln units typical | 7 days of valid readings | 3 consecutive below band **and** ≥2 supporting items | 7–10 days | requires ≥3 weeks of baseline; sufficiency gates first |
| Session completion rate | 1 week | rolling 2–4 wk | no (display only) | 2 consecutive weeks < 60% | plan-fit problem, not a day problem |
| Weekly load / ramp | 1 week | next week | no | ramp > ceiling, or monotony > band | structural, reviewed weekly by design |
| Load monotony | 7 days | 7 days | no | 2 consecutive weeks high | monotony needs a full week to compute honestly |
| `pace_at_hr` on easy runs | 2 weeks | 14 days | no | 4 weeks of drift | needs matched conditions (flat, cool, easy effort) |
| HR decoupling / drift | 1 session (≥40 min, steady) | that session | no | 3 sessions in a block | only valid on steady-state work |
| CTL / TSB | 2–6 weeks | 3 weeks | no | review narrative context only | an EMA over 42 days cannot be a daily trigger |
| Race-time belief | 8+ weeks | tune-up race | no | review, and only with a race or test as evidence | the slowest thing we touch |

→ rule: `heuristics/daily-feedback-rules.yaml#consecutive-reading-rule`
→ rule: `heuristics/load-progression.yaml#review-latency`

## Facts — why patience is a safety feature

Overtraining research is blunt about two things: there is **no accepted marker** that confirms it, and
the treatment is **rest or reduced training** ([FB-S1], [FB-S5]). A system that reacts to one bad
session with a bigger session is the mechanism by which runners get hurt; a system that reacts to three
bad sessions with *less* is aligned with the only treatment that exists.

The same asymmetry explains why safety signals get a zero-day window and everything else gets a
window in weeks: **subtracting is cheap and reversible, adding is expensive and slow to undo.**

## Practice — how windows are surfaced

- Say the window out loud. "Two more easy days at this effort and I'll know whether your zones are
  right" converts waiting into a plan.
- Track and display *how many readings we have*: "2 of 3 mornings above your usual resting HR".
- **Never** render a metric whose window is incomplete as a number without the qualifier. Partial
  windows render as "gathering — 4 of 7 days".
- A review may not cite a signal that has not reached its `review` column, and the review validator
  enforces it (not the narrator's discretion).
- The 3-day rule needs a reset rule: a *new* confounder (travel, illness, work week) restarts the
  count for fatigue-type signals but **not** for pain, because pain is about tissue, not context.

## Controversies

- **HRV-guided training.** Field studies of HRV-guided periodisation report equal-or-better outcomes
  versus pre-set plans, but with small samples, varied protocols, and heavy researcher supervision. We
  use HRV as *one of several* inputs with a hard sufficiency gate and never alone; a runner with 9 days
  of data gets no HRV verdict at all.
- **How many days of baseline are honest.** 7 days is our display floor, 21 the trust floor. Shorter
  floors look better in onboarding and produce worse advice. Deliberate choice, revisit with our own
  cohort data.
- **Should the runner see the window before they can see the metric?** Hiding slow metrics for three
  weeks depresses early engagement; showing them creates false confidence. Our compromise: show the
  *gathering* state with a day counter, never a value.
