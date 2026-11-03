---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# feat/data-plan-version -- A plan version that can be re-derived

Base branch: spine/m0-contracts   |   Milestone: M0 Skeleton and contracts   |   Depends on: spine/m0-contracts

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

AGENTS.md rule 1 exists so a plan shown to a runner months ago can be re-derived and explained.

That requires the version record to name the planner version and the knowledge bundle version, not just the output.

## Write scope

- `schemas/json/plan-version.schema.json`
- `eval/golden-plans/**/expected.plan.json`

## First pull requests, each one reviewable in an hour

1. Draft the contract and the canonicalisation rule for inputsHash (key order, number formatting)
2. Round-trip fixture: same inputs produce byte-identical serialisation
3. Decide and document behaviour when the recorded knowledge bundle version is gone

## Definition of done

- [ ] Two runs on different platforms hash identically
- [ ] Out-of-range knob values are clamped and the clamp is recorded in appliedRules[]

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

