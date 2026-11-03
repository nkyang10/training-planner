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

Two files joined that scope while the spine was open. They are listed here rather than absorbed
quietly, because an out-of-scope edit is exactly what a reviewer looks for and cannot see afterwards:

- `tools/check-claims.sql` — the DDL's structural checker. Deliberately outside `schemas/`:
  `schema.sql` is the thing under test, so it must not also contain the ruler measuring it.
- `docs/engineering/branching-and-github.md` — the merge-order rule this spine's two leaves hit
  (§ A prose backlink may only point at a file the branch already has). A branch-model lesson that
  dies in a closed PR body is a lesson the next person re-learns as a red build.

Both are spine work for the same reason as the naming gate: no leaf could have made them without
fighting the other leaves over shared files.

## First pull requests, each one reviewable in an hour

1. plan-version.schema.json: version, knowledgeBundleVersion, plannerVersion, inputsHash, sessions[], appliedRules[]
2. events.schema.json: append-only event envelope carrying user_id, tz and the 04:00 training-day boundary
3. schema.sql: tables, RLS policies default-on, (user_id, occurred_at) indexes, plus a cross-user read test that must fail

## Definition of done

- [x] All schemas parse in CI, and `tools/check-contracts.ps1` reports zero for parse, metadata, id,
      casing, enum-value and pending-file counters. Verified 2026-11-03: 7 files, 279 properties, six
      zeros, ratchet at 113/113. The `knowledge` job repeats this on every push.
- [x] `tools/audit-links.ps1` prints six zeros (anchors, missing YAML files, bad source ids, dead
      links, untracked targets, uncommitted corpus files) — 133 backlinks, verified 2026-11-03. Two
      things this line used to hide. The script only *prints*; it exits zero whatever it finds, so the
      gate is the CI step that parses those six numbers, not the script's status. And "zero" was
      reached only after both leaves were merged into the spine: while they were open, the leaf whose
      prose cited its sibling's contract really did print `DEAD LINKS: 1`, which is the ordering rule
      now written in [branching-and-github.md](../branching-and-github.md).
- [x] Isolation claims in ADR-0002 are verified by SQL tests, not asserted in prose. Three layers:
      the seven-probe leak test at the foot of `schema.sql` (it raises "leak test is blind" rather
      than passing quietly), `tools/check-claims.sql` reading the catalog back — each of its six
      claims negative-tested by breaking it on purpose — and the `ddl` CI job, which applies the file
      to Postgres 16 inside a transaction it rolls back, proves nothing persisted, then applies it for
      real and runs the checker.
- [ ] docs/data/ links point at the real files, and each contract names its owner. Links resolve
      (dead links: 0). The owner half is still open, and is not being closed by writing the same
      reviewer's name seven times: CODEOWNERS has one entry per contract today, and a per-file owner
      line that cannot disagree with it is decoration, not information. It becomes real at the first
      second contributor.
- [x] PR body names the rule this protects. Both leaves did, and the spine PR names the rule behind
      the two out-of-scope files above.

