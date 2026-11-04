---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# spine/m1-planner -- Headless planner, correctness first

Base branch: main   |   Milestone: M1 Headless planner, correctness first   |   Depends on: spine/m0-contracts for the output contract

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

docs/roadmap/milestones.md calls this the highest-value milestone: the planner is the product.

Nothing here touches a screen. The interface is frozen first so client and planner can move in parallel.

## Write scope

- `packages/planner-core/**`
- `packages/domain/**`
- `eval/**`

## First pull requests, each one reviewable in an hour

1. Freeze the signature: generatePlan({ profile, history, calendar, feedback, clock, seed, knowledgeBundle })
2. Purity guard: a CI step that fails on Date, Math.random, fs, net or LLM imports inside planner-core
3. Rule registry: appliedRules[] records which knob fired, with its value and range

## Definition of done

- [ ] Golden plans are byte-stable across runs and platforms
- [ ] Every rule that can move a session appears in appliedRules[] with its reason

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)
