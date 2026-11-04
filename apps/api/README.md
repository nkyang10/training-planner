# apps/api

The HTTP surface (ADR-0008): `node:http`, the generated zod contracts, and the packages' pure functions.
Thin by design — it validates, authenticates and persists; it does not plan.

```bash
API_TOKENS='{"dev-token":"<user-uuid>"}' PORT=8080 npx tsx apps/api/src/index.ts
```

## The daily loop, in one request

```
POST /entries  { day, outcome, sessionTaken, rpe, legs, idempotencyKey, ... }
  -> 201 { entry, comment: { text, sentences, nudge? }, adjustment?, chip?, review?, hardStop?, appliedRules }
  -> 200 { status: "duplicate", entry }        a retry, not a second row
  -> 400 { error: { code, detail } }           the contract refused it, naming the field
```

An entry goes in, `packages/entries` writes it, `packages/policy` decides, `packages/narrator` renders the
comment in the runner's language. The client never re-derives a number.

| Route | Purpose |
|---|---|
| `GET /health` | liveness plus the knowledge hash the process loaded |
| `POST /plan` | generate and store a plan version (profile, evidence, state, seed) |
| `GET /plan/:versionId` | read one version back |
| `POST /entries` | the daily loop |
| `GET /signals` | what the system currently believes about this runner (`packages/signals`), plus the signals it cannot compute and why |
| `GET /entries/:day` | revisions, the current one, and the comments rendered for that day |
| `POST /reviews/:reviewId/decision` | accept / decline / defer |

## Rules this layer keeps

- **The session owns the row.** `userId` comes from the bearer token; a `userId` in the body is ignored, and a
  generated plan is stamped with the session's user, so a profile cannot make a plan for somebody else.
- **`x-training-day` is the client's local day.** The 04:00 boundary is local
  (`docs/ux/calendar-and-time.md`), so the client says which day it is; the server never guesses from UTC.
- **The clock and the socket live here and nowhere else.** Everything below is a pure function with its own
  tests; `now` is injected so a test can freeze the day.
- **A duplicate is answered, not retried.** The retry path reads the stored row and returns it; the unique
  constraint in `packages/storage` is what makes the answer true even under a race.
- **No plan, no comment.** If no plan version covers the day, the entry is stored and the response says the
  comment waits for a plan. A comment about a plan the runner does not have would be a fiction.

## Not built yet

- The Postgres adapter: `packages/storage` defines the interface and ships the in-memory reference adapter.
- Real authentication: `createMemorySessions` maps bearer tokens to users for development and tests.
- Rate limiting, request logging, metrics: deliberately absent until there is a deployment to measure.
