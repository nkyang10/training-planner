---
status: draft
last_reviewed: 2026-11-04
---

# Golden plans

Six fixtures, one per runner the plan has to be right for: novice 5K, competitive marathon, masters
40+, three days a week, returning after a layoff, trail ultra. They are the specification (see
[milestones.md](../../docs/roadmap/milestones.md), M1): the planner is correct when these pass, and a
rule change is *allowed* to break exactly the fixtures it should break.

## Fixture format

One JSON file per fixture, `*.json`, in this directory. The shape is the frozen `PlanInput`
(`packages/planner-core/src/types.ts`) minus `knowledge`, which is loaded from
`knowledge/heuristics/` so that a fixture never pins a knowledge version it did not choose:

```json
{
  "id": "novice-5k",
  "description": "First 5K, three days a week, no race date yet",
  "input": {
    "profile": { "...": "schemas/json/athlete-profile.schema.json" },
    "evidence": { "recentWeeklyKm": [8, 9, 10], "layoffDays": 0, "baselinePaceSecPerKm": 420, "baselineConfidence": "low" },
    "state": { "planStartDay": "2026-11-05", "horizonDays": 42 },
    "clock": { "today": "2026-11-04" },
    "seed": "golden-novice-5k"
  },
  "expect": {
    "sessionCount": 42,
    "firstDay": "2026-11-05",
    "lastDay": "2026-12-16",
    "restDaysMin": 2,
    "hardDaysMaxPerWeek": 2,
    "minHoursBetweenHardDays": 48,
    "weeklyIncrementPctMax": 12,
    "longRunMaxKm": 12,
    "invariantsHold": true,
    "planHash": null
  }
}
```

`expect` is an *invariant* set, not a snapshot: a snapshot that the planner itself produced proves only
that the planner is deterministic, which the determinism criterion already proves. `planHash` stays
`null` until a coach has read the plan; once signed off it is recorded here and the fixture then fails
if the plan changes for any reason - including a knowledge edit nobody meant to be behavioural.

## How they are run

`pnpm test:golden` runs `packages/planner-core/test/golden.test.ts`, which loads every fixture, generates
twice, requires the two runs to be byte-identical, checks the wire contract with
`packages/domain`, and checks every expectation above. A fixture that cannot be parsed is a failure,
not a skip: six fixtures means six, and a missing one is a red gate rather than a smaller test run.
