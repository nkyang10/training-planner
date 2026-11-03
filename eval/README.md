# `eval/` — planner evaluation

Two kinds of evaluation, because they answer different questions:

| | Question | Mechanism |
|---|---|---|
| **Golden plans** | *Did the planner produce the plan we agreed it should?* | fixture in → full `PlanVersion` out → compared to an approved expectation file |
| **Property tests** | *Can the planner ever produce something unsafe, in any input?* | `fast-check` generates random profiles/inputs; invariants must hold |

A rule change that breaks a golden plan is either a bug or a deliberate change of mind — and the diff
tells you which. That is the whole point: coaching rules here are **executable decisions under test**,
not prose that drifts from the code.

## Layout

```
eval/
  golden-plans/
    README.md              # format + how to approve a new golden
    novice-first-5k/
      profile.json
      inputs.json          # clock, seed, knowledgeBundle ref, evidence, state
      expect.json          # asserted properties, not a byte snapshot (see below)
    competitive-marathon/
    masters-40plus/
    time-poor-3-days/
    returning-after-layoff/
    trail-ultra/
    regression/            # fixtures that encode "this used to be wrong, never again"
      2026-11-03-hard-days-adjacent.json
    safety/                # adversarial fixtures — see below
      red-flag-chest-pain.json
      suspected-bone-stress.json
      fever-below-neck.json
      too-much-too-soon.json
      missed-3-weeks-return.json
  property/
    invariants.spec.ts
  README.md                # this file
```

## Golden plan format: assert properties, not bytes

A full byte snapshot of 12 weeks of sessions is unmaintainable and hides what matters. Each
`expect.json` asserts the decisions a coach would sign off on:

```jsonc
{
  "season": { "phases": ["Base","Build","Race","Taper"], "taperDays": [14, 21] },
  "weeklyVolumeKm": [ { "week": 1, "between": [28, 34] }, { "week": 8, "maxRampPct": 10 } ],
  "hardSessionsPerWeek": { "max": 2, "minFromWeek": 4 },
  "hardDaySpacingHoursMin": 48,
  "longRun": { "peakKm": [28, 32], "peakWeekOffsetFromRace": 4 },
  "sessionKinds": { "mustContain": ["longRun","threshold","easy"], "mustNotContain": ["trackIntervals"] },
  "paceBands": { "easyPaceSlowerThan": "5:40", "primaryTargetOnEasy": "rpe" },
  "taper": { "volumeDropPct": [30, 45], "intensityRetained": true },
  "safety": { "hardStops": [], "constrains": ["heat"] },
  "openQuestionsMin": 0,
  "explainRequired": true
}
```

Plus a `planVersion.hash` recorded in `expect.hash` for **regression detection only**: when the hash
moves, we print the semantic diff and either approve it (update `expect.*`) or fix the planner. A hash
change with no semantic diff is the "silent rule change" alarm; a semantic diff without a deliberate
decision is a failed build.

## The safety fixture set (non-negotiable, grows forever)

Every safety incident class gets a fixture asserting the *minimum* correct behaviour: hard stop fired,
session removed (never added), referral text present, and **no volume added anywhere in the plan**.
These are the fixtures that make a rule change scary in the right way.

## Property invariants (run over generated inputs)

1. No two hard sessions within 48 h (unless a documented exception rule fired).
2. Weekly volume ramp ≤ the persona's configured ceiling, always.
3. Safety actions are monotone: `sessions(planWithSafety) ⊆ sessions(planWithoutSafety)` in load terms.
4. Every prescribed value is within its knob's `range` (typo containment).
5. Determinism: `generate(i) === generate(i)` byte-for-byte; different `seed` ⇒ a *different but
   equally valid* plan (validity asserted, not equality).
6. `openQuestions[]` is non-empty whenever the request is infeasible — the planner may never silently
   drop a goal.
7. No session exists before the start date or after the horizon; nothing mutates a past day.
8. `explain.ruleIds` is non-empty for every session (an unexplainable session is a bug).

## Workflow

```bash
pnpm planner gen eval/golden-plans/novice-first-5k            # print a plan
pnpm planner diff eval/.../old.json eval/.../new.json         # semantic diff
pnpm vitest run eval                                          # all goldens + properties
pnpm vitest run eval --update-golden masters-40plus           # after a deliberate decision
```

`--update-golden` requires the diff to be pasted into the PR description, and a planner change is not
"done" unless the prose rule file and `knowledge/` note that justify it were updated too
(see [AGENTS.md](../AGENTS.md#definition-of-done-for-a-planner-change)).
