---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# feat/planner-core-session-types -- Day, session, week: the shared vocabulary

Base branch: spine/m1-planner   |   Milestone: M1 Headless planner, correctness first   |   Depends on: spine/m1-planner

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

F8: a day holds one session in the model, though the competitive-amateur persona has two quality days and sometimes a second easy run.

Two-a-day appears three times in the corpus, all physiology, nowhere in the data model.

## Write scope

- `packages/planner-core/src/types.ts`
- `packages/domain/**`
- `schemas/json/day-entry.schema.json`

## First pull requests, each one reviewable in an hour

1. Types: Day with sessions[1..2] and one shared daily load budget
2. Keep ACWR and the gap rules reading the day, not the session
3. Decision note for the second-session limit (easy or strength only)

## Definition of done

- [ ] Types and JSON schema agree; a fixture with a second session does not double-count load
- [ ] Nothing in this branch can raise total weekly volume

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

