# packages/triggers

The corpus rules that turn signals into **review candidates**. This is where `review-triggers.yaml`'s `when`
clauses become code.

```ts
const { fired, candidate, unevaluable } = evaluateTriggers({ userId, today, signals, knowledge, manual? });
```

It **fires** and it **names what it could not evaluate**. It does not open a review and it does not suppress one:
`packages/review` owns the budget, dwell and cooldown, and two layers deciding the same thing is how a product ends
up with a review that opens twice.

## The rules implemented today

| Rule | Fires when | Presentation |
|---|---|---|
| `plan-too-big` | `completion_rate < completion_rate_lt` **or** ≥ `quality_misses_ge` hard sessions were missed in 7 days | offer at next open |
| `load-rising-too-fast` | `ramp_rate > load-progression.yaml#weekly_increment_pct` **or** monotony above its band | weekly summary |
| `response-not-landing` | `rpe_gap` crossed **and** the streak reaches `performance_decline_sessions` | offer at next open |
| `manual-always-allowed` | the runner asked | offer at next open |

**A quality miss is a skipped or missed hard session — never merely an unlogged one.** Absence is information, not
a miss, and the test that proves it feeds two unlogged days and asserts silence.

## Arbitration is data, not code order

Highest presentation wins (`interrupt-now` > `offer-at-next-open` > `weekly-summary` > `recorded`); at the same
level, the runner's own request wins, then the corpus order. Both tables are written down in `evaluate.ts` so a
reader can check *why* a particular review opened.

## The three rules that cannot run yet, and why

| Rule | Blocked by |
|---|---|
| `goal-feasibility` | the goal date is not carried on the plan version, so weeks-to-race cannot be computed |
| `life-changed` | profile constraints (available days, travel flags) are not part of the plan or the log yet |
| `stale-evidence` | `pace_bands` needs a field test or race result; a stale anchor must not be used silently |

They are reported in `unevaluable` with the missing signal, never skipped.

## A corpus inconsistency found while wiring this

`review-triggers.yaml`'s `load-rising-too-fast` rule names `load-progression.weekly_increment_pct_effective`, which
**does not exist** — the knob is `weekly_increment_pct` (8 %) with a conservative variant (5 %). The code uses the
knob that exists; the naming gap is recorded in the backlog so the corpus and the code do not drift apart.

## What this package is not

- **It is not the option generator.** Opening a review needs candidate plans with diffs and costs, and the engine
  that produces those is M3's re-planning engine. `GET /reviews/candidates` stops exactly there.
- **It is not a scheduler.** It answers "what does the evidence say now"; the worker decides when to ask.
- **It does not phrase anything.** `detail` is a fact string for the review's evidence section; the narrator owns
  the words a runner reads.
