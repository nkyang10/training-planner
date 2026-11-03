---
id: workout-library/strides
title: "Strides (short fast runs)"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S8]
---

**Key takeaways**

1. Strides are the cheapest useful workout in the library: 4–10 × 15–30 s at ~mile-to-5K effort, walking
  recovery, attached to the end of an easy run. Cost: ~15 minutes. Recovery cost: near zero.
2. They are the **first intensity** for novices and returning runners, and the **last thing removed**
   from a taper or a cut week.
3. They do not count as a hard day, do not count toward high-intensity minutes in any meaningful sense,
   and must never be escalated into intervals by a review.
4. Technique-focused by design: "smooth and quick, not maximal and grimacing".

## Purpose

Neuromuscular sharpness, stride mechanics, cadence and economy; a way to keep a bit of speed in the
weeks where volume is being cut (taper, travel, cut-back). Also the safest intensity exposure for
personas whose limiting tissue is not yet ready for continuous hard running.

## Structure

```yaml
dose: "4–10 × 15–30 s, walk-back recovery (60–90 s)"
build: "first 5 s to accelerate, hold the middle, ease off — never a sprint from the hips"
surface: "flat, smooth, traffic-free, straight; grass or track preferred, road acceptable"
placement: "at the end of an easy run, 1–2 × /wk, never the day before a race > 10K in the last week"
hr_note: "HR barely reaches the zone — effort-based only, do not judge by HR"
```

## Dosing by goal

| Goal | Dose | Frequency | Notes |
|---|---|---|---|
| First 5K | 4 × 15 s | 1/wk from ~week 3 | the persona's only intensity |
| 5K / 10K | 6 × 20–30 s | 2/wk | on easy days, both sides of the key day |
| Half / marathon | 5–6 × 20 s | 1–2/wk | preserved through every phase |
| Finish-only | 4 × 20 s | 1/wk | optional but cheap and useful |
| Trail/ultra | 6 × 20 s on flat ground | 1–2/wk | never on technical terrain |
| Masters 40+ | 5–6 × 15–20 s | 2/wk | the highest value/lowest cost session for this persona |
| Time-poor 3-day | 4–6 × 20 s on the easy day | 2/wk | fits any slot |
| Post-layoff / postpartum (late steps) | 4 × 15 s on grass | 1/wk | the first intensity exposure |
| Race week | 3 × 15 s two days out, 2 × 15 s day before (optional) | — | sharpness without fatigue [PLAN-S5] |

`→ rule: heuristics/workout-dosage.yaml#strides_per_week` (range 1–3 exposures, 4–10 reps)

## Intensity prescription

- Target effort: "about mile/5K pace, held easily" — 7–8/10, form intact, breathing quick but not
  gasping. If the face grimaces, it is too fast.
- Duration in **seconds**, not metres: 15–30 s keeps it below the point where fatigue changes mechanics.
- Recovery: full walk-back (60–90 s). Half-rested strides are just shorter intervals with worse form.
- Cadence typically rises 5–10 spm above the easy-run value; the goal is quick, quiet steps, not
  longer ones.

## Common errors

- Turning them into all-out sprints, then reporting tight hamstrings — the classic stride injury comes
  from a cold, maximal, overstrided first repetition.
- Doing them uphill on a cambered road with traffic, then calling it "hill strides".
- Doing them when 2 days from a marathon in a way that becomes a time trial; the taper dose is shorter
  and fewer.
- Escalating them to "4 × 400 m" because they went well, which converts a zero-cost session into a hard
  day. A review must never do this silently.
- Skipping the easy-run finish to "save time" and losing the one session that never costs recovery.
- Judging them by pace on a hilly day. Effort is the metric.

## Contraindications / substitute

- Contraindicated only where the surface or the body is not ready: wet/icy ground, technical trail, a
  hamstring or calf that has recently "grabbed", or the first weeks post-layoff/post-surgery.
- Substitutes: hill sprints of 8–10 s (safer mechanic, walk-back recovery) → 4 × 10 s "smooth" → leg-swing
  drills and a few 10 s pick-ups walking-to-jogging → nothing (only when the surface is unsafe).
- In a cut week, keep the strides and cut the volume. In a taper, keep the strides to the last 48–72 h.
  [PLAN-S5]

## Progression ladder

1. 4 × 10–15 s at "brisk, not fast", after an easy run, on grass.
2. 4 × 20 s at ~5K effort.
3. 6 × 20 s, 2 × /wk.
4. 6–8 × 25–30 s, with the last 5 s of each held rather than fading.
5. 8–10 × 15 s with only 45 s recovery (sharpening version, race-block only).
6. Race-week taper version: 3 × 15 s two days out, then stop. Progression reverses in the taper: fewer
   and shorter, same effort.
