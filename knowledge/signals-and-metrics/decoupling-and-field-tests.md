---
id: sig-decoupling-field-tests
title: HR–pace decoupling, drift markers and field tests
status: contested
confidence: medium
evidence: [rct, cohort, review, practitioner, vendor]
applies_to: [all users with pace + HR recordings]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S22, PHYS-S30, PHYS-S45, PHYS-S46]
---

## Key takeaways

- **Decoupling** (HR rising while pace holds) is the best fatigue/durability signal a runner can get from a watch without a lab, and it is also the easiest to compute wrongly: it requires a steady, long, aerobic effort in stable conditions.
- Used correctly it answers a narrow question — *was this effort sustainable for this person today* — and it is a legitimate **training-status indicator over weeks**, not a daily traffic light.
- **Field tests are the app's only honest way to set thresholds.** Everything downstream (paces, zones, session targets, goal feasibility) inherits the test's error, so the protocol has to be standardised, repeatable and repeatable *by the user alone*.
- Cadence drift and pace drift are the same idea applied to other channels; they are cheaper (no HR dependency) but less studied.
- Test the same way every time. A test whose protocol changed is a new metric, not a new data point.

## Definitions and formulas

| Term | Formula / protocol | Notes |
|---|---|---|
| **HR–pace decoupling** | `decoupling % = (HR_2ndhalf − HR_1sthalf)/HR_1sthalf × 100`, computed over two equal halves of a steady aerobic effort, pace held within a narrow band | Requires: ≥30–40 min, flat, no traffic stops, no heat spike, effort below threshold |
| Cardiac drift | `HR` rise at fixed absolute workload in the first ~20–30 min | Distinct phenomenon (thermal/fluid); usually excluded by discarding the first 10 min |
| **Cadence drift** | `(cadence_2ndhalf − cadence_1sthalf)/cadence_1sthalf × 100` | no HR dependency; usable for users whose HR data is invalid |
| Pace drift at fixed HR | `(pace_1sthalf − pace_2ndhalf)/pace_1sthalf` | the inverse view; same requirements |
| **5-k / 8-k time trial** | best-effort, flat, after a standardised warm-up | primary threshold anchor: 5-k ≈ 95–98% of vVO₂max-domain effort |
| **Critical speed (2-effort)** | from exhaustive 3-min and 9-min efforts: `CS = (d₉ − d₃)/(540 − 180)` m/s | field proxy for the heavy/severe boundary; needs honest efforts |
| 30-min threshold test | 30-min all-out after warm-up; threshold = mean HR/pace of the **final 20 min** | cycling-derived; usable in running with pacing discipline |
| Cooper 12-min | distance → V̇O₂max estimate | population-fitness test; weak for trained runners |
| Repeat-testing control | same protocol, same time of day, ≥7 days apart, no hard session in 48 h | without this, a "1% improvement" is noise |

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| Greater HR–pace decoupling distinguishes better-trained / better-finishing runners within a race | **B** | observational race studies (small samples, mixed abilities); direction is consistent, magnitudes are not transferable |
| A decoupling threshold near **5%** (acceptable) and **>10%** (problematic) for steady aerobic runs | **C → D** | practitioner/vendor convention; **no validated population cut-point**; treat as tunable knobs, not constants |
| Cadence drift is a usable fatigue marker from consumer data | **B** | recent consumer-data studies of drift metrics in running [PHYS-S45, PHYS-S46] — association-level evidence, not diagnostic |
| A maximal time trial reliably measures current capacity | **B** | test–retest CV for a well-controlled 5-k is commonly ~**1–3%** (`confidence: medium`); worse if the user paces badly or tests fatigued |
| Critical speed from 2 field efforts ≈ lactate threshold | **B** | lab agreement at group level; individual spread of a few percent and strong dependence on pacing discipline in both efforts |
| Vendor "threshold auto-detect", "endurance score", "durability score" | **D** | proprietary; no published validation; display only |
| Decoupling computed from a typical city run | **D** | traffic lights, hills and heat dominate the signal |
| A single field test sets training paces for a whole block | **C** | universally practised, unverified; requires a validity window (≤12 weeks) and a change threshold (>3%) before re-banding |

