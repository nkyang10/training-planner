# `schemas/` — the shared contracts

These files are the **source of truth for data shapes** across planner, API, worker, and web.
`packages/domain` builds zod schemas from them (or generates them from zod — either direction, but
never by hand twice). Anything a runner can see a consequence of is specified here, because a shape
two teams interpret differently is a bug that no test catches.

```
schemas/
  json/                     JSON Schema draft 2020-12
    athlete-profile.schema.json    who the runner is (slowly changing, versioned)
    plan-version.schema.json       an immutable generated plan        (in flight, M0)
    plan-diff.schema.json          the visible delta between two versions
    day-entry.schema.json          the runner's daily feedback
    signal.schema.json             a computed signal with confidence
    review.schema.json             a review, its options, and its outcome
    events.schema.json             envelope for the append-only event log (in flight, M0)
  sql/
    schema.sql                Postgres DDL sketch: tables, RLS, key constraints (in flight, M0)
  README.md
```

The three marked files are listed because they are the remaining M0 deliverables, not because they
exist. The directory should not claim contracts it does not have: when the last one lands, the
marker moves from this list into the CI check that the set is complete (`PENDING CONTRACT FILES`).

## Rules

1. **Every field is documented with what it means, not just its type.** `primaryTarget: "rpe"` is a
   coaching decision; a type system cannot express that.
2. **Additive changes only** for stored shapes (`payload_version` pattern in
   [event-catalog](../docs/data/event-catalog.md)). A renamed field means a migration plus a replay
   fixture; a removed field means a data-loss review.
3. **Enums are decisions.** Every enum here has a matching entry in the knowledge base or an ADR, and
   adding a value requires the planner, the UI, *and* both message catalogues to handle it.
4. **Units are explicit in the field name or the schema** (`distanceKm`, `durationMin`,
   `paceSecPerKm`). Display conversion happens only at the edge.
5. **Nullable ≠ zero.** `null` means "not known"; `0` means "measured as zero". The planner treats
   them completely differently ([metric-definitions](../docs/data/metric-definitions.md)), so the
   schemas keep them distinct and never use sentinel values like `-1`.
6. `sql/schema.sql` is a **design sketch** that the real Drizzle migrations are generated against and
   reviewed against; it is not run in production. Its job is to make the RLS and constraint decisions
   reviewable in one file.
7. **Three namespaces, three spellings, no hand-mapping.** JSON contract keys are `camelCase`
   (`firstTouchedDay`), SQL columns are `snake_case` (`first_touched_day`), and knowledge knobs keep
   the `snake_case` they are written in inside `knowledge/heuristics/*.yaml`. Codegen owns the
   mapping between them; a caller never hand-writes the other namespace's spelling, because a
   hand-made mapping is where the same field starts meaning two things. Enum *values* on the wire are
   kebab-case (`move-session`), except identifiers copied verbatim from another namespace — a metric
   key like `load_sRPE`, or a heuristic anchor like `review-triggers.yaml#freeze_days` — which must
   declare themselves with `x-verbatim-enum-values` so the exception is visible inside the contract
   rather than being silent drift.
   Two of the five contracts had drifted into snake_case keys before this rule existed, and they are
   the two whose names appear in UI code. They were renamed on 2026-11-03, when no stored payload
   exists yet: this is a search-and-replace today and a migration with a replay fixture after the
   first deploy. Saying so is the point — the cheap moment is now, not later.
8. **`tools/check-contracts.ps1` enforces what can be enforced**, and runs in the `knowledge` CI job.
   It checks the draft, that `$id` matches the file's own path, that root metadata is present
   (`title`, `description`, `type: object`, `additionalProperties: false`), that keys are camelCase,
   and that enum values are kebab-case unless declared verbatim. It also prints an
   undocumented-property count as a **ratchet**: 116 of 226 properties today, allowed to go down and
   never up, so new fields arrive documented. The script cannot tell a true description from a
   invented one; that half of rule 1 stays a human review. A property named inside `if`/`then`/`else`
   is a condition on a field documented at its declaration, so it is casing-checked but not made to
   repeat a description that would only drift.

## Validation & codegen (intended)

```bash
pnpm schemas:gen      # JSON Schema -> zod in packages/domain, and TS types
pnpm schemas:check    # every fixture and every stored payload validates; RLS sketch in sync
```

CI runs `schemas:check`; a plan version that fails validation is rejected at write time, not discovered
in the UI.
