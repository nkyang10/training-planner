---
status: draft
last_reviewed: 2026-11-04
kind: branch-brief
---

# spine/m2-daily-loop -- The daily loop, manual-first

Base branch: main   |   Milestone: M2 The daily loop, manual-first   |   Depends on: spine/m1-planner (closed 2026-11-04, merged) for the plan contract

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

If the loop does not close on a phone at 22:40, the product is a PDF generator.

Both launch blockers from [the end-user 5W1H self-review](../../review/2026-11-03-enduser-5w1h-review.md)
land in this spine: F1 (the daily prompt policy) and F2 (say how long today takes and what the alternate
gave up). They are not polish; the loop does not exist without them.

M1 closed structurally, so the loop can be built on a planner that is deterministic, invariant-clean and
traceable. What cannot be built here is the measurement: every M2 criterion is a number from real runners,
so this branch builds the loop and the phase closes only when those numbers exist.

## Write scope

- `packages/policy/**` - the pure evaluator: entry + plan + state -> structured decision
- `packages/narrator/**` - template-first comment rendering, LLM off by default
- `packages/i18n/**` - the message catalogues and their key-parity check
- `apps/web/**` - the calendar, the drawer, the entry-first quick log
- `apps/api/**` - entries, events and comments, with past days immutable at the API
- contracts stay in `schemas/` and change through contract PRs, never from this spine

## First pull requests, each one reviewable in an hour

1. `packages/policy`: the evaluator. Inputs are a day entry, the plan version it belongs to, and the
   runner's state; output is `{ commentFacts, adjustTomorrow?, flagReview? }`. Pure: no clock, no I/O, no
   LLM. It refuses to touch a day at or before the plan version's generation day, proposes at most two
   changes, and never adds load on the safety path.
2. `packages/narrator`: the fact object to strings, with `allowedNumbers` enforced at build - no number on
   screen that the engine did not choose - and the banned-output suite as tests, not style notes:
   diagnosis, weight and calorie prescriptions, guarantees and shame.
3. `packages/i18n`: `en` and `zh-Hant` catalogues with key parity checked in CI, so a missing key is a red
   build rather than a fallback language leaking into the comment.
4. Calendar home plus day drawer; entry-first quick log at three taps, one hand, offline, with idempotency
   keys so a double tap is one entry and a correction is a revision with a reason rather than an edit of a
   past day.
5. Explanation surface: `explain` and the comment state the 7-day-normalised rate when the first or last
   week is partial (M1 finding F3), and every alternate states what it gave up (end-user finding F2).

## Definition of done

- [ ] A runner logs a day in three taps with one hand, offline
- [ ] The loop runs end to end on a real device: plan -> entry -> comment -> optional review
- [ ] No number on screen that the engine did not choose
- [ ] Every comment traces to a rule id and a knowledge anchor, asserted by a test over the fact object
- [ ] Past days are immutable in the API, not only in the UI
- [ ] Both languages complete; the banned-output suite green in both
- [ ] The M2 measurements exist as records under `docs/review/`, not as estimates

## Risks this branch carries

- Adherence is the business risk: instrument the entry from day one, because a loop nobody enters looks
  exactly like a loop nobody likes.
- The comment is half the product. A correct plan with a cold or confusing comment fails the same runner a
  wrong plan would.
- Three taps is a promise about the runner's evening, not about the form. If a field is only there because
  the database wanted it, it does not belong on the first screen.