## Facts

- Decoupling requires *steady state*: if the effort is above threshold, HR rises for reasons unrelated to durability, so the metric silently becomes an intensity measure. The app must classify the session first and compute decoupling only for eligible sessions.
- Environment contaminates decoupling more than almost any other consumer metric: heat, humidity, wind, a hill, a watch face glance, dehydration. A rising decoupling trend over a summer block may be summer, not staleness.
- Time trial performance is the **fitness evidence with the highest rank in this app** — it outranks model output and correlates with race results by construction. Its weakness is that it costs recovery and users test rarely.
- Field-test decay: paces derived from a test older than a training block are stale (`physiology/vo2max-threshold-economy.md`); a layoff invalidates a test immediately, and detraining magnitude is documented [PHYS-S22].
- Users cannot self-administer a truly maximal test reliably; a test with a hidden reserve produces paces that are too easy, and one that is too hard produces a "PB" the plan then cannot support. Standardised instructions and a mandatory warm-up script are part of the metric's validity, not UX polish.

## Practice

- Test cadence for amateurs: a 5-k time trial every **6–8 weeks**, or a race, and nothing else; 2-effort critical speed only for users who follow instructions precisely.
- Compute decoupling only for runs ≥30 min, mean grade <2%, HR below ~85% HRmax, and session-class = easy/aerobic; store it per session and trend the **weekly median**.
- Read decoupling over weeks: a falling median at the same pace = durability improving; a rising median with the same RPE = reduce something.
- Always re-test under the same conditions as the baseline test (surface, time of day, weather band); record those conditions with the value.
- Accept a threshold change only if it exceeds the test's own noise (>3%), and change all derived paces in one atomic operation with a stored reason.

## Controversies

