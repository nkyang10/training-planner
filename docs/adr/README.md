# Architecture decision records

Small, numbered, append-only. One decision per file. We write an ADR only when a decision is
**expensive to reverse** or **surprising to a new reader** — not for every choice.

## Format

```
# ADR-NNNN: <title>
Status: proposed | accepted | superseded by ADR-XXXX
Date: YYYY-MM-DD
Context:  what forces are in play (product, constraints, prior art)
Decision: what we decided, in one paragraph of active voice
Consequences: what this buys, what it costs, what it forecloses
Revisit when: the concrete trigger that should reopen this
```

## Rules

- **Never edit an accepted ADR.** Supersede it with a new number and link both ways. Rationale that
  was true in 2026 is evidence in 2028.
- Disputed points stay visible: if the literature is contested, the ADR says so and names the
  knowledge file that carries the evidence ([knowledge/MAINTENANCE.md](../../knowledge/MAINTENANCE.md)).
- Each ADR names who was involved and what alternatives were actually considered.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-deterministic-rule-planner-with-statistical-calibration.md) | Deterministic rule planner with statistical calibration; LLM for language only | accepted |
| [0002](0002-single-db-row-level-security.md) | Single Postgres database with row-level security | accepted |
| [0003](0003-manual-first-logging-with-import-as-enrichment.md) | Manual-first logging; device import as enrichment | accepted |
| [0004](0004-immutable-plan-versions-with-stored-diffs.md) | Immutable plan versions with stored diffs | accepted |
| [0005](0005-micro-adjustment-and-review-as-separate-mechanisms.md) | Micro-adjustment and review as separate mechanisms | accepted |
| [0006](0006-llm-processing-consent-and-data-boundary.md) | LLM processing: consent, data boundary, and residency | proposed |
| [0007](0007-llm-language-only-with-template-fallback.md) | LLM language-only with a first-class template fallback | accepted |
