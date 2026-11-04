---
id: plan-construction/key-workout-dosage
title: "Key-workout dosage: how much of each quality, per session and per week"
status: draft
confidence: medium
evidence: [review, meta-analysis, practitioner]
applies_to: [plan-generator, workout-picker, safety-layer]
last_reviewed: 2026-11-04
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S4, PLAN-S8]
---

**Key takeaways**

1. Every adaptation has a **minimum effective dose** and a **ceiling per week**. Below the dose, the
  session is decoration; above the ceiling it is debt.
2. Per-week quality caps by volume, expressed as fractions of weekly mileage, scale better than fixed
  km: intervals ≤ ~5%, threshold ≤ ~10%, marathon pace ≤ ~25%. [PLAN-S8 grade C dosing rules]
3. **Stacking** — two quality sessions that stress the same thing 24–48 h apart — is the most common
  structural defect in self-made plans and in naive generators.
4. Strides are the cheapest quality in the plan: near-zero fatigue, real neuromuscular benefit. Default
  twice weekly, and they are the last thing to cut when time is short.
5. When a week must shrink, cut **volume first, then one quality session, never the warm-up and never
  the last 20% of the long run**.

## Facts

- Distribution evidence constrains total high-intensity time: in the runner trial that favoured more
  low intensity, both arms ran ~8% of sessions at high intensity; what differed was the moderate
  band (11.8% vs 24.7%). So the *dose problem* in amateurs is mostly about the middle, not the top.
  [PLAN-S4 grade B]
- Polarized protocols outperform threshold-emphasised ones on time-trial performance (ES −0.66, 95% CI
  −1.17 to −0.15) in a meta-analysis of 3 low-to-moderate quality studies — a reason to cap threshold
  volume rather than to expand it. [PLAN-S2, and the polarized-vs-threshold meta in
  `periodization/intensity-distribution.md`]
- Textbook dosing rules (Daniels, 3rd ed.): I-pace (≈3–5 min reps) total ≤ ~5% of weekly mileage and
  ≤ ~1000 m per session; T-pace ≤ ~10% of weekly mileage; M-pace ≤ ~25% of weekly mileage. Grade C
  textbook rules, universally used, never randomised. Confidence: medium. [PLAN-S8]
- → rule: heuristics/workout-dosage.yaml#i_pace_week_pct (range 2–8)
- → rule: heuristics/workout-dosage.yaml#t_pace_week_pct (range 4–12)
- → rule: heuristics/workout-dosage.yaml#mp_week_pct (range 10–25)
- → rule: heuristics/workout-dosage.yaml#strides_per_week (range 1–4)

## Practice

### Minimum effective dose per adaptation

| Adaptation | Minimum useful dose | Ceiling | Notes |
|---|---|---|---|
| Aerobic volume | 3 Z1 sessions ≥ 30 min | persona ceiling | the only dose that changes tendon/bone tolerance |
| VO₂max | 1 session/wk, ≥ 8–12 min total at I-pace | 2 sessions/wk, ≤ ~1.5 km I-pace in a 40 km week | 2/wk adds little for recreational runners and doubles recovery cost |
| Lactate threshold | 1 session/wk, 20 min continuous **or** 3×8 min cruise | 2 sessions/wk, ≤ 10% weekly km at T | cruise intervals are the more reliable version for amateurs |
| Race-specific (MP) | 1 long run with 45–75 min @ MP | 25% weekly km at MP | marathon only; pointless below 10K |
| Neuromuscular / economy | 4–8 strides × 20 s, 2×/wk | 6×15 s hills | retained through taper |
| Strength | 2 × 20–30 min heavy-ish full-body | 3×/wk, none within 48 h of a key session | see `workout-library/strength-for-runners.md` |
| Durability (time on feet) | 1 long run/wk | 30–35% weekly volume | growth governed by `mileage-and-progression.md` |

[All rows: grade C coaching consensus except the intensity-fraction caps [PLAN-S8] and the polarized
cap argument [PLAN-S2]. No runner trial has compared 1 vs 2 VO₂max sessions per week at matched
volume — the knowledge base should not pretend otherwise.]

### Per-session ceilings (hard clamps in the generator)

