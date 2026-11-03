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

ADR-0002 promises per-user isolation through Postgres row-level security; this spine is where that
promise becomes testable rather than intent. (ADR-0006 is the separate promise about what may ever
leave the building for a model — it belongs to the narrator work, not here.)

## Also landed on this spine, because it is cross-cutting

`tools/check-contracts.ps1` plus the naming rule in [schemas/README.md](../../../schemas/README.md).
Two of the five existing contracts had drifted into `snake_case` keys while the other three were
`camelCase`, and nothing in CI could see the difference. A leaf branch could not have fixed that
without fighting the other leaves over the same files, so it sits on the spine. The rename happened
here deliberately: no stored payload exists yet, so it is a search-and-replace today and would have
been a migration after the first deploy.

## Write scope

- `schemas/json/plan-version.schema.json`
- `schemas/json/events.schema.json`
- `schemas/sql/schema.sql`
- `schemas/README.md`, `tools/check-contracts.ps1`, `.github/workflows/ci.yml` (naming gate, spine-only)
- `docs/data/*`

## First pull requests, each one reviewable in an hour

1. plan-version.schema.json: version, knowledgeBundleVersion, plannerVersion, inputsHash, sessions[], appliedRules[]
2. events.schema.json: append-only event envelope carrying user_id, tz and the 04:00 training-day boundary
3. schema.sql: tables, RLS policies default-on, (user_id, occurred_at) indexes, plus a cross-user read test that must fail

## Definition of done

- [ ] All schemas parse in CI, and `tools/check-contracts.ps1` reports zero for parse, metadata, id,
      casing and enum-value counters
- [ ] `tools/audit-links.ps1` prints six zeros (anchors, missing YAML files, bad source ids, dead
      links, untracked targets, uncommitted corpus files)
- [ ] Isolation claims in ADR-0002 are verified by SQL tests, not asserted in prose
- [ ] docs/data/ links point at the real files, and each contract names its owner
- [ ] PR body names the rule this protects (see the template)

