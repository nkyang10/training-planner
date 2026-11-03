---
id: sig-metric-catalog
title: Metric catalogue — every number the engine may see, and what it may decide
status: curated
confidence: high
evidence: [meta-analysis, rct, cohort, review, practitioner, vendor]
applies_to: [engine, data layer, ui]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S1, PHYS-S2, PHYS-S5, PHYS-S7, PHYS-S9, PHYS-S12, PHYS-S13, PHYS-S15, PHYS-S19, PHYS-S20, PHYS-S30, PHYS-S32, PHYS-S43]
---

## Key takeaways

- This table is the **single authority** on which metrics exist, how each is computed, how stale it is, and what it is allowed to decide. If a metric is not here, the engine may not use it.
- Every row states a **must-NEVER-decide** clause on purpose: most metric disputes in running apps come from a descriptive number being promoted into a prescription.
- **Grade = trust in the metric for this population**, not quality of the underlying science. A grade-A sports-science finding measured in team sport is grade-B for a 45-year-old recreational runner.
- Three metrics outrank everything else for planning: **recent race/time-trial performance**, **session class + spacing**, and **self-reported effort (sRPE)**. Everything else is context or corroboration.
- Two grades are binding at build time: **D metrics may never be an input to a planner branch** (display only), and any metric used in a safety rule must be **grade A or B in runners** or reduced to a coarse flag.

## Definitions and formulas

- **Trust grades** (see [../MAINTENANCE.md](../MAINTENANCE.md)): **A** = meta-analysis / large cohort directly in runners; **B** = RCT or cohort, small or non-runner; **C** = consensus, textbook, stable coaching practice; **D** = vendor model, blog, single anecdote.
- **Refresh window**: how often the value is recomputed from source data, and after how many days it is *stale* (stale ⇒ excluded from decisions, may still display with a date).
- **Input data** names the raw channel only (`hr_stream`, `gps`, `manual`, `rpe`, `sleep_device`); the pipeline rules live in `data-sources/*`.
- `NEVER` clauses are absolute, including when the metric looks obviously right today, and including under user pressure to "just bump the pace".
- Noise floors referenced below are the ones recorded in `physiology/individual-differences.md`; a change smaller than the floor is not a change.

## Trust level (summary of the table)

| Grade | Count | Meaning for the engine |
|---|---|---|
| **A** | performance evidence, HRmax equations, HRV direction, weekly-load-change logic | may drive defaults for the whole population |
| **B** | load counters, field tests, decoupling, HRV/RHR baselines, wellness, sleep | may drive decisions only with `range`-clamped knobs, individual baselines and ≥2 confirmations |
| **C** | CTL/ATL/TSB, zone models as convention, ACWR as display, grade-adjustment conventions | description and communication; no thresholds invented from them |
| **D** | vendor Training Effect, Recovery Time, readiness composites, "fitness scores", race predictors | **display only**; never a planner input, never a silent change |

## The catalogue

