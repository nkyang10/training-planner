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
| `GET /pain` | the runner's pain reports as rows, oldest day first, plus `trend` from `painTrendOf` (direction, days, peak, night-pain and gait-change flags). An accepted or corrected entry writes one row per report it carries, with ids derived from the entry so a replay is not a second report |
| `GET /season` | the plan's weeks with planned and done kilometres, sessions, hard days, logged days and one adherence rate - computed by `packages/season`, so the page and the JSON cannot disagree |
| `POST /reviews/advisor` (provider) | the port the route calls is built by `modelPortFromEnv` from `TRAINING_PLANNER_MODEL_ENDPOINT` **or** `..._BASE_URL` (the port appends `/chat/completions`), plus `..._API_KEY`, `..._NAME` (and optional `..._TIMEOUT_MS`). Missing variables mean **no port** (503 `no-model`). The port enforces a per-runner daily budget, a timeout, and a circuit breaker; budget and open-breaker answers are `200 budget-exceeded` / `200 circuit-open` with the deterministic fallback |
| live check | `eval/live/provider-live-check.ts` runs two simulated runners through the real endpoint; its observed results are recorded in [provider-live-check.md](../../docs/engineering/provider-live-check.md). It is manual, never CI, and never commits the key |
| `POST /reviews/advisor` (loop) | the AI reviewer's loop: requires **consent** (403 `consent-required`), a configured model port (503 `no-model`), builds the advisor request, calls the port, validates the answer and **always writes an audit row** (`ai_review_proposals`: guideline hash, prompt hash, model, output, verdict, fallback). A rejected proposal answers `200 rejected` with `fallback: deterministic-replan`; a valid one opens a review with `keep` + one edit option per change; a provider outage answers `200 model-failed` with the same fallback |
| `POST /reviews/orientation` | the ADR-0010 re-plan option: folds the stored profile with the recorded answers, derives evidence from the plan's own weeks, generates the candidate and **stages** it, opens a manual review with `keep` + `replan`, and returns the honest summary. `200 not-offerable` when the planner's invariants would be violated; `409 no-change` when the answers already match the stored profile |
| `POST /reviews/manual` | a review the runner asked for: a manual candidate (`ruleId: null`, so `openedBy: user-request`), the engine's bounded options, and an `orientation` block recording what the runner's un-applied answers would change. The review is stored; **no plan version is added and no option is applied** |
| `POST /wizard/apply` | `{ profile? }` → stores the folded profile with a `profile_revisions` row (`changedBy: runner`, `source: user`, leaf `diff`); answers 200 `unchanged` when nothing moves. **The plan is not touched**: the note says a changed orientation becomes a plan only through a review the runner decides |
| `GET /profile` | the stored profile and its revision history (`no-profile` when the runner has never saved one) |
| `POST /wizard/profile` | `{ profile }` → the profile the answers fold into (`applied` / `unapplied` steps), **preview only**: nothing is stored, and the note says a plan change still needs a review |
| `GET /admin/guidelines` | **operator only** (`Bearer <operatorToken>`); every version, internal ones included. Without a configured operator token the route is closed (403), not open |
| `POST /admin/guidelines` | **operator only**; validates the `guideline` contract, appends a version, and answers `409 duplicate-version` rather than overwriting history |
| `GET /wizard` | the onboarding steps plus `answers`, `current` (latest per step), `original` (first per step) and `progress` |
| `POST /wizard` | `{ stepId, answer, source? }`; validates the answer against the step, appends a revision, returns the record and the new `current`/`original` |
| `GET /console` | the runner's answers, original next to current, and the **public** guidelines only (an internal safety guideline never leaves the server) |
| `GET /export` | the runner's data in one document: plan versions, entries, events, reviews, comments, prompt deliveries, and counts that let a client check the file it received |
| `GET /prompts/next` | the daily prompt policy (`packages/nudges`): returns the sentence when a prompt may arrive, **records the delivery**, and answers `none` with the reason and budget otherwise |
| `GET /signals` | what the system currently believes about this runner (`packages/signals`), plus the signals it cannot compute and why |
| `GET /entries/:day` | revisions, the current one, and the comments rendered for that day |
| `GET /reviews/candidates` | what the corpus trigger rules say about the current evidence, and which rules could not be evaluated |
| `POST /reviews/open` | the whole chain: signals → triggers → bounded options → an open review (stores the review and its diffs; stores no plan version until the runner accepts) |
| `POST /reviews/:reviewId/decision` | accept / decline / defer. Accepting a change **activates** the plan version the review offered and returns `appliedVersionId`; keeping the plan activates nothing |

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
