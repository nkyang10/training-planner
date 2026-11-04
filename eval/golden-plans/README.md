---
status: draft
last_reviewed: 2026-11-04
---

# Golden plans

Seven fixtures, one per runner the plan has to be right for: novice 5K, competitive marathon, masters 40+,
three days a week, returning after a layoff, trail ultra, and one two-phase 10K whose whole reason for
existing is the first-week-of-phase reduction. They are the specification (see
[milestones.md](../../docs/roadmap/milestones.md), M1): the planner is correct when these pass, and a
rule change is *allowed* to break exactly the fixtures it should break.

## Fixture format

One JSON file per fixture, `*.json`, in this directory, validated by
[`fixture.ts`](fixture.ts) and described for non-TypeScript tooling by [`schema.json`](schema.json). The
shape is the frozen `PlanInput` (`packages/planner-core/src/types.ts`) minus `knowledge`, which the runner
loads from `knowledge/heuristics/` — a fixture must never pin a knowledge version it did not choose:

```json
{
  "id": "novice-5k",
  "description": "First 5K, three days a week, no race date yet",
  "input": {
    "profile": { "...": "schemas/json/athlete-profile.schema.json" },
    "evidence": { "recentWeeklyKm": [8, 9, 10], "layoffDays": 0, "baselinePaceSecPerKm": null, "baselineConfidence": "low" },
    "state": { "planStartDay": "2026-11-05", "horizonDays": 42 },
    "clock": { "today": "2026-11-04" },
    "seed": "golden-novice-5k"
  },
  "expect": {
    "sessionCount": 42,
    "firstDay": "2026-11-05",
    "lastDay": "2026-12-16",
    "restDaysMin": 4,
    "hardDaysMaxPerWeek": 1,
    "minHoursBetweenHardDays": 48,
    "weeklyIncrementPctMax": 10,
    "longRunMaxKm": 8,
    "invariantsHold": true,
    "planHash": null
  }
}
```

`expect` is an *invariant* set, not a snapshot: a snapshot the planner produced itself proves only that
the planner is deterministic, which the determinism criterion already proves. `planHash` stays `null`
until a coach has read the plan; once signed off it is recorded here and the fixture then fails if the
plan changes for any reason — including a knowledge edit nobody meant to be behavioural.

## The seven, and where each number comes from

Every expectation below is derived from the input plus a knowledge knob. None of them was copied from a
run; that is the difference between a fixture and a regression test of nothing.

| Fixture | Runner | horizon | rest days | hard days/week | weekly increment ceiling | long run ceiling |
|---|---|---|---|---|---|---|
| `novice-5k` | 3 days/week, no race date, no measurement | 42 | 4/week (the two unavailable days plus the knowledge minimum) | 1 | 10% (`weekly_increment_pct` 8 + tolerance) | 8 km |
| `competitive-marathon` | A-race 7 weeks out, 6 days/week, Sunday long run | 49 | 1/week (`rest_days_per_week_min`) | 2 (`hard_days_allowed` 2, `hard_days_cap` 2) | 10% | 24 km (32% of a 55-60 km week, `long_run_share_pct`) |
| `masters-40` | 45, unresolved load-sensitive Achilles, 4 days/week | 42 | 3/week | 2 | 7% (`weekly_increment_pct_conservative` 5 + tolerance) | 12 km |
| `three-days-a-week` | 3 fixed days, one hard day allowed | 56 | 4/week | 1 (`hard_days_allowed` 1) | 10% | 10 km |
| `returning-after-layoff` | 21 days away, restart from a reduced bucket | 42 | 3/week | 2 | 10% (the layoff rule subtracts *starting volume*, not the increment ceiling — see the note below) | 9 km |
| `trail-ultra` | trail 50 km in 10 weeks, 5 days/week | 70 | 2/week | 2 | 10% | 20 km |
| `two-phase-10k` | 10K race 8 weeks out, 4 days/week, plan starts on a phase boundary | 56 | 3/week | 2 | 10% | 12 km |

Notes on the two expectations that are easy to get wrong:

- **`masters-40` uses the conservative band.** The profile is at-risk twice over: age ≥ 40 selects the
  masters hard-day gap (96 h) and an unresolved `loadSensitive` injury selects
  `weekly_increment_pct_conservative` (5%). The ceiling in the table is 7%, which is 5% plus the rounding
  tolerance the golden test derives from the 0.1 km session rounding — not a different knob.
- **`returning-after-layoff` does not lower the increment ceiling.** `restart-after-layoff.yaml` reduces
  *starting volume* by bucket (`restart_volume_pct`: 90% at 0–6 days away, 80% at 7–13, and so on), and
  there is no post-layoff increment knob in the corpus. The fixture records the ceiling that actually
  applies and the layoff shows up as a lower first week, which is what the invariant is about.

### The two-phase 10K, and the expectation that encodes a rule

`two-phase-10k` exists because of one rule: the first week of a block is reduced
(`workout-dosage.yaml#first_week_of_phase_reduction`, 75%). A fixture that only asserts invariants cannot
see that rule, so this one carries `firstWeekVsRecentMax: 0.85`: week 1 must be at most 85% of the runner's
recent median weekly volume, both measured as 7-day-normalised rates.

Two details are deliberate. It is compared against the **recent median**, not against week 2, because a
plan that starts mid-week normalises differently and two consecutive reduced weeks can make week 2 look
smaller than week 1 while both are reduced - the comparison must be to the input, not to the calendar. And
the engine will not stack reductions: a phase boundary that lands the week after a down week or another
intro week is skipped, because two 25% cuts in a row is a hole, not a plan. Revert either rule and this
fixture goes red, which is what "encodes the reason" has to mean.

## How they are run

`pnpm test:golden` runs `packages/planner-core/test/golden.test.ts`, which loads every fixture, generates
twice, requires the two runs to be byte-identical, checks the wire contract with `packages/domain`, and
checks every expectation above. A fixture that cannot be parsed is a failure, not a skip: seven fixtures
means seven, and a missing one is a red gate rather than a smaller test run.
