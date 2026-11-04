# `packages/advisor` — the AI reviewer's request and its deterministic gates

ADR-0009 splits the review path in three: the operator's guidelines, the runner's console, and a model that decides
**whether** to propose a change. This package is the third part's pure half.

| Export | What it does |
|---|---|
| `buildAdvisorRequest(input)` | what the model may see: effective guidelines (latest version per id with `effectiveFrom <= today`), wizard answers and settings, the plan's days and hard days, recent entries and signals, the allowed vocabularies, and the first editable day (`today + freeze_window_days`). Returns the request plus `guidelineVersionHash`, `promptHash` and `knowledgeHash` for the audit row. |
| `validateProposal({ output, request, plan, today, knowledge })` | the gates: contract parse, decision/change agreement, reason vocabulary, number grounding, future-only and outside the freeze window, `fromKm` equals the plan's prescription, kind is one the plan uses, safety guidelines forbid adding kilometres, cost key in the vocabulary, **never adds weekly load**, and `needsHuman` when a pain report of 7+ is in context. |
| `advisorProposalSchema` / `ADVISOR_REASON_CODES` | the strict shape and the reason vocabulary; a new reason is a deliberate addition. |
| `ModelPort` | the port the caller implements. P1 tests use a fake; P3 wires a provider behind consent, budget and a circuit breaker. |

## What this package does not do

- No clock, no network, no randomness: `today` is an argument and the model is a port.
- It does not accept a change. `validateProposal` decides whether a proposal is **askable**; the runner's decision is
  the only thing that activates a plan version.
- It does not fall back itself. A rejected proposal returns `fallback: "deterministic-replan"` and the caller runs
  `packages/replan` — the deterministic path stays the live path.

## Why the gates are here and not in the prompt

A prompt is a request, not an enforcement. The model is treated as a claim, and every claim is re-checked against the
plan and the request. That is also why the request restates the rules: the model should not have to guess them, and
the validator should not have to trust that it did not.