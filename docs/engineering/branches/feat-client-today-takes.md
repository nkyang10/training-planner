---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# feat/client-today-takes -- How long today takes (finding F2)

Base branch: spine/m2-daily-loop   |   Milestone: M2 The daily loop, manual-first   |   Depends on: spine/m2-daily-loop

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Duration is an input today and an output nowhere: two hits in 122 files, one of them onboarding.

The time-poor runner is not asking for 10km at easy pace; they are asking whether 42 minutes is enough.

## Write scope

- `apps/web/src/day/**`
- `schemas/json/plan-version.schema.json`

## First pull requests, each one reviewable in an hour

1. Contract field duration_estimate_min plus earliest_finish_at, derived from pace bands and warm-up
2. Calendar card and drawer render the clock before the distance
3. When remaining time is short, offer the already-specified alternate dose instead of truncating a key session

## Definition of done

- [ ] The time-poor fixture shows a 42-minute Wednesday with an earliest-finish time
- [ ] No promise wording: estimate, never guarantee (AGENTS.md rule 6)

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

