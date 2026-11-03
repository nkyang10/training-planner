---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# feat/planner-core-hard-day-gap -- The hard-day gap constraint (stacked demo)

Base branch: feat/planner-core-session-types   |   Milestone: M1 Headless planner, correctness first   |   Depends on: feat/planner-core-session-types (stacked)

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

This is the stack demo: base branch is a leaf, not the spine, and the PR states stacked on, do not merge before.

recovery.yaml#hard_day_gap_hours is the single owner: 48h default, 72h after a quality day, 96h at 40+. One owner, one code path.

## Write scope

- `packages/planner-core/src/constraints/hard-day-gap.ts`

## First pull requests, each one reviewable in an hour

1. Constraint that reads the knob plus its range, with the masters override
2. Fixture that fails if a second copy of the number appears in code

## Definition of done

- [ ] Out-of-range values clamp and the clamp shows up in appliedRules[]
- [ ] The system comment can cite the rule id without inventing a number

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

