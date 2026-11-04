# The SQLite adapter - what it is, and what it is not

`packages/storage/src/sqlite.ts` implements the `Repository` interface over Node's built-in `node:sqlite`
(`DatabaseSync`). The returned `SqliteRepository` adds one method the interface does not have: `close()`, which
releases the file handle (a file-backed database cannot be removed on Windows until it is called). It exists so a developer can run the API and the tests against a real database without a service,
and so the Postgres adapter has a reference that is not the in-memory one.

## What it carries

| Rule | How |
|---|---|
| one entry per `(user_id, idempotency_key)` | unique index; a second append throws and writes nothing |
| append-only rows | SQLite triggers refuse UPDATE/DELETE on entries, events, reviews, prompt deliveries, pain reports, comments, wizard answers, AI proposals, guidelines |
| correction | a new revision is appended and the previous row's `superseded_by` points at it - the one UPDATE the store performs |
| plan staging | proposed versions are separate rows; activation is an append-only log; `latestPlanVersionFor` matches memory |
| guidelines | global and versioned; duplicate `(id, version)` throws the same message memory uses |
| profile | upsert plus one revision row per save |
| consent | a switch: no row means never granted, which is not the same as revoked |
| per-user reads | every tenant statement carries `WHERE user_id = ?` |

## What it does not carry (do not read it as production tenancy)

- **Row-level security.** Isolation is a code convention here, not a database guarantee: anyone with the file or a
  connection can read every tenant's rows. Postgres RLS (`FORCE ROW LEVEL SECURITY` and the tenant policies in
  `schemas/sql/schema.sql`) remains the boundary.
- **Roles and grants.** SQLite has no roles, so `guidelines` is a plain global table and `listGuidelines()` returns
  internal rows. The API's operator check is what keeps internal guidance out of a runner's console here; in Postgres
  the operator grants plus RLS do it.
- **The TP401 trigger set's role-aware exception.** The SQLite triggers are stricter than Postgres for the `purger`
  role: there is no `purger`, no deletion log and no ordered purge path. Account deletion is not implemented.
- **The PL/pgSQL lifecycle guards** (`app.refuse_edit_of_active_plan`, the review-decision guard). Plan versions are
  immutable rows and activation is a log, but there is no plan `status` column and no role that distinguishes a
  lifecycle move from a content rewrite.
- **Cross-table foreign keys.** The memory contract has no users table, and a diff may be stored before the versions it
  names; inventing constraints would refuse writes the reference adapter accepts. Referential integrity is a Postgres
  migration concern.
- **Every CHECK in `schemas/sql/schema.sql`.** Domain objects are stored as JSON; only the keys and ordering columns the
  interface needs are projected. Contracts are validated at the edge and by the Postgres DDL. Prompt deliveries are
  re-validated because the memory adapter does.
- **Multi-writer concurrency.** `DatabaseSync` is single-connection and synchronous; a file is not a coordination point
  for several API processes.

## Two intentional differences from `memory.ts`

1. **Reviews are an append-only history with latest-row reads.** A decision is a new row; the opening row is never
   rewritten. The memory adapter replaces the row in place. Both expose the same `getReview`/`listReviews` semantics;
   the SQLite adapter keeps the history the Postgres DDL keeps.
2. **A replayed pain report keeps the first row** instead of replacing it, because the DDL's table is append-only.

Both differences are documented at the method that carries them, and both are covered by tests.
