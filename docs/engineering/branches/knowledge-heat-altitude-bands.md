---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# knowledge/heat-altitude-bands -- What heat cost today (finding F5)

Base branch: main   |   Milestone: M5 Autoregulation and calibration   |   Depends on: none - knowledge root branch

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

safety-layer.md line 104 says plans adjust down for temperature and humidity, and context.yaml gives direction. No runner-visible number exists.

A runner who ran 8km in 31C deserves to know what that 8km was worth.

## Write scope

- `knowledge/heuristics/context.yaml`
- `knowledge/risk-and-safety/*heat*`
- `docs/engine/safety-layer.md`

## First pull requests, each one reviewable in an hour

1. Band table with value, range, confidence and direction of adjustment
2. One sentence of stated cost in the comment template, effort-based, never a promise
3. Altitude arrival rule: first days are effort-capped, pace bands are off the table

## Definition of done

- [ ] Subtract-only holds; safety-owner review is required
- [ ] The cost sentence cites the band, so the narrator cannot invent a figure

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