```
intervals:   I-pace total ≤ max(1000 m, i_pace_week_pct% of weekly km / 2)   # one session
             reps ≥ 3 min at I-pace, or switch to cruise intervals
threshold:   continuous T ≤ 30 min (recreational) ; cruise ≤ 40 min total at T-pace
tempo (ext.): a 60-min "tempo" is not a tempo session — split it or relabel it MP
mp:          continuous MP ≤ 100 min, ≤ 20 km in one block
strides:     4–10 × 15–30 s, full recovery; never to failure, never breathless
hills:       6–10 × 45–90 s uphill, jog down; ≤ 8 min total hard uphill for recreational
repeats:     4–8 × 200–400 m, recovery 1:2–1:3; ≤ 2 sessions per macrocycle for most users
```

### Weekly ceiling and stacking rules

- Quality time ≤ 2 sessions × 40 min of work at Z2/Z3 in a ≤ 50 km week; scale with volume.
- **Same-stress spacing**: two threshold-dominant sessions need ≥72 h; interval + threshold can share a
  week at 48–72 h; interval + strides on the same day is fine (strides are not a second stress).
- Long run with MP block counts as a quality session for spacing purposes.
- Hard-day count and volume never both increase in the same week. If a review wants both, one is
  deferred and the deferral is shown to the user.
- → rule: heuristics/workout-dosage.yaml#no_stack_same_stress_h (range 24–96, default 72)
- → rule: heuristics/workout-dosage.yaml#max_quality_minutes_week (range 40–160)

### Hard : easy ratio in practice

- Expressed per week: hard sessions are ~20–30% of **sessions**, never of minutes, at 4–5 days/wk.
- Expressed per 28 days: hard days ≤ 25% of running days, matching the Z3 share cap in
  `periodization/intensity-distribution.md` without forcing an impossible per-week rounding.
- A week where every session feels "medium" has usually 0 hard days and 4 moderate ones; the feedback
  question "could you have run faster at the end?" separates the two cases.

### Cutting order when a week collapses

1. Trim easy-run durations (keep count).
2. Delete the optional recovery run or the 4th easy day.
3. Shorten the quality block (keep the warm-up and 2 reps minimum).
4. Shorten the long run (keep ≥ 60 min if the race is a half or longer).
5. Never delete strides and never convert a key session to an easy run silently — that substitution
  changes the purpose the user was told about, and the comment generator will then be lying.

## Elapsed time: what a session costs in minutes

**Facts.** A time-poor runner's constraint is minutes, not kilometres, and the contract carries both for that
reason (`plan-version.schema.json` `durationMin`). A wall time is distance times a pace, so it inherits whatever
confidence the pace has: with no measured pace there is no honest duration, and the plan prescribes by effort and
distance only.

**Practice.** Easy and long days use the midpoint of their own prescribed band, so the estimate sits inside the
range the runner was told to run. Quality days use the slow end of the easy band, because the work between the
warm-up and the cool-down is effort-led: an estimate at a "tempo pace" would be a second pace prescription that
the session never gave. The two offsets are
`knowledge/heuristics/pace-bands.yaml#elapsed_estimate`, and the number is rounded to whole minutes with the word
"about" in front of it. A decimal would imply a precision the estimate does not have.

**What this is not.** It is not a promise, not a target, and not a reason to cut a warm-up. The session's
authority is still RPE, and the duration is the same kind of statement as the distance: a plan, not a measurement.

## Controversies

- **Two VO₂max sessions per week**: standard coaching practice for competitive amateurs, unsupported
  by dose–response trials in recreational runners. Engine allows it only with ≥5 days, ≥60 km/wk and a
  clean 3-week feedback history. status: contested
- **Long continuous tempo vs cruise intervals**: equal physiological target, different adherence and
  warm-up cost; cruise intervals are more forgiving of a 45-minute slot. Default cruise for ≤ 50 min
  slots. status: contested
- **Percentage-of-mileage caps** assume the plan's volume is honest. A user quietly running 60 km in a
  40 km plan breaks every fraction; the engine recomputes from *actual* completed volume, not targets.

## Individual differences

- Fast-twitch / speed-background users respond to shorter, faster reps and fewer threshold minutes;
  plodders respond to longer threshold and less raw speed. Strengths/weaknesses input picks the
  *variant*, never the *total load*.
- Masters: same minimum doses, longer recovery — replace the second quality session with hills or
  strides rather than a second interval day.
- Returning/injured: minimum dose is the **starting** dose, held for 2–3 weeks before any increase.
