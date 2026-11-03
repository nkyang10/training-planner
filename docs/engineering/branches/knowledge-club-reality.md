---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# knowledge/club-reality -- Sessions the runner does not control (finding F3)

Base branch: main   |   Milestone: M2 The daily loop, manual-first   |   Depends on: none - knowledge root branch

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Club, group and pacing-partner: zero hits. The Tuesday speed night is decided by the group, not the plan.

This is not the coach-dashboard non-goal; it is a per-user input the model simply lacks.

## Write scope

- `knowledge/heuristics/uncontrolled-sessions.yaml`
- `schemas/json/day-entry.schema.json`
- `docs/ux/screens.md`

## First pull requests, each one reviewable in an hour

1. Entry intent with-others plus statusDetail
2. Rule: at most one plan-adjacent substitution per week, recorded as a review change with its cost
3. A parkrun counts as what it was - a hard day - and must respect the hard-day gap, never free volume

## Definition of done

- [ ] A fixture where Tuesday is decided by the club and Wednesday survives
- [ ] No rule in this branch can add volume

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

