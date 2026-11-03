# apps/api

HTTP surface for the web client: auth, profile, calendar, day entry, feedback, review decisions, plan
version reads. Thin by design -- it validates, authorises and persists; it does not plan.

Every query is scoped by `user_id` under Postgres row-level security (ADR-0002, `AGENTS.md` rule 7); a
request without an authenticated user cannot reach another user's row even by accident. Writes are
append-only for completed days (rule 4). Contracts: `schemas/json/`, DDL pending M1.
