---
id: workout-library/vo2max-intervals
title: "VO₂max intervals (I-pace)"
status: draft
confidence: medium
evidence: [review, meta-analysis, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S1, PLAN-S2, PLAN-S3, PLAN-S8]
---

**Key takeaways**

1. The small, expensive slice of the plan: **~17% of session-time** in the studied distribution, and it
  is the slice that must not grow at the expense of the easy zone. [PLAN-S1 grade B]
2. Dose is small in absolute terms: 8–20 minutes at I-pace per session, ≤ ~5% of weekly volume and
  ~1000 m per session as a textbook cap. [PLAN-S8 grade C]
3. Repetition length 2–5 min with work:rest near 1:1 (3 min on / 3 min off) is the classic, well-
  tolerated shape; shorter reps with longer rest shift the session toward `repeats-anaerobic.md`.
4. Polarized programmes keep this element weekly while cutting moderate volume; the generator must not
  read "polarized" as "more intervals". [PLAN-S2, PLAN-S3] status: contested on the exact optimum

## Purpose

Raise VO₂max and running economy at high speed, and train the psychology of hard, measured effort. The
primary quality session for 1500 m–10K, a supporting one for the half, and a maintenance tool for
marathoners (who get most of their specificity elsewhere).

## Structure

```yaml
classic: "15 min warm-up → 4–6 × 3 min @ I, 3 min jog → 10 min cool-down"
shapes:
  - {name: "standard",  body: "5 × 1000 m, 2:30–3:00 jog"}
  - {name: "long-short", body: "2 × (3 × 1 min @ I / 1 min jog), 3 min between sets"}
  - {name: "ramp",      body: "1′/2′/3′/4′ @ I, equal rest"}   # good first exposure
  - {name: "hill-I",    body: "6–8 × 75 s uphill @ I effort"}  # lower injury risk
placement: "Tuesday, ≥ 72 h from threshold and from repeats; never before the long run in the same 48 h"
caps: {total_on_pace_min: 20, weekly_share_pct: 5, session_m_max: 1000}
```

## Dosing by goal

| Goal | Weekly I-volume | Session shape | Frequency |
|---|---|---|---|
| First 5K | 0 (strides only) | — | — |
| 5K | 8–12 min | 5 × 2 min or 4 × 3 min | 1/wk (+ strides) |
| 10K | 12–18 min | 5 × 1000 m | 1/wk, alternating with threshold |
| Half marathon | 10–15 min | 4–5 × 3 min | 1/wk in Build, then every other week |
| Marathon | 8–12 min | 4 × 3 min or 5 × 1000 | 1/wk in Build; every other week in Specific |
| Finish-only | 6 × 20 s strides suffice | — | optional |
| Trail/ultra | hill version, 6–8 × 75 s | uphill | 1/wk |
| Masters 40+ | 8–12 min | 4–5 × 2–3 min, or the hill version | 1/wk, 72 h before/after anything hard |
| Time-poor 3-day | 12–15 min inside a 40-min slot | 5 × 3 min / 90 s | odd weeks (threshold on even weeks) |

`→ rule: heuristics/workout-dosage.yaml#i_pace_week_pct` (range 3–8), `#i_session_m_max` (range 600–1400)

## Intensity prescription

- I-pace ≈ 3K–5K race effort for most amateurs; a band of 6–10 s/km. It is **not** faster than 5K race
  pace, and the most common error is prescribing 1500-metre speed for an interval session. [PLAN-S8
  grade C]
- The session is judged by **rep 1 vs last rep**: no more than ~2–3 s/km fade across the set. A big fade
  means too fast, too little rest, or fatigue — in that order of likelihood.
- Rest must be jogged, not stood. Standing rest makes rep 3 the first honest repetition.
- Track vs treadmill vs road: treadmill needs 0.5–1% incline and is a different pace; log the surface
  so bands stay comparable.

## Common errors

- Going 10–15 s/km too fast and turning the interval session into a threshold session with rests — the
  exact drift the polarized literature warns about. [PLAN-S1, PLAN-S2]
- Adding a second interval day because the first "went well", breaking the two-hard-days structure.
- Progressive slowing accepted as normal ("that's what intervals are") when it is a dosing bug.
- Doing intervals cold: 8 minutes of warm-up and a failed first rep.
- Chasing a device's "Training Effect" score instead of the prescribed bands — device metrics are
  display-only, grade D, and must never drive plan changes.
- Scheduling intervals the day after a long race-pace run and concluding fitness has regressed.

## Contraindications / substitute

- Not for: novice personas, post-layoff and postpartum below the impact ladder's late steps, uncontrolled
  hypertension, or any week with gait-changing pain (refer, do not substitute intensity).
- Substitutes in order: hill version (same stress, less coordination and impact risk) → shorter reps with
  longer rest (4 × 2 min @ I, 2 min rest) → strides + a tempo session → nothing.
- If a session has to be cut mid-way, cut reps from the **front of what remains**, don't speed up to
  "make up" the volume.

## Progression ladder

1. 4 × 2 min @ I, equal rest (first exposure; judge the fade).
2. 5 × 3 min @ I, 3 min jog.
3. 6 × 3 min, or 5 × 1000 m.
4. Two blocks: 2 × (3 × 1000 m / 200 m jog), 3 min between blocks — the peak dose.
5. Race-specific: 10K runners get 3 × 1200 m at 10K pace; 5K runners get 4 × 1000 m at 5K pace.
6. Maintenance in Specific/taper: keep the shape, drop a rep, never drop the session entirely until the
   last 7–10 days. [PLAN-S5: intensity is what a taper preserves]
