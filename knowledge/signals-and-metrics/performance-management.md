---
id: sig-performance-management
title: Performance management — chronic/acute load, form and readiness
status: contested
confidence: medium
evidence: [meta-analysis, rct, cohort, review, vendor]
applies_to: [all users]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S5, PHYS-S6, PHYS-S9, PHYS-S12]
---

## Key takeaways

- The chronic-load / acute-load / "form" trio is a **view of the log**, not a measurement of the athlete. Chronic training load is an exponentially weighted average of the user's own load score; it carries no information the log doesn't already have.
- The trio's intellectual parent — the impulse–response model — *is* real and was validated in running [PHYS-S5, PHYS-S6], but the consumer trio drops the fitted parameters (`k`, `τ_f`, `τ_s`) and replaces them with fixed windows (**42 and 7 days**) that nobody validated for recreational runners.
- **"Form" (fitness − fatigue) is the least trustworthy of the three** and the most tempting to act on. Its numeric range has no external referent: a form of −25 means nothing outside the user's own history and counter scale.
- The defensible use is **descriptive and within-user**: "you are carrying more recent load than in the last 3 months", plus a taper heuristic. Injury-risk inference belongs to `signals/acute-chronic-workload.md`, where it is already contested.

## Definitions and formulas

Let `L_d` be the session-load score (see `signals/session-load-metrics.md`) on ISO day *d*, with days without training contributing 0.

```
EMA(x, N)      : exponentially weighted moving average with time constant N days
                 α = 1 − exp(−ln(2)/(N/3))   (half-life N/3 convention)
CTL (fitness)  : EMA(L_d, 42)      # chronic training load
ATL (fatigue)  : EMA(L_d, 7)       # acute training load
TSB (form)     : CTL_prev − ATL_prev   # computed on the prior day's values
CTL change     : CTL(d2) − CTL(d1) ≈ 7·(L̄_recent − CTL) / 42   # ramp ≈ (weekly load − CTL·7)/42
```

Equivalent continuous form of the same idea (impulse–response, [PHYS-S5, PHYS-S6]):

```
perf(t) = P0 + k·Σ TL_i·e^{−(t−t_i)/τ_f} − k·Σ TL_i·e^{−(t−t_i)/τ_s}
```

with the *consumer* mapping `τ_f ↔ 42 d`, `τ_s ↔ 7 d`, `k = 1`, and no fitting.

| Variant | Definition |
|---|---|
| Rolling-window CTL | simple mean of daily load over 42 days instead of EMA (linear rather than exponential weighting) |
| "Fitness" (performance predictor) | fitted `k` on τ_f/τ_s with a performance time series; requires ≥3–4 performance data points |
| Readiness / "training readiness" | vendor composite of sleep, HRV, RHR, load; grade D |
| "Optimal zone" for CTL | the load level at which the user's recent performance was best — needs performance data, otherwise it is a restatement of history |

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| Fitness and fatigue respond to load with different time constants | **B** | Morton/Fitz-Clarke/Banister 1990 in running, PMID 2246166 [PHYS-S6]; Banister & Calvert 1980 [PHYS-S5] |
| 42-day and 7-day windows are the right windows | **C → D** | convention from the TrainingPeaks implementation; **not** validated against a fitted `τ_f` in recreational runners. The original model estimates τ per subject and per metric |
| CTL "ramp rate" targets (e.g. ~5–8 load-points/week) | **D** | vendor heuristic expressed in an arbitrary unit; the *shape* (progress slowly) is grade A, the number is meaningless because the unit is |
| TSB (form) predicts performance or injury | **D** | no external validation; uninterpretable across users/counters |
| Fitted performance-prediction models can track performance | **B** | original modelling work [PHYS-S6] with small samples and *fitted* parameters — and only when a genuine performance series exists |
| Load history is a valid description of what the user did | **A (as description)** | it is the log itself; noise floor aside [PHYS-S9] |
| Vendor readiness/composite scores decide daily training | **D** | composite of partially validated parts; display only |

**Stance**: CTL/ATL/TSB are **grade C as description, grade D as prescription**. They may not set paces, may not schedule rest days by themselves, and may not be shown to the user without the counter name and unit ("load points, your own scale").

## Facts

- EMA(42) has a long tail: a hard block influences "fitness" for ~3 months, and a layoff takes ~4–6 weeks to visibly dent it. Users read the lag as "the app says I'm still fit"; it is arithmetic.
- CTL change is **approximately** driven by the gap between recent weekly load and current CTL: `ΔCTL_week ≈ (weekly load − 7·CTL)/42`. Consequence for the planner: to raise CTL by X load-points/week the user must add roughly `42·X/7` load-points per day — this is a *conversion*, not a target, and it inherits the noise floor of the load counter (~12% [PHYS-S9]).
- TSB is dominated by ATL: a single long session moves form far more than a week of consistency does, so the "form" line mostly reports yesterday.
- Fitted models need a **performance series** (races/time trials) and weeks of data; with fewer than ~3 performances and <10 weeks of load, they should be disabled rather than fitted to noise.
- Because the trio is derived from the same load counter, its trend inherits the counter's failure modes: HRmax drift, device changes, missing sessions (a missing day is a zero, which looks like tapering).

