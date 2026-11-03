---
id: workout-library/progression-long-run
title: "Progression long run"
status: draft
confidence: medium
evidence: [practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S8, PLAN-S10, PLAN-S11]
---

**Key takeaways**

1. A long run whose intensity rises across the session: it teaches the body to run faster on tired legs
  and rehearses the exact failure mode of the back half of a marathon.
2. The progression is in **time and shape**, not in how much faster the last section goes. A 15-min
  marathon-pace finish is a full dose; a 45-min one is a different, costlier session.
3. It is the highest-value Specific-phase session for marathoners and the easiest one to over-dose.
4. The plan must be able to answer "why is this here?" in one sentence: durability plus race-pace
  rehearsal under fatigue.

## Purpose

Rehearse late-race mechanics at goal pace when glycogen is partly depleted, train pacing discipline
(holding pace when it no longer feels free), and add race-pace load without a separate long quality day.
The core session of Pfitzinger-style marathon blocks. [PLAN-S11 grade C]

## Structure

```yaml
total: 100–150 min
shape: "60–75 min easy → 20–45 min @ MP → 10 min easy float"
legal_variants:
  - {name: "finisher",       body: "last 20–30 min @ MP"}
  - {name: "sandwich",       body: "30–45 min @ MP in the middle, easy either side"}
  - {name: "staggered",      body: "3 × 12 min @ MP with 4 min easy between"}   # lower risk, same target
placement: "Saturday in Specific; never the day after a Z3 session"
recovery_after: "easy or rest the next day; the day before must be easy"
```

## Dosing by goal

| Goal | Peak MP block inside the long run | Weeks it appears | Notes |
|---|---|---|---|
| 10K | none needed | — | use the plain long run |
| Half marathon | 15–25 min @ half pace | 4 Specific weeks | half pace, not MP |
| Marathon (sub-3:30) | 30–45 min @ MP | 4–6 weeks | total MP km ≤ 25% of weekly km [PLAN-S8 grade C] |
| Marathon (4:00+) | 20–30 min @ MP or 3 × 12 min staggered | 3–4 weeks | time-capped, not distance-capped |
| Finish-only | 2 × 15 min at race **effort** | 3 exposures | rehearsal, not training |
| Trail/ultra | none, or 15 min on gentle gradient | rare | effort-anchored; vertical is the stressor |
| Masters 40+ | 15–20 min @ MP | 2–3 weeks only | +48 h recovery either side |

`→ rule: heuristics/workout-dosage.yaml#mp_week_pct` (range 10–25), `#mp_continuous_min` (cap 100 min,
≤ 20 km continuous).

## Intensity prescription

- MP is an **effort-matched** pace: "conversational in short phrases, slightly uncomfortable after
  30 min". If it can be held in full sentences, the pace is too easy; if the user is gasping at km 14,
  too fast.
- Bands, not paces: 5:18–5:28/km, never "5:22 exactly". The band width comes from the evidence age and
  extrapolation distance (`plan-construction/measurement-and-testing.md`).
- The easy opening section is not negotiable and is not "wasted" time; it is what makes the MP block
  possible.
- Weather adjustment is mandatory above ~18 °C: MP becomes effort-capped, and the plan should say
  "hold the effort, ignore the pace" in that session.

## Common errors

- Progressing the progression: 20 → 30 → 40 → 55 min of MP while weekly volume also grows. Two variables
  in one week. [PLAN-S7]
- Running the "easy" first hour at MP-minus-20-seconds, making it a 2.5-hour threshold session.
- Doing it two days after intervals, then reporting "heavy legs" as a mystery.
- Scheduling it in week 15 of a 16-week block — the recovery cost lands on race day. Last one belongs
  10–14 days out. [see `plan-construction/taper-and-peak.md`]
- Treating a failed MP block as a fitness verdict: a failed block after three hard weeks is fatigue, not
  capacity. The correct response is to hold volume, not to re-test.
- Adding it on top of a Hansons-style quality-heavy week — the families do not mix; pick one per block.
  [PLAN-S10 vs PLAN-S8/PLAN-S11]

## Contraindications / substitute

- Not for: novices, first-5K/10K personas, post-layoff, postpartum, or any persona with a pain report in
  the last 7 days. Substitute a plain long run, or the same session with 3 × 8 min at race effort.
- If MP was missed due to heat, hills or crowds: do not repeat it later in the same week; that stacks a
  second quality day on a long day.
- Substitute ladder when the dose is too big: 45 min MP → 3 × 12 min MP → 2 × 10 min MP → plain long run
  with 10 min "quicker" finish → plain long run.

## Progression ladder

1. Plain long run, time grown to the persona's peak.
2. Add 10 min "quicker but not MP" finish (an introduction to running fast on tired legs).
3. `finisher` 20 min @ MP.
4. `finisher` 30 min @ MP **or** `staggered` 3 × 12 min @ MP.
5. `sandwich` 40–45 min @ MP — the peak dose; hold it for 2 weeks max, then begin the taper.
6. Taper walk-back: shrink the MP block first (45 → 25 → 15 min), keep the total duration longer than
   the intensity would suggest, and finish the last one ≤ 10 days out. [PLAN-S5]
