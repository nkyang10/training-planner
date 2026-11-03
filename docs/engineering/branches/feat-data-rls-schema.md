---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# feat/data-rls-schema -- Postgres DDL with RLS on by default

Base branch: spine/m0-contracts   |   Milestone: M0 Skeleton and contracts   |   Depends on: spine/m0-contracts

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Per-user isolation is a design input (AGENTS.md rule 7), and it is far cheaper to build in than to retrofit.

Finding F9 lives here too: export and delete are posture today, three hits and no endpoint.

## Write scope

- `schemas/sql/schema.sql`
- `apps/api/**`

## First pull requests, each one reviewable in an hour

1. DDL: every table carries user_id; policies default-deny; aggregate analytics only through an explicit grant
2. Tenant test that proves a cross-user select returns zero rows
3. Export (JSON + CSV + the safety record) and delete contracts, per safety-layer.md line 96

## Definition of done

- [ ] The leak test fails when a policy is dropped
- [ ] A runner can leave with their data and their loading history in one action

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

