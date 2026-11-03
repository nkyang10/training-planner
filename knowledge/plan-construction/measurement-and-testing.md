---
id: plan-construction/measurement-and-testing
title: "Paces without a lab: tests, prediction, re-baselining, and when paces must not move"
status: draft
confidence: medium
evidence: [review, cohort, practitioner]
applies_to: [planner-core, onboarding, review-engine, workout-picker]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S4, PLAN-S8, PLAN-S9]
---

**Key takeaways**

1. Every prescribed pace is a **prediction from a test**, and the plan must name which one and when it
  happened. No test ⇒ feel-based paces only, labelled as exploratory.
2. Prediction error grows with extrapolation distance. A 5K predicting a marathon deserves a wide band
  and a warning; a recent half-marathon predicting a 10K deserves a narrow one.
3. Test on a **cadence** (every 4–8 weeks), and treat any race as a test whether or not the user
  intended it that way.
4. Paces change on **test evidence or a stated change in condition** — never because one session felt
  good or bad. Single-session outliers do not re-baseline.
5. A test is only useful if reproducible: same course, same shoes, same time of day, same conditions
  rule. Record the protocol with the result.

## Facts

- Prescribed intensity is only interpretable against a stated anchor; in the training-distribution
  trials, zones were set by measured thresholds (ventillary thresholds) per athlete and the zones were
  held constant through the 5-month intervention. [PLAN-S4 grade B — note what the researchers did:
  they fixed the zone model and did not chase it weekly]
- A real training plan's paces come from one recent race time, and all sessions are then expressed
  against it; the same source also notes the model predicts *future* race times from that input.
  [PLAN-S8 grade C; PLAN-S9 grade D practitioner description of the same method]
- → rule: heuristics/pace-model.yaml#evidence_max_age_days (range 21–120, default 56)
- → rule: heuristics/pace-model.yaml#band_half_width_s (range 3–20, see extrapolation table below)

## Practice

### Test menu (no lab)

| Test | Protocol | What it yields | Best for | Caveats |
|---|---|---|---|---|
| Recent race | any 1500 m – half, all-out | strongest anchor | everyone | surface, wind, heat, and drafting bias the result; record them |
| 5K time trial / parkrun | 2–3 km warm-up, 4 strides, flat loop, even-first-mile instruction | 5K predictor | Base-phase baseline; monthly re-check | a 2 km loop twice with spectators is not a record course; use it for *trend* |
| 3-mile test (4.83 km) | as above, on a track or flat measured mile | 10K/half predictor | users without race access | published conversion coefficients exist for this family of tests; the engine must store **its own** calibration and its source, not a number copied from a chart |
| Treadmill ramp | +1 km/h per minute (or +0.5) to exhaustion, HR logged | HRmax, velocity at max | zone ceiling, HR-based users | HRmax from a treadmill ramp is typically below a race-achievable value; use for zones, never for paces |
| Field threshold test | 20-min time trial after warm-up; pace for last 20 min ≈ threshold | threshold pace | intermediate runners | pacing skill required; over-pacing invalidates it |
| Yasso 800 / "minutes:seconds" heuristics | 10 × 800 m @ even pace | folk marathon predictor | entertainment only | **grade D**; never sets a pace, may be shown as a curiosity with the label |

### Prediction and band width

Power-law extrapolation (`T2 = T1 × (D2/D1)^k`, exponent k ≈ 1.05–1.07 in the widely used form) is the
standard method; the original source was **not re-verified in this pass**, so treat the exponent as a
configurable model parameter, not a constant, and never present the output as a single number.
Confidence: low, grade C. [Gap: verify the primary exponent and its validation population.]

Engine rule for pace bands by extrapolation distance (engineering defaults):

| Evidence distance → target distance | Half-band | Statement in plan notes |
|---|---|---|
| ≤ 1.5× (10K → half) | 3–5 s/km | "well supported" |
| 1.5–3× (5K → half) | 6–10 s/km | "reasonable, verify with a tune-up race" |
| > 3× (5K → marathon) | 12–20 s/km | "weakly supported; treat the goal as aspirational" |

### Test cadence

| Phase | Cadence | Preferred instrument |
|---|---|---|
| Onboarding / exploratory | week 1 baseline, week 3 re-check | 3-mile test or parkrun |
| Base | every 6–8 weeks | parkrun or field threshold test |
| Build | every 4–6 weeks | tune-up race (5K/half) or field threshold test |
| Specific | none inside the last 3 weeks before the A race | rehearsal runs instead |
| Post-race | first test ≥ 3 weeks after the race | easy-then-test, never test-then-race |

### Re-baselining triggers (paces change)

1. A new test or race, older evidence kept visible as history.
2. ≥ 10 consecutive days with no running (any reason), or any clinician-managed change in health
   status or medication → paces **downgrade to feel** until a new test; see
   `personas/returning-after-layoff-or-injury.md`.
3. Illness with fever, or any illness with a resting HR ≥ 10% above the user's baseline for 3 days.
4. Sustained condition change: altitude, a season change > 8 °C average, or switching from track to
   daily trail — re-baseline the *easy* band first, the race band only after a test on the new surface.
5. Shoe/surface change of the racing kind (carbon plate, spikes): re-baseline before prescribing
   race-pace blocks; the same legs with the same effort produce different splits.

### Anti-triggers (paces must NOT move)

- One bad interval session, one great easy run, a single hot day, a week of poor sleep, or any mood
  signal. Those change **today's session** (the fallback branch), not the plan's paces.
- Mid-block re-pacing is destructive: sessions become incomparable inside the block, and a review can
  no longer tell whether the plan or the paces caused a change. Exception: a documented re-baselining
  trigger above, with the trigger shown in the plan's assumption list.
- Rule of one anchor: at any moment exactly one evidence item is active; superseded items stay visible
  with `superseded_by` so history is never edited (AGENTS rule 4).

## Controversies

- **Testing frequency**: coaches range from "race is the only test" to weekly time trials. Weekly
  testing costs a recovery day and produces noisy data; 4–8 weeks is the compromise the engine uses.
  status: contested
- **Which prediction model** (Riegel-style power, Daniels' performance-equivalence tables, or vendor
  "fitness" scores) is a product decision, not an established fact. Vendor metrics (Training Effect,
  ACWR, "readiness") are grade D: display-only, never a plan input. status: contested
- **Feel vs numbers for beginners.** Some coaches refuse paces under 10K distance entirely. The engine
  compromise: paces exist but are wide and always paired with a feel cue; `finish_only` users get feel
  only. status: contested

## Individual differences

- HR-based users: a ramp test is their anchor; note that caffeine, heat, and sleep move HR at a given
  pace more than pace moves, so HR bands are ±5 bpm and pace is the tiebreaker.
- Masters: HRmax is individually variable; population formulas are useless here — measure or use feel.
- Heart-rate-affecting medication (e.g. beta-blockers) invalidates HR zones entirely: pace and talk
  test only, and the plan should say so. Any medication question is a clinician question.
