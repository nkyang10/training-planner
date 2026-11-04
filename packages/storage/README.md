# packages/storage

The persistence contract, and the in-memory adapter the HTTP tests run against.

```ts
const repository = createMemoryRepository();
repository.appendEntryWithEventAndPointer({ entry, event, superseded? });
```

## Two properties that live in the interface, not in the adapter's good behaviour

| Property | Why it is an interface rule |
|---|---|
| **append-only** | There is no update and no delete. A correction is a new row plus a pointer written in the **same call**, because three separate writes can fail between them and the failure mode is a log that disagrees with itself. |
| **idempotency is a uniqueness rule** | `appendEntryWithEventAndPointer` refuses a second row for a key that already exists (`DuplicateIdempotencyError`). A middleware cannot give that guarantee under a race; a unique index can. |

## Per-user isolation is structural

Every method takes `userId` first, and the in-memory adapter keys its whole state by it. A cross-user read is
not a check that can be forgotten — it is a lookup that cannot be expressed (AGENTS rule 7; the Postgres
adapter adds row-level security on top).

## The reference adapter is not a mock

`createMemoryRepository` enforces the same two rules the database will: the unique key and the append-only
pointer. That is why the API's end-to-end tests can run against it and still prove the discipline that Postgres
must keep.

## What is not here

- **No SQL.** The Postgres adapter lands behind this interface with RLS (ADR-0002), and it is the only place
  RLS is enforced.
- **No transactions object.** The interface names the *unit* of atomicity
  (`appendEntryWithEventAndPointer`) rather than exposing `begin`/`commit`; a caller that wants two writes in
  one transaction is a design smell this interface refuses to hide.
- **No migrations.** They belong to the schema PR that owns the DDL.
