---
id: sig-pace-models
title: Pace models — predictions, equivalents and critical speed
status: contested
confidence: medium
evidence: [review, cohort, practitioner, vendor]
applies_to: [all users with GPS or treadmill pace data]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S30, PHYS-S43, PHYS-S44]
---

## Key takeaways

- Pace is the most trusted and least reliable input in the app: GPS pace error, grade effects and wind make a single run's average pace a weak dose measure, while race results remain the best fitness evidence available.
- Race-equivalence formulas (Riegel-type) are **empirical extrapolations with a contested exponent**. They are legitimate as a *communication* device ("your current 10 k is around 47") and illegitimate as a *prescription* device ("so run your intervals at 3:52/km").
- Critical speed estimated from 2–3 exhaustive field efforts is the most usable threshold proxy for an amateur, but the estimate varies by protocol and by pacing discipline; hold it ±3%.
- The planner should prefer **effort → pace** over **pace → effort**, and it should never let a pace target outrank a conflicting HR or RPE signal except by explicit user instruction.

## Definitions and formulas

| Term | Formula / definition | Comment |
|---|---|---|
| Grade-adjusted pace | `v_equivalent ≈ v_measured · (1 + k·grade)` with `k ≈ 0.025–0.035` per 1% uphill grade in the moderate range | Convention only; published coefficients disagree; downhill is asymmetric (costs less than it saves, but damages muscle) [PHYS-S44] |
| Riegel race-time prediction | `T₂ = T₁ · (D₂/D₁)^α`, **α ≈ 1.06** commonly used | Derived from a 1977/1981 recreational-race analysis (`confidence: medium` — record not abstract-verified on 2026-11-03); α is not universal and fails for very long durations |
| Critical speed (CS) | slope of `distance = CS · t + W′` from ≥2 exhaustive efforts (~3 and ~9 min, or from all-out 3-min test) | Best field proxy for the severe/heavy boundary; protocol-dependent |
| vVO₂max proxy | mean speed over a ~4–6 min all-out effort, or CS × ~1.03–1.05 | Coaching heuristic; needs verification |
| Session-equivalent pace | effort-matched pace on a flat reference, after removing stop time | Removes GPS and traffic artefacts |
| Pace-vs-HR gap | observed pace at stable HR vs the pace expected for that HR | A drift signal (see decoupling file) |

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| A recent well-executed race predicts current capacity | **A** (practice-grade) | direct performance evidence; the reason race results outrank all model outputs |
| Riegel-type equivalence with α ≈ 1.06 | **C** | widely used, empirically fitted on mixed-distance recreational data; **contested exponent**, and it extrapolates badly beyond ~2 h efforts [PHYS-S43] |
| Coach tables (Daniels-style %vVO₂max paces, McMillan-type predictors) | **C / D** | coaching consensus tables; proprietary calculators are grade D; internal consistency unverified |
| Critical speed ≈ maximal lactate steady state | **B** | group-level agreement in lab studies; individual protocol disagreement of a few percent |
| Commercial "threshold pace" / "lactate threshold auto-detect" | **D** | vendor black boxes, no external validation; display only |
| Consumer GPS pace on a flat, open route | **C** | usable for trend, not for interval-by-interval prescription [PHYS-S30] |
| GPS pace in city/canyon/forest, or on technical trail | **D** | error can exceed 5–10% of speed; use time-on-feet instead |
| Wrist optical pace without GPS (cadence-based) | **D** | stride-length assumptions break on hills and fatigue |

## Facts

- Consumer GPS pace is sampled and smoothed; short reps (200–800 m) are frequently wrong by more than the difference between two training paces. **Do not prescribe paces that differ by less than ~3–5%** from a device-measured run.
- Grade equivalence is not symmetric and is speed-dependent; the practical rule is **effort-capped hills, pace-matched flats**.
- Riegel-type predictions systematically **under-predict marathon and ultramarathon times** for runners whose endurance (not V̇O₂max) is the weak link, and over-predict for runners with a big aerobic engine and low mileage. Both failure modes produce plans that are too hard.
- Race results decay as evidence: a result older than the training block it came from is a hypothesis, not a measurement. Practical staleness windows (planner convention, not a study): race ≤ 12 months, field test ≤ 12 weeks, HR/pace model output ≤ 4 weeks.
- Indoor treadmill pace and outdoor pace are not the same session; the plan should record surface and let the user's own history arbitrate.

## Practice

- Order for deriving training paces: recent race → recent field test → critical speed from two efforts → HR-anchored effort bands → RPE bands.
- Publish paces as **ranges** ("4:40–4:55/km, by feel") — a range expresses the true uncertainty and prevents a user from sprinting the top of a band.
- Where pace and HR conflict, the planner keeps the more conservative interpretation for *increasing* load and the user's RPE for *describing* the session.
- Never re-band training paces from one session; require a test or a race, or two independent agreeing estimates.

## Controversies

