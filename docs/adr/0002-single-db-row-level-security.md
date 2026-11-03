# ADR-0002: Single Postgres database with row-level security

Status: accepted
Date: 2026-11-03

## Context

The product is per-user by requirement and health-adjacent by nature (pain, illness, HRV, sleep, GPS
traces that reveal home). Per-user isolation must be *total* and *cheap to reason about*, and the
team is small. Aggregate analytics are desirable later but must never be a reason to widen access.

## Decision

One Postgres database, one schema, `user_id` on every tenant table, and **Postgres row-level
security enabled and forced on every tenant table**, with the API role connecting per-request with
`SET LOCAL app.user_id` inside the transaction that touches data. Background workers iterate users
explicitly and set the same variable per user — no job reads across tenants.
Full spec: [per-user-isolation.md](../architecture/per-user-isolation.md).

## Alternatives considered

- **Schema-per-tenant** — clean blast radius, but every migration becomes an N-loop, connection
  routing gets clever, and backups/aggregation get worse. Cost without a matching benefit at our size.
- **Database-per-tenant** — real isolation, real ops burden, and it forecloses aggregate features we
  want (population heuristics, benchmarking) unless we build a separate pipeline anyway.
- **Application-layer filtering only** — one forgotten `where` clause is a breach. Rejected: RLS is
  the only mechanism that fails *closed*.

## Consequences

**Buys:** isolation enforced below the application; a CI suite that proves cross-user reads return 404
on every table and route; simple ops (one database, one restore); future coach-grants can be expressed
as an additional RLS condition rather than a data move.

**Costs:** connection pooling must preserve session variables (transaction-mode pooling with care);
every migration must include policies; a "read everything" analytics job needs its own role and an
explicit ETL with a k-anonymity floor; ORM features that bypass or batch across users must be linted
against.

**Revisit when** a customer requires contractual data residency in a specific jurisdiction, or an
enterprise/coach tier needs physical separation — then we shard by region on top of the same schema
and RLS design rather than replacing it.
