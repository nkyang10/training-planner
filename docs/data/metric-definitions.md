---
status: draft
last_reviewed: 2026-11-03
---

# Metric definitions (implementation contract)

The evidence behind each metric lives in
[`knowledge/signals-and-metrics/`](../../knowledge/signals-and-metrics/). This file is the
**implementation contract**: exact windows, edge cases, and — most importantly — *what a metric is
allowed to do*. A metric may be displayable without being actionable.

Columns below: **Window** = computation window; **Requires** = inputs without which the metric is
`null` (never 0, never guessed); **May drive** = `display` | `micro` (micro-adjustment) | `review` |
`safety`.

## Load

| Metric | Definition | Window | Requires | May drive |
|---|---|---|---|---|
| `load_sRPE` | `duration_min × rpe` (session-RPE) | per session | duration, rpe | micro, review, safety |
| `load_trimp` | Banister TRIMP: duration × ΔHR ratio × blood-lactate–velocity multiplier | per session | hr series, hr_max, rest_hr | micro, review |
| `load_normalized` | normalized power/pace-derived load (30 s EMA, 4th-power) | per session | power or grade-corrected pace | review |
| `weekly_load` | Σ session load (preferred source per user: sRPE when no HR) | rolling 7 d | any load source | micro, review, safety |
| `load_source_used` | which of the above is authoritative for this user-day | — | — | audit (must be shown when it changed) |

**Monotony** = `SD(daily load, 7d) / mean(daily load, 7d)`; **wellness-adjusted load** multiplies
session load by a recovery factor only for *display* (never used to justify adding load).

## Fitness / fatigue

| Metric | Definition | Window | Requires | May drive | Notes |
|---|---|---|---|---|---|
| `CTL` | EWMA of daily load, τ = 42 d | 6 wk EWMA | weekly_load | review, display | the "training load" trend |
| `ATL` | EWMA, τ = 7 d | 1 wk EWMA | weekly_load | micro, review | |
| `TSB` | `CTL_prev − ATL_prev` | daily | CTL, ATL | review, display | direction over 7 d matters more than level |
| `ACWR` | `ATL(7d) / CTL(28d)` | 7/28 | weekly_load | **display only** | mathematically coupled to recent change and noisy at low chronic load; **must not** fire a review on its own. See [acute-chronic-workload.md](../../knowledge/signals-and-metrics/acute-chronic-workload.md) |
| `ramp_rate` | ΔCTL per week | 2–4 wk | CTL | safety (clamp) | the knob `load-progression.yaml` guards |

## Recovery

| Metric | Definition | Window | Requires | May drive | Notes |
|---|---|---|---|---|---|
| `hrv_lnRMSSD_dev` | `ln(RMSSD)` vs rolling median, scaled by MAD (z-like) | 7 d rolling, **3 consecutive readings** rule | validated HRV readings | micro, review | single-day readings are noise by construction; measurement time-of-day must be consistent |
| `rhr_dev` | resting HR vs 28 d median (bpm) | 7 d | rhr | micro, review | |
| `sleep_debt` | `self_reported_need − sleep_h`, EWMA 7 d | 7 d | sleep_h | micro | when `self_reported_need` unknown, use trend only |
| `wellness_index` | weighted composite of legs/stress/mood/sleep | 7 d EWMA | tier-2 entries | micro | composite is *display-friendly*; individual components drive actions |
| `readiness_score` | **not implemented in v1** | — | — | — | a single composite is exactly the false precision this product avoids; compose at display time instead |

## Performance

| Metric | Definition | Window | Requires | May drive |
|---|---|---|---|---|
| `vdot_equivalent` / `pace_bands` | pace prediction from race/test evidence (Riegel-style distance extrapolation with clamp) | evidence-dated | race/test | review (pace re-baseline at phase boundary only) |
| `pace_at_hr_easy` | pace at matched HR on standardised easy/long loops | 4 wk trend | hr + gps, matched route | review, display |
| `hr_drift` | Δ%(avg HR second half − first half) on steady sessions | per session, 4 wk trend | steady session ≥ 40 min, hr series | review, display |
| `threshold_hr_est` | from LTHR test or 30-min best-effort (last 20 min avg HR) | evidence-dated | test | review (pace/zone re-baseline) |
| `durability` | decline in `pace_at_hr` between start and end of the long run | 4 wk | long run + hr | display, review |
| `economy_proxy` | not computed (lab-dependent) | — | — | — |

## Adherence & data quality (metrics *about* our data — these guard everything else)

| Metric | Definition | May drive | Why it exists |
|---|---|---|---|
| `completion_rate` | actual / prescribed load, weighted by `non_negotiable`, 7 d & 28 d | micro, review | under-adherence with rising RPE = plan too fast; under-adherence with easy RPE = plan too slow |
| `rpe_gap` | `rpe_actual − rpe_target` per session kind, 7 d mean | micro, review | the cleanest "is this pace band right?" signal without a lab |
| `log_continuity` | % days with an entry or a matched activity, 28 d | review (data-poor mode) | and it caps the *confidence* of every review |
| `log_quality_by_daytype` | log rate on hard vs easy days | display/internal | reveals self-selection bias in our own evidence |
| `hrv_data_sufficiency` | % valid readings, time-of-day consistency | gating | blocks HRV-driven actions when the data can't support them |
| `device_coverage` | % sessions with hr/gps | gating | a review must state which evidence it lacked |

## Cross-cutting implementation rules

1. **`null` beats a guess.** Every metric returns `null` with a `requires[]` reason; policy rules
   that receive `null` must not treat it as "normal". The engine's rule language makes `null`
   explicit — `hrv_dev < -1.5` must be false when `hrv_dev` is `null`, not accidentally true.
2. **Window is part of the identity.** `acwr_28_7` and `acwr_56_28` are different metrics with
   different meanings; no metric may be shown without its window in the label.
3. **Hysteresis on every actionable metric**: `trigger_threshold` and `clear_threshold` are separate
   in the YAML (see [anti-oscillation](../engine/review-trigger-policy.md#4-change-control-discipline)).
4. **Every metric stores `computed_at`, `inputs_hash`, `knowledge_hash`.** "Why does my chart say
   this?" is answerable for any past date.
5. **Vendor metrics are display-only by default** (training load scores, "readiness", "run
   command"): different, undisclosed formulas; useful colour, unacceptable authority. Any promotion
   to actionable requires a documented, reproducible definition first.
6. **Confidence propagates.** A review's confidence = min(evidence confidences it relied on), and the
   UI shows that number with its reason. Honest uncertainty is a trust feature (P5).