## Practice

- Show CTL as "recent average load" and TSB as "how much more than usual you've been doing lately" — honest labels, no false physiology.
- Use CTL only for **relative** statements over the user's own history (e.g. current CTL vs the 90-day max) and for the taper heuristic ("your recent load is well above what you've sustained").
- Rebuild the load series whenever the counter, device or HRmax changes materially, and mark the discontinuity in the UI instead of silently rescaling history.
- Prefer a direct rule ("no more than +10% weekly load") over a CTL-derived rule; the direct rule is easier to explain and test.

## Controversies

- **Does CTL mean anything beyond the log?** Its proponents treat it as a fitness proxy; the ratio/model critique literature argues derived load statistics create statistical artefacts and are not causal [PHYS-S12]. Stance: CTL = smoothed log, presented as such.
- **Should the windows be user-fitted?** Ideally yes (the original models fit τ); in practice, with 5–10 sessions/week and no lab, fitted τ values are unstable. Stance: keep windows configurable knobs, default 42/7, and never fit them from fewer than 12 weeks of load + 3 performances.
- **"Optimal form" before a race** — coaching folklore about a specific positive TSB number. Stance: taper by calendar logic (volume cut, keep frequency/intensity, see `physiology/fatigue-fitness-recovery.md`), never by a target form value.

## Worked examples — what the smoothing actually does

Smoothing constant `α = 1 − exp(−ln2 / (N/3))`: **CTL (42 d) α ≈ 0.0483**, **ATL (7 d) α ≈ 0.2571**,
a 21-day chronic window would be α ≈ 0.0943. CTL is therefore "load per day, heavily smoothed": a
constant 420 units/week converges to CTL ≈ 60.

| Weekly load | CTL before | `ΔCTL_week = (L − 7·CTL)/42` | Interpretation |
|---|---|---|---|
| 420 | 60 | **0.00** | equilibrium; TSB drifts to ≈0 |
| 450 (+7%) | 60 | **+0.71 /week** | slow build; ~4 weeks to move CTL by 3 units |
| 390 (−7%) | 60 | **−0.71 /week** | ordinary dip — not a detraining signal |
| 300 (−29%) | 60 | **−2.86 /week** | deload or missed block; CTL needs ~4–6 weeks to rebuild the same ground |

Two facts fall out of the arithmetic and both belong in the product: a single hard week barely moves
CTL, and CTL recovers its position far more slowly than ATL. Freshness "gained" in a taper is mostly
ATL falling — which is why TSB cannot be a training objective.

## Rest days, gaps, and travel

- A rest day contributes **zero load** to the series; a missing record contributes nothing. The two
  are not the same and mixing them silently shifts CTL by roughly one day's load every week.
- A gap of ≥7 days (illness, travel, injury) is a **series break for interpretation, not for data**:
  the curve continues, but the pre-gap comparison must be labelled; readiness windows restart.
- Re-entry after such a gap is governed by `restart-after-layoff.yaml`, not by CTL: a high CTL built
  over months does not authorise last week's volume on day one back.

## Vendor composites stay out of the loop

- Training Effect, Load Impact, Readiness-style scores and similar vendor outputs are **display
  facts**: stored verbatim with vendor name and version, never normalised into our load units, never
  used to justify a session change.
- If a vendor composite is shown next to our numbers, it must be visually separated and labelled as
  the vendor's; the app's own comment never cites it as a reason.
- Vendor algorithms change without notice, which makes them non-reproducible inputs — an additional
  reason they violate the planner's determinism requirement, independent of their evidence grade.

## Engine implications

The fitness–fatigue family stays in the display layer; the planner does not chase it.

- `→ rule: heuristics/performance-management.yaml#ctl_window_days` — 42, `range 21–84`; `→ rule: heuristics/performance-management.yaml#atl_window_days` — 7, `range 3–14`. Changing either invalidates stored history comparisons — record a `series_version`.
- `→ rule: heuristics/performance-management.yaml#missing_session_policy` — a missing day is `0` for load series and *flags the week as incomplete*; ≥2 unlogged days in a week disables all load-derived rules for that week.
- `→ rule: heuristics/performance-management.yaml#tsb_prescription_allowed` — `false`. TSB may appear in comments as description; it may not be a trigger input.
- `→ rule: heuristics/performance-management.yaml#min_series_weeks` — 12 weeks of load + 3 performances before any fitted model is enabled, `range 6–24`.
- `→ rule: heuristics/taper.yaml#trigger` — race date minus taper length (calendar-driven), with CTL used only to sanity-check that the volume cut does not fall below ~50% of a load the user has never carried.
- `→ rule: heuristics/readiness.yaml#vendor_composite_allowed` — display only; `→ rule: heuristics/readiness.yaml#local_readiness_inputs` — `[sleep_flag, rhr_deviation, lnrmssd_deviation, session_rpe, life_stress]`, each requiring its own per-user baseline (see `signals/hrv-and-wellness.md`).
