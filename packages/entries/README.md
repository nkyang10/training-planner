# packages/entries

The write path for daily feedback: one draft in, one accepted / duplicate / rejected result out.

```ts
const result = submitEntry(draft, log, { userId, today, occurredAt, knowledge });
// { status: "accepted", entry, event, superseded? }
// { status: "duplicate", entry }                 <- a retry, not a second row
// { status: "rejected", code, detail }           <- future-day, invalid-entry, missing-correction-reason, ...
```

Pure: `today`, `occurredAt`, `userId` and the knowledge bundle are arguments, so a replayed submission
produces the same rows and the same ids on any machine. Append-only: nothing here mutates the log it is
given, and a correction returns a pointer for the API to write onto the superseded row rather than
rewriting history (AGENTS rule 4).

## The four rules this package exists to enforce

| Export | What it does |
|---|---|
| `painReportsOf({ userId, entry })` | projects the entry's pain array into rows shaped like `pain_reports`, with ids derived from the entry's identity, so a replay or a re-derivation writes the same row |
| Rule | Why it is worth a package |
|---|---|
| **A retry never writes twice** | `idempotencyKey` is unique per (user, day, revision); a double tap on a flaky train returns the first entry and no second event. Every adherence number depends on this. |
| **A correction is a new revision** | `revision + 1`, `correctedFromRevision` set, the old row untouched, `superseded` returned for the API to point the old row forward. Derived metrics recompute from the corrected view; a review that already consumed the old value keeps its snapshot. |
| **The past is bounded** | no future days; a backfill older than `missed-session-rules.yaml#unlogged_backfill_grace_hours` (72 h) needs a reason, whether it is a correction or a first entry. |
| **The contract decides what a row is** | the assembled entry is parsed with `dayEntrySchema` and the event with `eventSchema`. A client cannot write a row the database cannot hold. Coherence rules are checked first so the rejection names the field (`outcomeDetail is required when outcome is skipped`) instead of a root-level "does not satisfy". |

## What it deliberately does not do

- **It does not mark a day `missed`.** The rollup that closes a day is the worker's job, and the event
  catalogue has no `entry.missed` type yet. `pendingDays()` lists the days that closed without an entry;
  inventing the event type here would be a second catalogue. The gap is recorded in the backlog.
- **It does not create pain reports.** `pain` is stored on the entry and excluded from the event payload
  (ADR-0006: logs are copied and exported); a `pain_report` row with its own id is the follow-up.
- **It does not store anything.** `apps/api` owns the transaction that appends the row, the event and the
  superseded pointer together.

## Helpers the rest of the loop uses

```ts
entriesForDay(log, day)   // every revision of one day, oldest first
resolveCurrent(log, day)  // the revision a reader should treat as current
pendingDays(log, today, firstDay, lastDay)  // days that closed with no entry
```