- **Is decoupling fitness or fatigue?** It reflects both, plus environment and hydration; different authors emphasise different components. Stance: trend-only metric, never a single-session verdict.
- **Do amateurs need threshold testing at all?** For a 5-k/10-k goal, a 5-k time trial is nearly sufficient. For marathon pacing, a 5-k alone under-predicts endurance and over-predicts pace — the marathon plan needs long-run behaviour, not just a test (`pace-models.md` on Riegel's failure mode).
- **Submaximal predicted tests (e.g. progressive field tests predicting V̇O₂max)** — convenient, less recovery cost, but prediction error compounds with the population equations' error. Stance: acceptable as a *starting* estimate; a real time trial is required before any goal-feasibility statement.
- **Testing during a block vs at the end** — testing fatigued under-reports capacity; testing fresh costs a hard session. Stance: test at the end of a recovery (deload) week, always.

## Worked examples — the arithmetic on real-looking sessions

Figures below are **illustrative arithmetic from the formulas above**, not measured study data; they
exist so a reviewer can see how the gates behave.

| Session | Avg HR half 1 → half 2 | HR change | Speed change, half 2 vs 1 | Decoupling | Engine read |
|---|---|---|---|---|---|
| 60-min steady, flat, 18 °C, HR ~72% HRmax | 138 → 145 | +5.1% | −1.0% | ≈**6.1%** | Eligible session; just over the 6% band → report the number, change nothing, seek a second session |
| 45-min steady with 60 m of climb | 141 → 150 | +6.4% | −4.0% | ≈10.4% | **Ineligible** (grade gate): the number is terrain, not fatigue — suppress |
| 75-min long run in rising temperature | 146 → 158 | +8.2% | −6.0% | ≈14.2% | Eligible but heat-confounded: display the trend, do not label it "durability" |
| 30-min steady at 78% HRmax, illness day 3 | 152 → 166 | +9.2% | −3.0% | ≈12.2% | Confound flag set → excluded from the weekly median entirely |

Two properties of the formula are worth stating explicitly, because they shape what the number can
mean: slowing down **raises** computed decoupling (a runner who fades gets a worse number for two
reasons at once), and short sessions magnify it, since the second half of a 25-minute run includes
the warm-up artefact of the first. Hence the ≥30-minute and steady-grade eligibility gates.

Field-test arithmetic (checkable):

- Critical speed from a 3/9-minute test: `d₃ = 1 050 m`, `d₉ = 2 700 m` → `CS = (2700 − 1050)/360 =
  4.58 m/s` = **3:38 /km**; a 90% threshold estimate is then ≈ 4:04 /km.
- A 5-k time trial run at even pacing finishing 24:10 is 4:50 /km; if the first kilometre was
  4:35 and the last 5:05, the record is a **pacing error**, and the derived V̇O₂max is optimistic.
- 30-minute test using only the final 20 minutes: 5 600 m in 20:00 → 3:34 /km for the scored portion;
  scoring the full 30 minutes (6 200 m → 2:53/km pace equivalent) would produce a different — and
  less reproducible — threshold. Pin one protocol.

## Test selection matrix

| Runner / goal | Test | Retest interval | What it may legitimately decide |
|---|---|---|---|
| Novice, 5-k goal, no recent race | walk/run graded HR test or a 2-effort field test | 6–8 weeks | start/stop of an interval block; effort band, not pace |
| Experienced, half-marathon | 5-k time trial (track, cool weather) | 6–8 weeks, ≥3 weeks from race | threshold re-band when the change exceeds the noise floor |
| Marathon-focused, no recent race | 3/9-min CS test on a track | 6–8 weeks | interval tier placement; MP stays anchored to a race or MP session |
| Heat or altitude block | avoid pace tests entirely | post-block, at home conditions | nothing pace-related; HR/effort observations only |
| Returning after layoff | none in weeks 1–4 | from week 5 | nothing — the load ramp is calendar- and symptom-driven |

## Protocol requirements before a test is accepted as data

- Same course or track, wind under "light", temperature within roughly ±8 °C of the previous test,
  same time of day ±2 h, no long travel across time zones in the previous 5 days.
- Standardised warm-up (10–15 min easy + 3–4 strides) recorded as part of the test, not as a separate
  session, otherwise the HR data confuses the decoupling pipeline.
- 48 h without another quality session or a long session >90 min beforehand; the test day is not a
  training-day judgement about how the runner feels.
- Device: chest strap preferred for any HR-derived result; optical readings are accepted for pace
  sessions but marked as such, because HR error is the dominant term in decoupling.

## Engine implications

A drift number is only as trustworthy as the protocol that produced it.

- `→ rule: heuristics/field-tests.yaml#eligible_decoupling_session` — `min_duration_min 30 (range 20–60)`; `max_mean_grade_pct 2`; `max_hr_pct_hrmax 85`; `require_session_class [easy, aerobic, long]`; ineligible sessions return `null`.
- `→ rule: heuristics/field-tests.yaml#decoupling_band_pct` — flag at **>6%**, `range 3–12`; use the *weekly median of ≥2 eligible sessions*, never one session.
- `→ rule: heuristics/field-tests.yaml#retest_interval_days` — 49 (7 weeks), `range 28–90`; a test inside 28 days of the previous one is recorded but does not re-band paces.
- `→ rule: heuristics/field-tests.yaml#min_change_to_reband_pct` — 3 (`range 2–6`); below it, keep prior paces and note "no measurable change".
- `→ rule: heuristics/field-tests.yaml#no_test_within_days_of_race` — 14, `range 7–21`; a maximal test is a hard session and follows the taper rules.
- `→ rule: heuristics/pace-bands.yaml#test_conditions_required` — store `{surface, weather_band, time_of_day, freshness_week}` with every test; a comparison across materially different conditions is annotated as "conditions differed".
- `→ rule: heuristics/language-guardrails.yaml#no_durability_score` — the app may describe observed drift; it may not output a named proprietary-style score ("Durability 62").
