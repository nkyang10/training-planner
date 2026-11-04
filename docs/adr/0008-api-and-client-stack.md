# ADR-0008: an API behind a repository interface, and a server-rendered client

Status: proposed
Date: 2026-11-04

## Context

M2's pure core is complete: the planner, the policy evaluator, the narrator and catalogues, the entry write
path, the review lifecycle and the explanation surface are all packages with tests. Nothing in that stack
reads a clock, touches the network or holds a database handle — that was deliberate, and it is why the core
could be built and measured before a product existed.

What remains in M2 is the running product: an HTTP API that appends entries and events transactionally, and a
client that a runner can use one-handed at 22:40. The repository currently has **no runtime dependency at
all** for either: `apps/api`, `apps/web` and `apps/worker` are READMEs, and there is no web framework, no ORM
and no database driver in `package.json`.

Two decisions are being made together because they constrain each other: how the API is shaped, and how the
client is built. The wrong version of either is expensive to reverse (a framework is a rewrite; an API shape is
a migration).

## Decision

### 1. The API is `node:http` + zod, with a repository interface

- **No framework dependency for the transport.** The API surface is small and stable — entries, events, plan
  versions, reviews, comments. `node:http` plus the generated zod contracts from `packages/domain` is enough,
  and it keeps the server's behaviour auditable: there is no middleware ordering to reason about and no
  framework upgrade in the trust path.
- **Persistence sits behind `Repository` interfaces** (`EntryRepository`, `EventRepository`,
  `PlanVersionRepository`, `ReviewRepository`, `CommentRepository`). The first adapter is **in-memory** and
  contract-tested, so the HTTP layer, the transaction boundaries and the tests can exist before a database
  does. The Postgres adapter lands behind the same interface with row-level security
  ([ADR-0002](0002-single-db-row-level-security.md)).
- **Transactions are explicit in the interface**: `appendEntryWithEventAndPointer` is one method because a
  correction that writes a row, an event and a superseded pointer in three calls can fail between them, and
  the failure mode is a log that disagrees with itself.
- **Idempotency is enforced by the repository**, not by a middleware: a unique constraint on
  `(user_id, day, revision)` and on the idempotency key is the only reliable version of "a double tap writes
  once" ([packages/entries](../../packages/entries/README.md)).
- **User identity comes from the session, never the body.** `userId` on the wire is audit, not authority
  ([ADR-0002](0002-single-db-row-level-security.md)).

### 2. The client is server-rendered HTML with progressive enhancement

- **No SPA framework yet.** The three screens that matter (calendar, day drawer, entry form) are lists and
  forms. Server-rendered HTML with partial swaps keeps the first paint cheap on a phone at 22:40, keeps the
  language catalogues in one place (`packages/i18n`), and means the client cannot invent a second vocabulary
  for the same concept.
- **One small client script**, plain TypeScript compiled by the existing toolchain: the offline queue
  (IndexedDB), the three-tap form state, and the optimistic "saved locally" indicator. It is the only
  JavaScript that must survive a bad connection, so it is the only JavaScript that gets to be stateful.
- **The client calls the same packages the API does.** A comment is rendered by `packages/narrator` in the
  server, and a plan explanation by the same function the CLI uses; the browser never re-derives a number.
- **Revisit trigger**: a screen that genuinely needs client-side state we cannot express as a form and a
  partial swap (a drag-to-reschedule week, a live session editor). When that screen exists, this ADR is
  superseded rather than quietly stretched.

## Consequences

- The API and the client can both be built and tested without a database or a cloud account; the in-memory
  adapter makes the HTTP tests fast and the contract tests independent of Postgres.
- The Postgres adapter is the only place row-level security is enforced, and it must be written against the
  same interface, not around it.
- Server-rendering means the client's offline story is explicit rather than assumed: a form that posts, plus a
  queue that replays with the idempotency key the entry pipeline already understands.
- Two things this ADR does **not** decide: the hosting topology (M6) and the worker's scheduling mechanism
  (`apps/worker`, still a README).
- The UI framework decision remains reversible at low cost: no component library, no build plugin, no
  framework-specific state lives in the repo.

## Alternatives considered

| Alternative | Why not now |
|---|---|
| Next.js / React | A large dependency and a second rendering model for three screens whose state fits in a form; it also makes the offline queue a framework concern instead of a small script. |
| A typed RPC layer (tRPC) | Attractive once the client is a SPA; with server-rendered forms the wire is small enough that zod-validated JSON endpoints are simpler to audit. |
| An ORM (Prisma/Drizzle) | The queries are few and the RLS policies are the point; an ORM hides exactly the layer that must stay visible in this product. |
| A framework (Fastify/Express) | Not wrong, but the transport is not where this product's risk lives, and every dependency in the trust path has to be defended. |

## Open questions

1. Where do `system_comments` rows live — a table of their own, or a column on the day's event? ADR-0007 says
   both narrator paths write an immutable row; the schema PR owns the answer.
2. Does the worker share the repository interface (it should), and does it need a separate transaction
   boundary for the nightly rollup?
