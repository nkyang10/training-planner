---
id: workout-library/tempo-cruise-intervals
title: "Tempo / cruise intervals (threshold)"
status: draft
confidence: medium
evidence: [review, meta-analysis, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S1, PLAN-S2, PLAN-S4, PLAN-S8]
---

**Key takeaways**

1. Threshold work is the highest-leverage 40 minutes in a runner's week for 5K–half performance, and the
  easiest session to over-prescribe — the moderate zone is the one the evidence says stays small.
  [PLAN-S4 grade B]
2. Cruise intervals (3–4 × 8 min with 1–2 min float) deliver the same adaptation target as a 30-min
  continuous tempo with a lower failure rate, and are the right introduction.
3. Cap: 20–30 min of actual threshold work per session, once per week for most personas, ~10% of weekly
  volume maximum. [PLAN-S8 grade C]
4. A tempo run done "by feel" drifts 10–15 s/km too fast within two repetitions. Prescribe bands and
  check the first split, not the last.

## Purpose

Raise the fractional utilisation of VO₂max / lactate-threshold power: the ability to hold a hard-but-
sustainable effort. It is the primary quality session for 10K–half marathon and a secondary one for the
marathon, where it substitutes for one MP day per week in Build.

## Structure

```yaml
continuous: "12–15 min warm-up → 20–30 min @ T → 10 min cool-down"
cruise: "12–15 min warm-up → 3–4 × 8 min @ T, 90 s float → 10 min cool-down"
broken_alternatives: ["3 × 1000 m @ T with 200 m jog", "10 min + 8 min + 6 min descending"]
placement: "Thursday, ≥ 72 h from any Z3 day; never the day before the long run"
duration_caps: {continuous_min: 30, cruise_total_min: 40, weekly_share_pct: 10}
```

## Dosing by goal

| Goal | Weekly threshold volume | Shape | Weeks |
|---|---|---|---|
| First 5K | none (strides only) | — | — |
| 5K | 15–20 min | 2 × 10 min or 3 × 6 min | Build + Specific |
| 10K | 20–25 min | 3 × 8 min cruise | 6–8 weeks |
| Half marathon | 25–30 min | 30 min continuous or 4 × 8 min | 6 weeks, 2/wk max at peak |
| Marathon | 20–30 min | cruise intervals, 1/wk in Build | Build phase, replaced by MP later |
| Finish-only | 15–20 min at "comfortably hard" effort | 2 × 10 min | optional, 1/wk |
| Trail/ultra | hills instead of flat tempo | 6 × 4 min uphill strong | year-round |
| Masters 40+ | 15–20 min | 3 × 6 min | once/wk, 72 h spacing |
| Time-poor 3-day | 20 min | 3 × 8 min in a 40-min slot | alternating weeks with intervals |

`→ rule: heuristics/workout-dosage.yaml#t_pace_week_pct` (range 5–12)

## Intensity prescription

- T-pace is the pace holdable for ~30–40 min of continuous work: **roughly half-marathon pace to
  half-marathon pace minus 10 s/km** for trained amateurs; a band of 8–12 s/km, not a point. [PLAN-S8
  grade C]
- Sensation: "comfortably hard"; sentences of 4–6 words; RPE 6–7/10. It should feel controlled on
  repetition 1 and require attention on repetition 4 — not fall apart.
- HR is a lagging indicator for this session; use it only as a ceiling sanity check.
- Heat/altitude: cap effort, widen the band, and log the drift. Never re-pace the plan from one hot
  session.

## Common errors

- The tempo drift: prescribed 4:40/km, run 4:25 by rep 3, finishing as a hard 25-minute effort that
  needs 3 days to recover from — the junk-mile pattern in quality clothing. [PLAN-S4]
- Two threshold sessions a week for a 3–4-day runner, which converts every other run into a recovery
  run and deletes the aerobic share. [PLAN-S1, PLAN-S2]
- Floats that are standing rest: 90 s of jogging is what makes rep 4 the same pace as rep 1.
- Treating a failed last repetition as a fitness problem rather than a fatigue or fuel problem; the
  correct response is to repeat the dose next week, not to test again.
- Doing threshold work while ill because "it's only tempo".
- Running tempo on the treadmill with an incline of 0 and a fan on and comparing the pace to outdoors.

## Contraindications / substitute

- Not for: novice personas, post-layoff and postpartum below step 5, anyone with uncontrolled blood
  pressure or cardiac symptoms (see `risk-and-safety/red-flags-for-escalation.md`, placeholder), or any
  week with a pain report that changes gait.
- Substitutes, descending in demand: 3 × 6 min cruise → 2 × 8 min "comfortably hard" → hill repeats
  (same stress family, lower coordination demand) → 20 min "surprisingly comfortable" run → none.
- If the user cannot hold the band from rep 1 to rep 3, the session was mis-dosed or mis-timed: shorten
  it and keep the pace. A short, correctly paced session beats a long, drifting one.

## Progression ladder

1. 3 × 6 min @ T, 90 s float, inside a 50-min run.
2. 4 × 8 min @ T, 90 s float.
3. 20 min continuous @ T.
4. 30 min continuous @ T (peak continuous dose) **or** 3 × 12 min with 60 s float.
5. Combos: 15 min @ T + 6 × 200 m at mile pace (threshold + neuromuscular, one hard day).
6. In Specific for marathoners: threshold day is progressively replaced by MP day, not added to it.
   [PLAN-S11 grade C]
