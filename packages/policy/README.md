# packages/policy

The daily loop's brain stem: one day entry in, one typed decision out.

```ts
const decision = evaluatePolicy({ entry, plan, today, knowledge, history });
// decision.commentFacts  -> the narrator's only input (a fact object, never prose)
// decision.adjustTomorrow? -> at most one change, always to a future day, never adding load
// decision.flagReview?   -> at most one review offer, never an edit
// decision.hardStop?     -> safety first: training stops, coaching is suppressed
// decision.appliedRules  -> every rule that fired, with its knowledge anchor
```

`checkDecision(decision, input, { knowledge })` returns the invariant violations, and it is kept outside the
evaluator on purpose: a check written by the code it checks agrees with it by construction.

## Why this package is separate from the narrator

AGENTS rule 2 says the LLM only produces language. The structural version of that rule is this split: the
evaluator decides, the narrator phrases, and the narrator receives **no numbers except
`commentFacts.allowedNumbers`**. A number in a comment can then only be a number a rule chose, and the
guardrail check (`daily-feedback-rules.yaml#comment-numbers-are-facts`) becomes a comparison instead of a
promise. `extractNumbers(text)` exists for that comparison.

## The precedence order is the contract

`docs/engine/feedback-loop.md` §3 fixes the order, and a later pass may never undo an earlier one:

```
safety-hard-stops  ->  missed-session-rules  ->  daily-feedback-rules  ->  review-triggers
```

Conflicts resolve by tier and then by "the more conservative action wins". The evaluator records rules in
that order, and `precedence-order` is one of its invariants.

## Caps

At most one micro-adjustment and at most one review flag per day. Both are single optional fields in
`PolicyDecision`, so the cap is a type, not a discipline.

## What is implemented

| Export | What it does |
|---|---|
| `dailyCostOf({ session, entry, knowledge })` | the daily trade-off as a fact object: a substitute for a quality session is priced by `session-substitution.yaml#equivalence_max_drop_pct`, an easy alternate costs the kilometres it did not cover, a cut quality session names planned and done. `null` on a good day, on extra work, and on a rest day |
| Group | Rules |
|---|---|
| safety | `chest-cardiac`, `fever-or-below-neck-illness`, `night-pain-or-bone-tenderness`, `pain-escalation`, `safety-text-first` |
| missed | `never-make-up`, `missed-easy-delete`, `missed-quality-swap-if-legal`, `missed-quality-drop-if-illegal`, `alternate-counts-as-met`, `extra-activity-subtracts`, `streak-reanchors-volume`, `unlogged-is-not-zero` |
| daily | `readiness-subtracts-only` (with `wellness.yaml#downgrade_magnitude_pct`), `no-comment-on-unlogged`, `comment-numbers-are-facts`, `comment-contract`, `pain-question-trigger` |
| review | `plan-too-big`, `suppression-and-dwell` |

Rules that exist in the corpus and are **deliberately not implemented** are in `NOT_IMPLEMENTED` with the
input each one is missing (`intent-rest-is-plan-evidence` needs a profile field the contract does not have;
`reds-flag-pattern` needs a 21-day performance window; `overreach-pattern` needs load monotony). An
unimplemented rule is a fact about this slice, and silence about it is how a rule quietly stops existing.

## The invariants, each with a red case

| Invariant | What it refuses |
|---|---|
| `no-past-edit` | a change on today, yesterday, or at/before the plan's generation day (AGENTS rule 4) |
| `never-adds-load` | any adjustment whose after-week is heavier than its before-week |
| `safety-subtracts-only` | a safety adjustment that does not reduce load (AGENTS rule 3) |
| `load-is-stated` | an adjustment that does not say what it did to the week |
| `facts-anchored` | a sentence whose rule is unregistered, whose anchor is wrong, or which did not fire |
| `tier-matches-registry` | an applied rule whose tier disagrees with the registry |
| `numbers-grounded` | a fact or nudge that prints a number outside `allowedNumbers` |
| `precedence-order` | rules recorded out of order |
| `comment-length` | more sentences than `comment-contract.max_sentences` |
| `silence-is-silent` | silence with sentences attached |
| `no-comment-on-unlogged` | a comment on a day the system marked `missed` |
| `hard-stop-first` | a hard stop that is not sentence one, not non-overridable, or not coaching-free |

`packages/policy/test/check.test.ts` breaks each of them on purpose. A green invariant with no red case is a
comment with a boolean in front of it.

## Purity

`tools/lint.mjs` applies the planner's purity rules to `packages/policy/src` as well: no clock, no
randomness, no I/O, no network, no environment. `today` is an argument, history is an argument, and the
knowledge bundle is an argument, so a decision printed six months from now can be reproduced from the same
three things and its knowledge hash.

## What this slice does not do

- It does not phrase anything: `packages/narrator` owns the words, the catalogues and the banned-output suite.
- It does not persist: entries, decisions and reversals are the API's business (`apps/api`).
- It does not measure: M2's criteria are numbers from real runners, and no unit test can claim a 30-second
  median.
