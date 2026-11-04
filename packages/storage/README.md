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
| `getAthleteProfile(userId)` / `saveAthleteProfile(profile, change)` / `listProfileRevisions(userId)` | the stored profile is written **together with** its revision row (a profile write without history is what `profile_revisions` exists to prevent) |
| `saveWizardAnswer(userId, record)` / `listWizardAnswers(userId)` | the onboarding wizard's rows, append-only (ADR-0009) |
| `saveGuideline(guideline)` / `listGuidelines()` | the operator's guidelines: **global**, versioned, and a duplicate `(guidelineId, version)` is refused rather than overwritten |
| `savePainReport(report)` / `listPainReports(userId)` | pain rows keyed by a derived id (a replay stores one row), ordered by day; included in the export |
| `exportDocument(repository, userId, exportedAt)` | the runner's data as one document (plan versions, entries, events, reviews, comments, prompt deliveries, pain reports) plus counts; the API and the web page both call it, so "my data" has one definition |
| `savePromptDelivery(delivery)` / `listPromptDeliveries(userId)` | the prompt log: append-only, per user, and the only place `packages/nudges` reads delivery history from |
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

## The SQLite adapter (a local database, not a tenancy boundary)

`createSqliteRepository({ filename })` implements the same `Repository` over Node's built-in `node:sqlite`
(`DatabaseSync`), so the API and the tests can run on a real database file with no service to start:

```ts
import { createSqliteRepository } from "@training-planner/storage";
const repository = createSqliteRepository({ filename: ":memory:" }); // or a file path
repository.close(); // file-backed databases hold the file open until this is called
```

It carries the rules it can carry: every tenant statement is keyed by `user_id`; the append-only tables refuse
UPDATE/DELETE through triggers; one entry per `(user_id, idempotency_key)`; a correction appends and points the previous
row forward; a duplicate guideline `(id, version)` is refused; consent is a switch, not a log.

**It is deliberately not a production tenancy boundary.** SQLite has no row-level security, no roles, no
`app.tenant_id()` predicate and no ordered purge path. The adapter's own header lists exactly what it does not
enforce, and the same list appears in [docs/engineering/sqlite-adapter.md](../../docs/engineering/sqlite-adapter.md).
Postgres remains the tenancy boundary: `schemas/sql/schema.sql` and its RLS policies are still the thing that makes
cross-user reads impossible rather than merely absent from the code.

## What is not here

- **No SQL.** The Postgres adapter lands behind this interface with RLS (ADR-0002), and it is the only place
  RLS is enforced.
- **No transactions object.** The interface names the *unit* of atomicity
  (`appendEntryWithEventAndPointer`) rather than exposing `begin`/`commit`; a caller that wants two writes in
  one transaction is a design smell this interface refuses to hide.
- **No migrations.** They belong to the schema PR that owns the DDL.
