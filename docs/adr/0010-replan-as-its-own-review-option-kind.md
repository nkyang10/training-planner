# ADR-0010: A re-plan is its own review option kind, not a two-change edit

Status: accepted
Date: 2026-11-04
Supersedes: —
Involved: product owner (direction D), build agent (design and evidence)
Alternatives considered: (a) express a re-plan as an edit option with a large diff; (b) raise the two-change limit for
re-plans; (c) make a re-plan a separate, non-review "plan request"; (d) give the review a second option kind —
chosen.

## Context

Direction D (ADR-0009) lets a runner change their orientation through the wizard. `POST /wizard/apply` stores the
folded profile; `POST /reviews/manual` records the change as evidence and offers the engine's **bounded** options.
Neither changes the plan, which is correct: the plan changes only when the runner accepts an option.

But a changed orientation, taken to its conclusion, is a **new plan**: the available days move, the phase layout
changes, and the weekly shape follows the new goal. That is not "at most two edits", and pretending otherwise would
either (a) truncate the change and call the remainder "the plan", or (b) raise the two-change limit, which is the one
rule that keeps a review from being a second planner.

The forces: the review is a promise of *bounded* change (AGENTS rule 5); the runner decides; the past is never
rewritten (rule 4); safety subtracts only (rule 3); every option states its cost; and a plan version is immutable and
stored with the diff that produced it (ADR-0004).

## Decision

A review may offer **two kinds of option**, and the kind is explicit in the wire contract:

| Kind | Carries | Counts as a change? |
|---|---|---|
| `edit` | a `diffId` whose diff has at most two changes | yes — the existing rule, unchanged |
| `replan` | a staged **plan version id** plus an honest summary (`changes`, `sessionsMoved`, `kmBefore`, `kmAfter`, `firstChangedDay`) and a stated cost | **no** — it is a different question, and the review's `changes_count` counts edits only |

Rules that do not relax for a `replan` option:

1. **The past and the freeze window are untouchable.** The new block starts on the week boundary at or after the
   first editable day (`today + freeze_window_days`); every day before it is kept exactly as the runner is committed
   to it, and the diff may only name days from the block start onward. A block that started mid-week would have a
   partial first week, and the week-over-week ceiling cannot be honest about a partial week.
2. **The planner's invariants are re-checked** on the new version (`checkInvariants`), including the safety layer.
   A re-plan that violates an invariant is not offered, whatever the model or the runner asked for.
3. **The change count is reported, not hidden.** `diffPlans` truncates at two changes and sets
   `changeCountWithinLimit: false`; the option carries that fact, and the sheet says "this re-cuts the block" rather
   than listing two edits and implying nothing else moved.
4. **The runner decides.** The option is staged, never active; accepting it activates the plan version, declining
   leaves the current plan untouched.
5. **Safety guidelines still bind.** A safety or medical guideline in effect can veto a re-plan that adds load; the
   same deterministic checks that guard an edit guard the replan.

## Consequences

**Buys.** A changed orientation can actually reach the plan without weakening the two-change rule or teaching the
review to lie about scope. The review sheet can tell the truth: "keep the plan" or "re-cut the block for your new
days", with the cost and the honest change count.

**Costs.** The wire contract gains a discriminated union (`kind`), so every consumer of `ReviewOption` must handle
both kinds; the review sheet needs a second rendering; and the review-level `changes_count` needs to say plainly that
it counts edits, not replan options. A `replan` option also needs an evidence source (the folded profile and the
history-derived evidence), which the review package does not have today — the caller must supply both.

**Forecloses.** "A re-plan disguised as two edits." "Raising the two-change limit for convenience." "A re-plan that
starts before today."

## Phases

| Phase | Content | Needs |
|---|---|---|
| P2f1 | this ADR + the pure proposal builder (`packages/replan`'s orientation module): generate the candidate version, diff it honestly, report the summary, prove past days are untouched and invariants hold | none |
| P2f2 | wire contract: `ReviewOption.kind` (`edit`/`replan`), `planVersionId`, `changeSummary`; review schema + fixtures + package validation; API route staging the option | none |
| P2f3 | the review sheet renders both kinds and states the honest change count; decision applies the staged version on accept | none |

## Revisit when

- A `replan` option is accepted and the runner says the change was larger than the summary implied: the summary is
  insufficient and must carry a per-week delta, not totals.
- A re-plan is refused by invariants that an edit would have passed: the two kinds may need different evidence.
- The model (P3) proposes a replan on its own: the guideline layer and the deterministic gates must decide whether a
  model may propose a replan at all, or only edits — that is a separate decision, not an implementation detail.
