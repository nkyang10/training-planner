# packages/review

The lifecycle of a re-planning offer. Pure, so the same evidence produces the same review id, and disciplined,
so a review cannot become a second plan change.

```ts
const opened = openReview({ userId, today, candidate, knowledge, options, renderCost });
// { status: "opened", review }        <- options are attached, because a review is never stored without them
// { status: "suppressed", reason }    <- budget | cooldown | dwell
// { status: "refused", code }         <- the option set broke a change-control rule

const decided = decideReview(review, { kind: "accept", optionId: "reduce" }, today, knowledge);
// accepted -> { applyFromDay, resultDiffId }, rejected, deferred, or refused
```

## The guards, and why each exists

| Guard | Rule | What it prevents |
|---|---|---|
| **budget** | at most `review-triggers.yaml#max_prompts_per_week` (1) invitation a week | a good review becoming a reason to mute the app |
| **cooldown** | no new review within `cooldown_after_accepted_review_days` (10) of an accepted one | re-reviewing stale evidence before the change has produced any |
| **dwell** | the same trigger may not fire again inside `dwell_days` (7) | hysteresis: re-reviewing the same week on the same evidence |
| **interrupt-now bypass** | a safety interruption ignores all three | suppressing a safety card because the runner already got a review this week is the failure the guards exist to avoid |

## Change-control rules the option set must satisfy

1. **At least two options** — a single option is a demand, and the wire contract requires two anyway.
2. **"Keep the plan" is exactly one option and it comes first** — the honest answer is always available.
3. **Every change carries a diff and a stated cost** — a "free" improvement is a sign the model is not
   modelling the trade-off.
4. **A safety-critical review offers reductions only** — an option with `loadDeltaPct > 0` is refused.
5. **At most `max_changes_per_review + 1` options** (3) — two simultaneous changes make the outcome
   unattributable.

Opening and assembling are one step on purpose: `review.schema.json` requires `minItems: 2` options, so a
review that cannot carry its options never exists at all.

## The decision

| Decision | Result |
|---|---|
| `accept` a change | `applyFromDay = today + freeze_window_days` (never today, never tomorrow), `resultDiffId` = the option's diff |
| `accept` keep-the-plan | a decision with **no diff** (`resultDiffId: null`) — keeping is a choice, not a change |
| `decline` | status `rejected`, reason recorded (it goes to the event log, not the review row) — a normal, non-punished outcome |
| `defer` | status `deferred` with a recheck day; a past day is refused |

A review whose every option has expired is `expired`, and `expireReviews` marks them in bulk. Expiry exists so
a plan nobody re-checked since week 6 of 16 can say so.

## Two option kinds (ADR-0010)

An option is an **edit** (a `diffId` with at most two changes) or a **replan** (a staged plan version plus an honest
`changeSummary`; never a diff). Assembly refuses a replan with no staged version, a replan with no summary, and a
replan that also carries a diff. The review-level change budget counts edits, not replans - a re-plan is a different
question, and the wire contract says which kind an option is.

## What this package does not do

- **It does not generate the options.** Candidate plans and their diffs come from the planner and the review
  engine; this package validates them, refuses the illegal sets, and owns the state machine.
- **It does not phrase the cost.** `renderCost` is injected, so the lifecycle never composes prose (AGENTS
  rule 2) and the narrator keeps owning the words.
- **It does not store the rejection reason.** The `Review` row has no reason field; the reason belongs to the
  `review.declined` event, which is where the log keeps it.
