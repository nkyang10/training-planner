---
status: draft
last_reviewed: 2026-11-04
---

# M1 implementation review — 2026-11-04

The record of what the first M1 slice actually measured, kept because the phase control's `gate:` claims
point at the suite and not at this file: this is the human-readable half, the suite is the ruler.

## What was built

| Piece | Content |
|---|---|
| `packages/domain` | zod mirrors of the seven contracts, generated from `schemas/json` by `tools/gen-domain-schemas.mjs` |
| `packages/knowledge` | the corpus loader: 34 files, knobs by anchor, content hash, out-of-range values refused at load |
| `packages/planner-core` | passes 0–3 + subtract-only safety pass, `checkInvariants`, `diffPlans`, civil date arithmetic with no `Date`, content-derived UUIDs |
| `packages/cli` | `gen`, `diff`, `explain`, with the work in `commands.ts` so it is testable without a process |
| `eval/golden-plans` | six fixtures, the frozen fixture format, a JSON Schema for tooling, and a README that derives every expectation from a knob |

## What the gates measured

| Claim | Measured by | Result |
|---|---|---|
| same inputs → byte-identical plan | `determinism.test.ts` | identical canonical JSON; seed changes only the identity; `clock.today` moves only `generatedAtDay` |
| 6/6 golden plans pass | `golden.test.ts` | six fixtures, each generated twice, validated against the wire contract, expectations checked |
| a rule change breaks exactly the fixtures it should | `mutation.test.ts` | hard-day cap 2→1 breaks only the marathon fixture; increment band 8→12 breaks the four default-band fixtures and not the two at-risk ones; rest minimum 1→2 breaks only the six-day week |
| invariants can fail | `invariants.test.ts` | one deliberately broken plan per invariant, seven in total |
| invariants hold for arbitrary inputs | `properties.test.ts` (fast-check) | 60 arbitrary profiles × horizons 7–120, no violations; shrinking reproduces the smallest failing week |
| a diff cannot touch the past | `diff.test.ts` | a change on a day ≤ the base version's generation day is ignored; three changes are capped at two with `changeCountWithinLimit: false`; a safety diff drops a load-adding change |
| the CLI works | `cli.test.ts` | all six fixtures generate clean plans through the CLI path; malformed fixture and malformed plan version are refused |
| the planner is pure | `tools/lint.mjs` | `Date`, `Math.random`, `process`, `fetch`, node I/O in `planner-core/src` fail the build |

## Defects the gates found (all fixed before the merge)

1. The knowledge loader assumed "one knob, one number"; the corpus has 129 range pairs, 75 null ranges and
   41 compound or enum knobs.
2. The weekly curve crammed a full week into a partial horizon.
3. Volume was silently lost when a week had a single running day.
4. Pace targets were not multiples of 5 s/km, which the wire contract requires.
5. `knob()` closed over the loader's map instead of `this.knobs`, so every "what if this knob changed"
   experiment changed nothing — the mutation test surfaced it.
6. The golden runner parsed `schema.json` as a fixture and failed at module load.

## What remains before M1 closes

Only the coach sign-off, which will be recorded at
`docs/review/2026-11-04-m1-coach-signoff.md` (not linked until it exists). It needs three generated plans in front
of a coach and their judgement of structure — which is exactly the thing this repository keeps insisting a
machine cannot substitute for.
