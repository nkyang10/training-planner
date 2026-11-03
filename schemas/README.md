# `schemas/` — the shared contracts

These files are the **source of truth for data shapes** across planner, API, worker, and web.
`packages/domain` builds zod schemas from them (or generates them from zod — either direction, but
never by hand twice). Anything a runner can see a consequence of is specified here, because a shape
two teams interpret differently is a bug that no test catches.

```
schemas/
  json/                     JSON Schema draft 2020-12
    athlete-profile.schema.json    who the runner is (slowly changing, versioned)
    plan-version.schema.json       an immutable generated plan
    plan-diff.schema.json          the visible delta between two versions
    day-entry.schema.json          the runner's daily feedback
    signal.schema.json             a computed signal with confidence
    review.schema.json             a review, its options, and its outcome
    events.schema.json             envelope for the append-only event log
  sql/
    schema.sql                Postgres DDL sketch: tables, RLS, key constraints
  README.md
```

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

## Validation & codegen (intended)

```bash
pnpm schemas:gen      # JSON Schema -> zod in packages/domain, and TS types
pnpm schemas:check    # every fixture and every stored payload validates; RLS sketch in sync
```

CI runs `schemas:check`; a plan version that fails validation is rejected at write time, not discovered
in the UI.
