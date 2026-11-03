# packages/planner-core

The planner. A **pure, deterministic function** (AGENTS rule 1): no wall clock, no randomness, no I/O,
no network, no LLM, no imports from `apps/`. Time, seed and knowledge come in as arguments, so the same
inputs produce a byte-identical plan -- including six months later, when the comment has to explain a
plan the runner no longer remembers.

    plan = generatePlan({ profile, history, calendar, feedback, clock, seed, knowledgeBundle })
      -> { version, sessions[], comments[], appliedRules[], diff? }

Inputs are validated against `schemas/json/athlete-profile.schema.json` and `day-entry.schema.json`;
`knowledgeBundle` is the parsed content of `knowledge/heuristics/*.yaml`, versioned into the output.
The safety layer runs **after** generation and may only subtract (`docs/engine/safety-layer.md`).

Correctness is measured by `eval/golden-plans/` (fixtures pending M1). Numeric behaviour lives in the
heuristics bundle, never inline here. See `docs/engine/planner-engine.md`, `docs/engine/feedback-loop.md`,
`docs/engine/review-trigger-policy.md`, ADR-0001 and ADR-0005.