- **The value of α.** Reported exponents vary with the population and distance range; some analyses support a duration-dependent exponent rather than a constant. Stance: keep α configurable (default 1.06), label all predictions as estimates, and forbid prediction-derived paces.
- **Do we need pace at all?** An effort-based plan with a watch that shows HR only produces equal outcomes for most amateurs. Stance: default the app to effort-first with pace as secondary display, and let competitive users flip it.
- **Threshold-pace auto-detection** — vendors ship it, none publishes validation. Stance: display if present, never a plan input.

## Worked examples — what a band looks like in the product

| Input | Model | Point estimate | Band the UI may show | What the UI must not do |
|---|---|---|---|---|
| 10-k 48:00 → half | Riegel α = 1.06 | 105.9 min | 1:42–1:51 (α 1.02–1.12) | print "your half-marathon pace is 5:00/km" as a workout target |
| Half 1:45 → full | Riegel α = 1.06 | 3:37:3x | ±3–5 min, plus a fatigue caveat for first marathoners | promise the time, or build 6 weeks at the predicted MP |
| 5 km at 5% uphill, 5:00/km | +3% per 1% grade | 5:45/km flat-equivalent | "effort-equivalent", one figure | schedule a hill repeat by *pace* without stating the grade assumption |
| Session pace 4:52 vs band 4:48–5:04 | band membership | inside band | "on target" | score adherence to one decimal of a derived target |

## Why band width, not point precision

- A derived threshold pace inherits **both** the test error (2–5%) and the individual threshold
  fraction (0.88–0.96 of vVO₂max). Multiplying those errors gives roughly a ±4–6% honest band, so a
  4% band is already optimistic and a 2% band is noise dressed as a target.
- Runners experience a 4% band as ~5 s/km at 5:00/km — inside the variation between two ordinary
  days. This is why the session card should show a **range plus an effort anchor**, and why "hit
  your pace" language belongs to races, not training.
- Adherence is therefore a **per-session proportion of time inside the band** (a coarse descriptor),
  never a per-lap score, and never averaged across surfaces or grades.

## Failure modes specific to pace prediction

- **Downhill and ultra distances.** Riegel-type exponents are fitted on road distances up to about a
  marathon; beyond that, fatigue and terrain dominate and the equation is out of domain.
- **Course mismatch.** A net-downhill personal best is not a flat-course input; if elevation gain is
  unknown, mark the performance `grade_unknown` and widen the band.
- **Wind and surface.** A windy day's "threshold" session can be 5–8% off the calm-day value; the
  engine should not accept sessions from known-windy or technical routes as band-calibrating data.
- **Treadmill.** Reported treadmill paces are not comparable to overground pace at the same effort;
  store them as effort-only data.
- **Track spikes.** A track 5-k in new spikes is a different equipment condition than a road 5-k;
  treat equipment-driven jumps as performance events, not threshold evidence, and re-confirm.

## Practice — the pace object in the product

- Every displayed pace carries four attributes: **value, band, source, source date**. If any is
  missing, the number is not displayed — "we don't have a pace for you yet" is a correct state.
- One pace ladder per user, one source of truth per tier (easy / marathon or threshold / interval).
  Two ladders in the same UI is the fastest way to lose trust.
- Race results always outrank tests; tests outrank HR proxies; HR proxies outrank model estimates.
  A newer, weaker source never silently overwrites an older, stronger one — it becomes a candidate
  and needs `#conflict_policy` to pass.
- Staleness is shown, not hidden: "from your 10 k in March" or "from a field test 11 weeks ago"
  tells the user why the number may feel wrong, and sets up the retest invitation.
- A new pace ladder is introduced with one week of "trial" language: the first week at new paces is
  a calibration, not a performance expectation.
- Effort-first fallback is never a degradation message. The copy is "today we run by feel", not
  "pace unavailable".

## Engine implications

A pace object carries its source, its date, and its band. The planner treats pace as a range and prefers effort-based prescriptions.

- `→ rule: heuristics/pace-bands.yaml#band_width_pct` — 0.04–0.08 (4–8% wide bands), `range 0.02–0.12`; a target narrower than the device's own error is a bug.
- `→ rule: heuristics/pace-bands.yaml#riegel_exponent_alpha` — 1.06 default, **range 1.02–1.12**, single knob for every prediction; `→ rule: heuristics/pace-bands.yaml#prediction_allowed_for` — `[display, goal_feasibility]` only, never `[pace_target, session_construction]`.
- `→ rule: heuristics/pace-bands.yaml#grade_adjustment_per_pct` — 0.03 default, `range 0.02–0.05`, applied only to sustained grade ≥3% longer than ~45 s (short dips are noise).
- `→ rule: heuristics/pace-bands.yaml#pace_source_staleness_days` — race 365, field_test 84, critical_speed 56, model_estimate 28; a stale source downgrades to effort bands automatically.
- `→ rule: heuristics/pace-bands.yaml#conflict_policy` — when pace and HR/RPE disagree by more than one band, the *lower* intensity governs an increase and the disagreement is surfaced in the comment as an observation.
- `→ rule: heuristics/safety-hard-stops.yaml#no_pace_target_from_prediction` — hard stop: any generated session whose target pace originates from a prediction (not a race/test) is rejected at build time.
