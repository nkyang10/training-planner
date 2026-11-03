# ADR-0001: Deterministic rule planner with statistical calibration; LLM for language only

Status: accepted
Date: 2026-11-03

## Context

Coaching heuristics are mostly *rules with numbers*: "hard days separated by 48 hours", "weekly
volume up ≤ 8–10%", "taper 2–3 weeks before a marathon", "if pain is worse the next morning, stop
adding load". At the same time, individual response to a given stimulus varies several-fold
([individual-differences](../../knowledge/physiology/individual-differences.md)), and a plan that
ignores that variance is generic. Meanwhile an LLM can produce fluent, confident, wrong training
advice — inventing distances, paces, and recovery prescriptions with no memory of what the runner
actually did.

Product constraints that decide this:
- A runner must be able to ask "why is this my session?" a month later and get the same answer.
- Safety must be auditable and subtract-only.
- We are a small team; a system whose outputs we cannot reproduce cannot be debugged or validated.

## Decision

The planner is **pure, deterministic, rule-and-constraint based**
([planner-engine.md](../engine/planner-engine.md)). Statistics enter in exactly two places:
(a) **calibrating coefficients** from the individual's own history (pace bands, RPE gap, personal
ramp-rate tolerance, wellness baselines) and (b) **ranking candidate plans** within the rule-valid
set. An **LLM is used only to produce language** — daily comments and review narratives — from a
structured `FactObject` it cannot extend, with numeric grounding validated on the way out
([ADR-0007](0007-llm-language-only-with-template-fallback.md)).

## Consequences

**Buys:** byte-identical reproducibility (golden-plan tests are the specification); per-decision
explainability (`ruleIds` + `knowledgeRefs` travel with each session); adversarially testable safety
(property tests over generated inputs); cheap operation (no model call on any numeric path); offline
capability for the loop's core.

**Costs:** rules need curation and versioning (the knowledge bundle is a real product artifact with a
lifecycle, not config); the plan can look "dumb" for odd cases until a rule exists — mitigated by
honest infeasibility output rather than silent improvisation; the calibration layer must be built
carefully or it becomes fake personalisation.

**Forecloses:** "just ask the model" plan generation; any UX where advice appears without a traceable
reason; automatic plan mutation justified only by model confidence.

**Revisit when** we have ≥ 10,000 runner-seasons of outcome data, at which point a learned ranking
model over rule-valid candidates becomes testable against the rules themselves — and would still
inherit determinism, explainability and subtract-only safety.
