---
id: plan-construction/quality-sequencing
title: "Quality sequencing: neuromuscular work before threshold work"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [plan-generator, review-engine]
last_reviewed: 2026-11-04
owner: unowned
supersedes: []
---

# Quality sequencing

## Facts

- Fast running is a **skill** before it is a **stimulus**. Strides — short, relaxed accelerations inside an easy
  run — train recruitment and coordination at almost no recovery cost (`strides_never_hard: true`,
  `session-classes.yaml`). Threshold work costs recovery by design.
- A runner who meets both in the same week meets the cheaper one first without losing anything, and meets the
  expensive one with a better-prepared body.
- The M1 coach review found the engine doing the opposite: "a first-5K runner gets the same quality kind in week 1
  as in week 6" (F5, [coach sign-off](../../docs/review/2026-11-04-m1-coach-signoff.md)). The corpus did not state
  a sequencing rule, so the engine could not apply one.

## Practice

**The first quality session of a block is neuromuscular; threshold work starts from the next quality slot.**

- The kind comes from the corpus, not from a literal: `session-classes.yaml#first_quality_kind` (`strides`).
  The engine reads it with `knowledge.text(...)` and refuses a value that is not a quality kind, because a planner
  that silently defaults is a planner that lies.
- A taper block keeps its own rule: a quality slot in a taper week is strides regardless of position, because a
  taper is not where intensity is introduced.
- The rule is **positional, not persona-specific**. It applies to every block for the reason in Facts: the ordering
  is a property of adaptation, not of one runner's history.

## Controversies

**The corpus also carries a stronger, unimplemented rule for novices.**
`session-classes.yaml#session_kinds_forbidden_by_persona` lists `threshold, tempo, cruise, interval, track_repeats,
mp` for `novice-first-5k`, and its rationale claims "the novice golden plan asserts mustNotContain for exactly these
kinds". Measured 2026-11-04: the golden fixture format has **no** `mustNotContain` field, the golden runner asserts
no kind list, and the engine gives a novice `tempo` from the second quality slot onward. So the corpus forbids a
kind the engine still prescribes, and no gate can see it.

That is a coaching decision, not a rename: either the forbidden list is the rule (and a novice's quality work is
not tempo at all), or the list is stale and should be narrowed. It is recorded as **backlog row 30** rather than
decided here, because deciding it silently would be the engine overruling the corpus it is supposed to read.

## Related

- `session-classes.yaml#first_quality_kind` — the knob this rule reads.
- `session-classes.yaml#strides_never_hard` — why the first quality session is cheap.
- [workout-library/strides.md](../workout-library/strides.md) — what the session is.
