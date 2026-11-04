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

## A proposed version is staged; acceptance activates it

| Call | Meaning |
|---|---|
| `savePlanVersion(version)` | the plan the runner trains from — saving one makes it **active** |
| `saveProposedPlanVersion(version)` | a review's offer: staged, not active, invisible to day lookups |
| `activatePlanVersionForDiff(userId, diffId)` | activate the staged version the stored diff predicts |

Two rules here are the reason this lives in the store and not in a handler:

- **A proposal is not a plan.** A staged version is not returned by `latestPlanVersionFor`, so a review that nobody
  accepted cannot change what the runner sees.
- **Activation goes through the diff.** The diff is the review's evidence and the version is what the runner
  agreed to; activating through the diff keeps the two from disagreeing, and it throws when either is missing.

The active pointer is the only mutable thing in the store besides the superseded pointer, and both are set in a
single call.

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