| Metric | Input data | Formula | Refresh window | Valid population | Trust | Legitimate decision | Must NEVER decide |
|---|---|---|---|---|---|---|---|
| HRmax (measured) | hr_stream (max of all-out test/race) | observed peak HR, artefact-filtered, ≥2 days apart | per occurrence; revalidate yearly | adults with a valid maximal effort; **invalid in pregnancy, beta-blockers, some arrhythmia** | **A** (as a measurement) | absolute ceiling for HR zones and session targets | whether the user is healthy; a reason to add intensity |
| HRmax (age-predicted) | age, sex | `208 − 0.7·age` [PHYS-S1] | at profile setup; until a measured value exists | general adults; RMSE **9.1–10.5 bpm** in 4,043 runners [PHYS-S2] | **A** for the equation, **B** for any one user | initial zone seed, clearly labelled as estimate | any decision that needs ±5 bpm precision; "your HRmax is X" as fact |
| HRrest (nocturnal) | sleep_device | 5th-percentile overnight HR | daily; 28-day baseline | users with ≥14 nights of valid wear | **B** | readiness downgrade with corroboration | diagnosis; whether a session is "earned" |
| Zone minutes (%HRmax) | hr_stream | time in bands by `pct_hrmax` model | per session | users with a trustworthy HRmax | **C** (model), **B** (HR input) | distribute the week; enforce an aerobic floor | prescribe threshold pace; define "recovery" |
| Zone minutes (Karvonen) | hr_stream, HRrest, HRmax | bands on HRR fraction | per session | same, plus stable HRrest | **C** | same as above, one model only | mixing with %HRmax minutes in one series |
| Intensity distribution (aerobic share) | zone minutes | `easy_minutes / total_minutes`, 28-day | weekly | ≥4 weeks history | **B/C** | cap hard days; keep ≥75–80% easy | force an exact 80/20 ratio |
| TRIMP_bands (Edwards) | hr_stream | `Σ(minutes × band weight)` | per session | continuous running | **C** | relative weekly dose, trend | absolute "calories of training stress" |
| TRIMP_exp (Stagno) | hr_stream, HRrest, HRmax, sex | `t·ΔHR·0.64·e^{b·ΔHR}`, b 1.92 m / 1.67 f [PHYS-S5] | per session | adults; **under-weights intervals** [PHYS-S7] | **B** | weekly dose if used consistently | comparing across users; session-by-session ordering |
| sRPE load | rpe, duration | `CR-10 × minutes` (≥10 min post-session) | per session | all users incl. no-device | **B** | primary load counter when HR data is poor | intensity of one interval session; anything per-minute |
| Session load (chosen counter) | above | one pinned counter + `counter_version` | per session | per user setting | **B** | weekly totals, ramps | mixing counters inside one series |
| Weekly load | session loads | `Σ` Mon–Sun | weekly | ≥3 weeks history | **B** | progression, deload triggers | injury probability claims |
| Weekly load change % | weekly load | `(wₙ − wₙ₋₁)/wₙ₋₁` | weekly | ≥4 weeks history | **B** (guard logic) [PHYS-S13] | bound progression to ~10% (`range 5–15`) | justify a >15% jump |
| Monotony | daily loads in week | `mean / SD` | weekly | 5–7 days/week data | **C** (`confidence: low`) | flag an erratic week for conversation | block or schedule a session |
| Strain | monotony, weekly load | `weekly_load × monotony` | weekly | same | **C** | context in the comment | any decision |
| CTL ("fitness") | session loads | `EMA42` (τ = 42 d) [PHYS-S32] | daily, display | ≥12 weeks continuous data | **C** | narrative ("your recent average") | prescribe a session; define readiness |
| ATL ("fatigue") | session loads | `EMA7` (τ = 7 d) | daily, display | same | **C** | narrative | prescribe a session |
| TSB | CTL, ATL | `CTL_yesterday − ATL_yesterday` | daily, display | same | **C** description / **D** prescription | show the arrow with the trend | set today's intensity; "TSB ≥ 15 = race ready" |
| CTL ramp rate | CTL | `ΔCTL/week` | weekly | same | **C** | cap weekly growth (≤5–7 CTL/wk as a *derived* check) | replace the %-based progression rule |
| ACWR (EWMA 7/28) | session loads | `EWMA7 / EWMA28` | daily, display | ≥28 days continuous | **C** display / **D** decision [PHYS-S12, PHYS-S13, PHYS-S15] | corroborate a downgrade with other signals | trigger any change alone; a specific "sweet spot" verdict |
| ACWR (RA 7/28 coupled) | session loads | `rolling7 / rolling28` | daily, display | same | **C/D** (33.4% vs 16.2% flag disagreement across methods [PHYS-S15]) | the same, labelled | be shown beside the EWMA variant as if identical |
| Longest session vs 4-week max | duration | `longest_today / max(last 4 wk)` | per session | ≥4 weeks | **B** (heuristic) | cap long-run growth at ~10–15% | define injury risk numerically |
| Hard days per week | session classes | count of threshold+ sessions | weekly | all | **A/B** (adaptation timing, `physiology/aerobic-energy-and-adaptation.md`) | cap at 2 (`range 1–3`) | add a third because "recovery looked good" |
| Hard-day gap | session classes, timestamps | hours between hard sessions | per session | all | **B** (τ_f > τ_s logic) | enforce ≥48 h spacing; reorder | shorten spacing to "fit in" a session |
| Interval quality (hit ratio) | hr_stream, gps | `min(time ≥ target) / planned reps` | per session | interval sessions with a target | **B** | mark session as partially met; adjust next target ±2–3% | declare fitness change from one session |
| lnRMSSD (7-day) | sleep_device | `mean(ln RMSSD)` over 7 valid nights | daily | ≥14 valid nights | **B** [PHYS-S19, PHYS-S20] | downgrade with ≥3 abnormal nights/7 d | upgrade intensity (a *rise* never adds work [PHYS-S19]) |
| lnRMSSD z-score | lnRMSSD series | `(x − mean₂₈)/SD₂₈` | daily | ≥28 baseline days | **B** | flag deviation, annotate confounders | a diagnosis; a "recovery %" |
| rMSSD CV (28-day) | lnRMSSD series | `SD/mean` | weekly | ≥28 days | **C** | describe stability | verdicts on overtraining |
| HR deviation index (HRdev) | hr_stream, session loads | `Σ(HR_session_mean − HRrest)/HRrest` | per session, weekly mean | HR-based trainers | **B/C** | track autonomic response to a block | set today's pace |
| HRR 60 s | hr_stream | `HR_peak − HR_60s_after` | per session | completed hard sessions | **B** (non-specific: rises with fitness *and* fatigue [PHYS-S19]) | context in review | a fatigue verdict |
| Sleep duration | sleep_device | total sleep time | daily | valid wear nights | **B/C** (device error; do not chase absolute minutes) | note a bad night; suppress hard session after <5 h with corroboration | sleep-prescription language; a diagnosis |
| Sleep-timing irregularity | sleep_device | SD of sleep midpoint, 7 d | weekly | ≥7 nights | **B/C** | flag an erratic week | decide intensity |
| Wellness index (4-item) | manual daily | sum of fatigue/soreness/stress/sleep, 1–5 each | daily | all users | **B** | downgrade after ≥2 days of elevated scores | a diagnosis; "you are ill" |
| Single-item fatigue | manual | 1–5 rating | daily | all users | **B** | choose easy day over quality day | a training-load dose |
| GPS pace | gps | distance/time, smoothed, moving-filtered | per session | outdoor runs | **B** (device/channel) [PHYS-S30] | trend, band adherence | a threshold re-band; interval-by-interval judging |
| Grade-adjusted pace | gps, barometer | `v·(1 + k·grade)`, k ≈ 0.03 per 1% (convention) | per session | hilly courses | **C** | describe effort-equivalent pace | set race pace from a hilly run |
| Pace-band adherence | gps, plan target | `time in target band / total` | per session | structured sessions | **B** | mark session met/unmet | a fitness change |
| Cadence | gps/footpod/hr | steps/min median | per session | all | **C** | describe; watch for large drift | prescribe a cadence target as an intensity lever |
| Cadence drift | cadence series | `(2nd half − 1st half)/1st half` | per eligible session | ≥30 min steady | **B/C** | corroborate fatigue when HR is invalid | a standalone fatigue verdict |
| HR–pace decoupling | hr_stream, gps | `(HR₂ − HR₁)/HR₁` over two halves of a steady sub-threshold run | per eligible session; weekly median | ≥30 min, flat, <85% HRmax | **B** concept, **C** cut-point | trend durability over blocks | decide today's session; "danger zone" language |
| Cardiac drift | hr_stream | HR rise at fixed workload, first 30 min | per session | steady efforts | **C** | note heat/hydration confound | any prescription |
| vVO₂max / threshold pace (field test) | test result | best-effort 5-k or 2-effort critical speed | per test; **stale at 84 d (test) / 56 d (CS)** | motivated users, valid protocol | **B** | set training paces; goal feasibility | extrapolate to a marathon from a 5-k alone |
| Race result (recent) | manual/race | finish time, known course | event; stale at 365 d | all | **A** (performance evidence) | highest-ranked pace/goal input | ignore wind/grade/course when reading one result |
| Predicted race time | model + performance history | e.g. `T₂ = T₁·(D₂/D₁)^α`, α ≈ 1.06 [PHYS-S43] | on demand, display | users with ≥2 valid performances | **C** model / **D** single-number output | goal *conversation* and feasibility bands with a stated range | print one number as a target; set paces from it |
| Adherence ratio | plan vs log | `completed / planned` over 4 weeks | weekly | planned users | **B** (data quality, not physiology) | scale volume to demonstrated behaviour | moralise; label the user "lazy"; add work as a penalty |
| Missed-day streak / days since last run | log | consecutive days without a session | daily | all | **A/B** (detraining timing, `physiology/demographics-and-context.md`) | choose the restart bucket; gate hard sessions | schedule a catch-up session |
| 28-day rolling volume | duration, load | `Σ` last 28 d | daily | ≥4 weeks | **B** | context for caps and taper length | injury-risk claims |
| Vendor VO₂max estimate | vendor API | proprietary | on sync | vendor devices | **D** | long-term trend with a visible caveat | set training paces; a goal statement |
| Vendor Training Effect / Load | vendor API | proprietary | per activity | vendor devices | **D** | display, or as *display-only* field in a fact object | any planner branch; a hard-session decision |
| Vendor Recovery Time / Readiness composite | vendor API | proprietary weights | daily | vendor devices | **D** | display with "device estimate" wording | any plan change; a "green light" to add intensity |
| Heat / altitude flag | location, weather, elevation | context flag (not a metric) | per day | all | **B** (concept) | discard pace targets → effort targets; cap intensity | apply a fixed "seconds per km per °C" coefficient |

