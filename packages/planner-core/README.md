# packages/planner-core

The planner. A **pure, deterministic function** (AGENTS rule 1): no wall clock, no randomness, no I/O,
no network, no LLM, no imports from `apps/`. Time, seed and knowledge come in as arguments, so the same
inputs produce a byte-identical plan — including six months later, when a comment has to explain a plan
the runner no longer remembers.

    generatePlan({ profile, evidence, state, clock, seed, knowledge, revisionRequest? })
      -> { version: PlanVersion, openQuestions: string[] }

`version` is the wire contract `schemas/json/plan-version.schema.json`, and it owns `sessions`,
`appliedRules`, `clampedKnobs`, `assumptions` and `warnings`. The output does not repeat those arrays: a
second copy is a second truth, and the copy is the one that goes stale.

**The signature was frozen on 2026-11-04** against `docs/engine/planner-engine.md` §1, the only document
that separates *evidence* (computed, read-only) from *state* (what the current plan's reality is). This
README and the M1 branch brief previously said `{ profile, history, calendar, feedback }` with an output
of `{ version, sessions[], comments[], appliedRules[], diff? }`. Both were corrected in the same change:
two documents disagreeing about a frozen signature is how the next person builds against the wrong one.
`comments` belong to M2 and `diff` is `diffPlans`, a separate call with its own frozen options.

Inputs are validated against `schemas/json/athlete-profile.schema.json` (zod mirror generated in
`packages/domain`) and `day-entry.schema.json`; `knowledge` is the parsed content of
`knowledge/heuristics/*.yaml` plus its content hash, and every numeric threshold comes from it by anchor
(`load-progression.yaml#weekly_increment_pct`) — never inline, never a default in the code.

The safety layer runs **after** generation and may only subtract (`docs/engine/safety-layer.md`);
`appliedRules[]` records every rule that moved a session, with its anchor, effect and severity, which is
the M1 branch brief's second definition-of-done item.

Correctness is measured by `eval/golden-plans/` (seven fixtures, one per runner archetype) and by
`checkInvariants`, which returns violations instead of throwing. The invariants are the ones AGENTS
rules 3–5 and planner-engine §6 name: 48 h between hard days, the hard-day cap, the weekly increment
ceiling, rest days that are rest, one session per calendar day, and safety that only ever subtracts.

See `docs/engine/planner-engine.md`, `docs/engine/feedback-loop.md`,
`docs/engine/review-trigger-policy.md`, ADR-0001 and ADR-0005.
