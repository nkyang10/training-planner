---
id: workout-library/cross-training
title: "Cross-training (bike, swim, elliptical, row, aqua-jog)"
status: draft
confidence: low
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S7, PLAN-S12]
---

**Key takeaways**

1. Cross-training earns its place in three situations only: **injury or return-to-run periods**,
  **time-limited weeks**, and **ultra/long-event volume** where running hours are simply unavailable.
2. It is not interchangeable with running. Aerobic carry-over is partial; musculoskeletal carry-over is
  near zero, which is exactly what "durability" means in a running plan.
3. Combining high-volume running with high-volume strength or another sport is where the evidence for
  interference (mostly from concurrent-training literature in non-runners) is weakest for our
  population. Treat every interference claim as **grade C, contested**, and never as a reason to delete
  a session by default.
4. In the one verified comparison of trained endurance athletes, weekly training **time** differs
  hugely by event (marathon 5.2 ± 0.9 h/wk vs Ironman 12.9 ± 2.6 h/wk). Where an ultra-style event is
  the goal, non-running hours are not cheating — they are the sport. [PLAN-S12 grade B]

## Purpose

Maintain or build aerobic volume at lower impact cost; keep training going while running is limited;
add a quality stimulus (e.g. a threshold bike) without adding impact; support long-event preparation
where the required hours exceed what running can absorb.

## Structure

```yaml
modalities: [bike, indoor-trainer, swim, aqua-jog, elliptical, rowing, deep-water-running]
easy_ct:      "30–60 min Z1–Z2 by effort; talk test, not running pace"
quality_ct:   "bike version of the plan's quality session: e.g. 4 × 8 min threshold, 2 min easy"
long_ct:      "90–180 min bike for ultra personas; time on the bike, not distance"
hr_caution:   "HR zones measured on a bike are NOT running zones; keep two separate channel sets"
power_caution:"cycling power and running pace are unrelated metrics; log both as effort-anchored"
```

## Dosing by goal

| Situation | Role | Dose | Counts as |
|---|---|---|---|
| Novice / first 5K | discouraged | 0–1 × 20–30 min | attendance only; running days are the scarce resource |
| 10K / half goal | optional | 1 × 30–45 min easy | a substitute for a recovery run, never for a key day |
| Marathon | optional in Base | 1 × 45–60 min easy | an easy day; a long bike can replace one long run at most |
| Ultra / trail | normal | 1–3 × 60–180 min | real endurance volume [PLAN-S12] |
| Injury / return-to-run | central | as the clinician allows | **not** progress toward running load; see the impact ladder in `personas/returning-after-layoff-or-injury.md` |
| Postpartum (steps 1–3) | bridge | walking/bike as cleared | does not advance the impact ladder |
| Time-poor | tactical | one quality bike when the slot is a bike | may substitute a key day if effort is matched |
| Strength training | separate file | see `workout-library/strength-for-runners.md` | never replaces a run |

## Intensity prescription

- Anchor intensity to **effort matched to the running session it replaces**: "3 × 8 min at threshold
  effort, cadence high, breathing hard but controlled".
- Use the modality's own HR zone set if the user has one; otherwise effort only. Cross-modality HR
  comparisons are a common source of false conclusions ("my bike HR is lower, so it was easy").
- Load accounting: cross-training is recorded as **minutes at effort**, contributing to the weekly
  *time* budget but **not** to running impact load, and never to the long-run durability marker.
- Substitution honesty rule: a substituted session is labelled as a substitution in the plan's reason
  string, so a later review can see the difference between "did the plan" and "did something similar".

## Common errors

- Counting 3 h of cycling as equivalent to 3 h of running and then being surprised by late-race cramping
  or a sore tibia. [durability ≠ aerobic fitness]
- Using cross-training as a socially acceptable way to keep training through a pain that changes gait —
  the classic route from a niggle to a stress injury. [PLAN-S7 training-error pattern]
- Adding cross-training **on top of** the running plan rather than in place of a session, so weekly load
  rises invisibly.
- Two "easy" spin sessions that are actually 70% efforts, breaking the intensity distribution. [PLAN-S1]
- Rowing or HIIT classes that quietly become a third hard day for a 4-day runner.
- Judging running fitness by bike or pool performance in either direction.

## Contraindications / substitute

- Cross-training is not a licence to train through a diagnosis-worthy problem: chest pain, faintness,
  a swollen painful limb, or any symptom the user would describe as new and sharp → stop and refer
  (`risk-and-safety/red-flags-for-escalation.md`, placeholder file).
- Modality selection: a knee that tolerates cycling but not impact → bike; a bone stress concern →
  avoid cycling with high cadence if it reproduces pain, use aqua-jog or deep-water running; a swimmer's
  shoulder → avoid high-volume freestyle.
- If no modality is available, the substitute is a **brisk walk** (genuinely useful for novice,
  postpartum and return-to-run personas) or a rest day, and the plan says which.

## Progression ladder

1. One easy session replacing one easy run — the default, and often the end of the ladder.
2. One quality session replaced (bike version of the plan's threshold or interval day) when the running
   slot was lost — same stress family, matched effort.
3. One long run replaced by a long bike, in Base phase only, for ultra personas.
4. Planned concurrent block for ultra/triathlon-style goals, where total weekly **hours** (5–13 h/wk
   depending on event) are the programming variable. [PLAN-S12]
5. Never: replacing a key run with cross-training while adding the freed time as extra running. If the
   plan wants more load, it uses `plan-construction/mileage-and-progression.md` rules and says so.
