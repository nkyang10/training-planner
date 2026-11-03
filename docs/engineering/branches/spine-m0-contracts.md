---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# spine/m0-contracts -- Contracts, DDL and row-level security

Base branch: main   |   Milestone: M0 Skeleton and contracts   |   Depends on: none - this is a root spine

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Every later branch writes against these shapes, so they are the expensive-to-reverse part of M0.

Two artefacts only: the versioned plan/events contracts and the Postgres DDL with RLS on by default.

ADR-0006 promises per-user isolation; this spine is where that promise becomes testable rather than intent.

## Write scope

- `schemas/json/plan-version.schema.json`
- `schemas/json/events.schema.json`
- `schemas/sql/schema.sql`
- `docs/data/*`

## First pull requests, each one reviewable in an hour

1. plan-version.schema.json: version, knowledgeBundleVersion, plannerVersion, inputsHash, sessions[], appliedRules[]
2. events.schema.json: append-only event envelope carrying user_id, tz and the 04:00 training-day boundary
3. schema.sql: tables, RLS policies default-on, (user_id, occurred_at) indexes, plus a cross-user read test that must fail

## Definition of done

- [ ] All schemas parse in CI; audit prints four zeros
- [ ] Isolation claims in ADR-0006 are verified by SQL tests, not asserted in prose
- [ ] docs/data/ links point at the real files, and each contract names its owner

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