## Facts about the table itself

- The grades encode **population match**: `A` rows are the only ones allowed to become population-wide defaults; `B` rows become defaults only as `range`-clamped knobs with individual baselines; `C` rows may shape wording and structure; `D` rows never reach the planner.
- Metrics are **not interchangeable**: HR-based, pace-based and RPE-based load of the same run rank sessions differently, and the disagreement is informative (`signals/session-load-metrics.md`), not noise to average away.
- Several rows exist mainly to record a **prohibition** (vendor composites, TSB prescription, prediction output). A metric the app collects but may not use is a product decision, not an oversight — record it in an ADR if challenged.
- Any new metric must be added here **before** it can be referenced by a heuristic knob; the build check should reject heuristics pointing at metrics absent from this catalogue.

## Practice

- Show the user at most a handful of these: performance trend, weekly load + change, HRV/RHR deviation, wellness, and today's session rationale. Everything else lives in a "why we know this" panel.
- Label every displayed derived number with its model and its date (`CTL EMA42 · since 2026-08-01`); unlabeled derived numbers become false facts in the user's head.
- When two metrics disagree, the plan follows the **higher-ranked evidence class** (race result > measured test > session behaviour > model output > vendor estimate) and the comment says so in plain language.

## Controversies

- **Should TSB/CTL be in a consumer app at all?** They are the most-requested and the least-validated for amateurs. Stance: keep them as *descriptive* charts with an explicit "not a prescription" caption; no planner branch may read them.
- **Is a composite "readiness score" worth building?** It hides which input moved and cannot be audited. Stance: decomposed signals beat a composite; if a score is shown, its components are shown with it.
- **Counties of one metric vs multi-signal** — single-metric rules are explainable but brittle; multi-signal rules are robust but opaque. Stance: **rule = one primary signal + explicit corroborations**, each named in the comment.

## Engine implications

- `→ rule: heuristics/metric-catalog.yaml#grade_gate` — planner branches may reference grade **A/B** metrics only; **C** metrics may appear in narrative facts; **D** metrics may never appear as a condition (`mode: build_time_error`).
- `→ rule: heuristics/metric-catalog.yaml#staleness_days` — per-metric map (race 365, test 84, CS 56, model 28, HR proxy 28, vendor VO₂max 90); stale ⇒ excluded from decisions, still displayed with its date.
- `→ rule: heuristics/metric-catalog.yaml#min_series_days` — per-metric minimum continuous history before the metric may influence anything (HRV 14, ACWR 28, CTL 84, load-change rules 28), each with `range`.
- `→ rule: heuristics/noise.yaml#min_effect_pct` — one entry per metric, defaulting to the noise floors in `physiology/individual-differences.md`; a signal below its floor cannot trigger.
- `→ rule: heuristics/safety-hard-stops.yaml#grade_a_or_b_only` — safety rules may reference runner-grade A/B metrics, or a coarse boolean flag derived from anything else.
- `→ rule: heuristics/language-guardrails.yaml#label_derived_numbers` — every displayed derived metric must carry model name, window and as-of date in the UI string.
