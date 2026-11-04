# packages/signals

Rollups and signals computed from the append-only log and the plan. Pure, so a season can be re-explained months
later exactly as it was read at the time.

```ts
const { rollups, signals, unavailable } = computeSignals({ userId, today, entries, plan, knowledge, computedAt });
```

## Two outputs that are not the same thing

| Output | What it is |
|---|---|
| `signals` | contract-valid `Signal` objects (`schemas/json/signal.schema.json`), sorted by key so two runs diff cleanly |
| `unavailable` | corpus signals this build **cannot** compute, each with its reason — HRV, resting HR, sleep debt, ACWR, pace bands |

`unavailable` is the honest half. "No HRV" and "HRV is fine" are different claims, and a plan must never be
re-planned on a signal that was really an absence of data.

## What is computed today

| Signal | Window | What it says |
|---|---|---|
| `completion_rate` | `review-triggers.yaml#plan_too_big_thresholds.window_days` (14) | fraction of planned days that happened; `crossedThreshold` against `completion_rate_lt` |
| `rpe_gap` | 7 days | median of reported − prescribed effort; `consecutiveDays` counts consecutive **readings** (a rest day between two sessions does not break it); `crossedThreshold` against `rpe_gap_threshold` |
| `log_continuity` | 14 days | fraction of planned days that were logged, with `dataQuality` counts |
| `weekly_load` | ISO week | the plan's kilometres for the week containing today |
| `load_monotony` | 7 days | mean daily load ÷ sd, `crossedThreshold` against `monotony_band`; **insufficient** when the week is flat |
| `ramp_rate` | 2 weeks | this week's planned volume against the previous week's; **insufficient** when the previous week is zero |
| `pain_trend` | 7 days | highest reported pain, direction, and `crossedThreshold` at 7/10; **insufficient** when nothing was reported |
| `device_coverage` | 14 days | imported-day coverage; **insufficient** until a source is connected (M4) |

## Rules the package keeps

- **No clock, no network, no random.** `today` and `computedAt` are arguments; `inputsHash` is a sha256 of the
  canonical input, so the same log and plan produce the same signals.
- **The newest revision wins.** A correction replaces the *meaning* of a day, never its history.
- **A judgement is not a signal.** `rpe_gap` reports the streak length and whether the threshold was crossed; the
  review trigger owns "three consecutive readings". A signal that also decided would be a rule with no anchor.
- **Numbers come from knowledge.** Every threshold is a knob lookup; a missing knob throws instead of defaulting.

## What this package is not

- **It is not the review trigger layer.** It computes signals; opening a review from them is `packages/review`'s
  caller (backlog row 25).
- **It is not a load model.** sRPE/TRIMP/CTL/ATL/TSB need heart-rate data; they are in `unavailable` with that
  reason rather than approximated from distance.
- **It does not store.** The API computes them per request today; a worker will cache them once there is a reason.
