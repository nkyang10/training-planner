---
id: workout-library/marathon-pace-run
title: "Marathon-pace (race-pace) run"
status: draft
confidence: medium
evidence: [practitioner, review]
applies_to: [workout-picker, plan-generator, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S4, PLAN-S8, PLAN-S10, PLAN-S11]
---

**Key takeaways**

1. Race-pace work is **rehearsal with a training side-effect**, not the main stimulus. Its honest value
  is pacing discipline, mechanics, gear and fuel routine under race effort.
2. Dosed in minutes inside other sessions, in bands, with a hard cap of ~25% of the week at MP and ≤ 20
  km / 100 min continuous. [PLAN-S8 grade C]
3. For anything shorter than a marathon, "race pace" means the *event's* pace: half runners rehearse at
  half pace, 10K runners at 10K effort — MP blocks are a marathon-specific tool.
4. Two schools treat it very differently (Daniels/Pfitzinger moderate dosing vs Hansons MP-heavy weeks);
  the generator picks one family per block and never blends the caps. [PLAN-S8, PLAN-S11 vs PLAN-S10]
  status: contested

## Purpose

Rehearse goal pace and its mechanics when fatigued, calibrate the pace band so race day contains no
surprises, test the kit and the fuel routine, and add moderate-intensity aerobic load. It is the session
that converts a target time into a practiced sensation.

## Structure

```yaml
standalone: "10–15 min warm-up → 2 × 15–25 min @ MP with 5 min float → 10 min cool-down"
inside_long_run: "see workout-library/progression-long-run.md"
cruise_form: "4 × 5 min @ MP, 60 s float — the low-risk introduction"
duration_caps: {continuous_min: 100, continuous_km: 20, weekly_share_pct: 25}
placement: "midweek in Specific, or inside Saturday's long run — not both in one week"
spacing: "≥ 72 h from any Z3 session (same stress family: moderate-to-hard aerobic)"
```

## Dosing by goal

| Goal | Weekly MP-family volume | Peak single exposure | Weeks |
|---|---|---|---|
| 5K / 10K | 0 (use T and I) | — | — |
| Half marathon | 20–35 min at half pace | 2 × 15 min | 4 Specific weeks |
| Marathon, sub-3:30 | 45–75 min | 45 min inside long run, or 12–16 km standalone | 6 weeks |
| Marathon, 4:00–4:45 | 30–50 min | 2 × 15–20 min | 4 weeks |
| Marathon, slower/finish-only | 2 × 10–15 min rehearsal | 15 min | 3 exposures total |
| Ultra (50K road-ish) | 15–25 min on tired legs | 25 min | optional, 1–2 weeks |
| Masters 40+ | 20–40 min | 20 min continuous | 3 weeks, +48 h around |

`→ rule: heuristics/workout-dosage.yaml#mp_week_pct` (range 10–25)

## Intensity prescription

- MP is defined from the **current evidence item** (a recent race or test), as a band, with its source
  and date. If the evidence is older than the model's freshness rule, widen the band instead of
  pretending to precision. `→ rule: heuristics/pace-model.yaml#evidence_max_age_days`
- Sensation target: short phrases, controlled breathing, "work but in control"; by the last 15 min,
  holding pace takes attention rather than effort.
- Effort overrides pace in heat, wind, humidity and hills: cap the effort, log the pace as information.
- Race shoes: at most 2–3 exposures per block, on the shortest legal version of the session, so the
  shoe-specific pace never becomes the plan's baseline pace. [display-only caution; no runner-specific
  longitudinal source verified]

## Common errors

- MP-volume creep: 25 → 35 → 50 min per week because the session "never feels hard". It is the classic
  junk-load trap — a moderate zone that was supposed to stay small. [PLAN-S4 grade B]
- Running MP as a time trial with a friend and calling it rehearsal.
- Doing MP work in week 2 of a base block, then having nothing left to add in week 12.
- Judging the band by how it felt on a bad-sleep week and re- pacing the whole plan from one session.
- Scheduling MP the day after intervals; same stress family, 72 h apart minimum.
- Adding MP on top of a progression long run in the same week *and* a midweek cruise session — three MP
  exposures, one of them over the weekly cap.
- Rehearsing only in ideal conditions, then meeting a 25 °C race with a pace-only plan.

## Contraindications / substitute

- Not prescribed for: novices, 5K/10K goals, post-layoff, postpartum, or anyone whose evidence item is
  older than the freshness rule and who declines a test — the band would be a guess.
- Substitutes, in decreasing demand order: cruise-form MP (4 × 5 min) → 2 × 10 min inside an easy run →
  strides + a plain long run → nothing (drop the element and say so in the review).
- If the user reports a pain that appears at minute 25 of MP runs only, that is a load-signature
  signal: remove the session for 7 days and refer if it returns. Never diagnose it.

## Progression ladder

1. Cruise-form MP: 4 × 5 min @ MP, 60 s float, inside a 60-min run.
2. 2 × 15 min @ MP with a 5-min float.
3. Continuous 30 min @ MP midweek.
4. MP inside the long run: 20 → 30 → 45 min (the peak marathon dose).
5. Rehearsal version: MP block in race kit, race start time, race warm-up, and the user's own fuel
   routine — 10–14 days out.
6. Taper: MP shrinks to 2 × 8–10 min at the same effort 10 days out, then nothing but strides.
   [PLAN-S5]
