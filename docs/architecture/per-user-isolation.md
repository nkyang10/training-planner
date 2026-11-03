---
status: draft
last_reviewed: 2026-11-03
---

# Per-user isolation (tenancy model)

"Per user basis" is a hard architectural requirement here, not a scaling afterthought: a runner's
health-adjacent data (pain logs, illness, HRV, sleep, location traces from GPS) is sensitive, and the
product's promise is that their season is *theirs*.

## Decision

**Single Postgres database, shared schema, row-level security keyed by `user_id`.** Rejected:
schema-per-tenant (migration pain, no cost benefit at this scale) and database-per-tenant (real
isolation the product does not need yet, and it breaks aggregate features we do want). Rationale and
reversibility: [ADR-0002](../adr/0002-single-db-row-level-security.md).

## Rules

1. **Every tenant-owned table has `user_id uuid not null` and an RLS policy** enabled with
   `USING (user_id = current_setting('app.user_id')::uuid)`. Policies are `FORCE ROW LEVEL SECURITY`
   so table owners are not exempt.
2. **The API connects as a non-superuser role** (`app_user`) and sets `app.user_id` per request in
   the same transaction it reads/writes. No connection may run as `bypassrls`. Background jobs use a
   `worker` role that still sets `app.user_id` per user, iterating users explicitly — a job that
   "reads everything" is the classic leak.
3. **Session-scoped auth**: auth provider issues `{userId, tz, locale, roles}`; the session cookie is
   bound to that user id; a second account on the same browser gets a separate session, never a
   switchable multi-tenant context.
4. **No cross-user code path in v1.** Aggregate analytics run in a separate, refreshable
   `analytics` schema populated by an ETL job that strips `user_id` (k-anonymity floor: an aggregate
   cell requires ≥ N users, default 20) and is read by a separate role. Individual training data
   never enters it.
5. **Third-party tokens are per-user, encrypted at rest** (per-library envelope encryption with a
   rotating key), never logged, revocable by the user in one action which immediately revokes the
   refresh token and stops background sync for that source.
6. **Media and files**: GPX/activity files under a per-user prefix with signed, short-lived URLs.
   No guessable public paths. A GPS trace reveals where someone lives — treat it as location data.
7. **Deletion is real.** `DELETE /me` purges or irreversibly anonymises within 30 days, including
   backups rotation, and removes the user from any analytics contribution. Export-then-delete is the
   documented happy path.
8. **Isolation is tested, not asserted.** An automated RLS suite attempts cross-user access on every
   table and every API route with user A's token against user B's object ids, asserting 404 (not
   403 — do not confirm existence). CI fails if a table lacks a policy. New tables without
   `user_id` fail a lint.

## Sharing, later, without breaking isolation

A future coach relationship is a **grant**, not a merged namespace: `access_grants(user_id,
grantee_user_id, scope, expires_at, revocable)` evaluated in the RLS policy as a secondary condition,
so a coach sees exactly the scope granted (e.g. plan + entries + comments, no notes, no device
tokens) and the grant is visible and revocable from the owner's settings. Read-only share links are
scoped, expiring, tokenised views — never a public JSON blob.

## Data classification (drives logging, retention, and export)

| Class | Examples | Handling |
|---|---|---|
| `health-sensitive` | pain notes, illness, HRV, sleep, menstrual notes, clinician clearance records | never in logs/analytics; field-level encryption; excluded from coach grants unless explicitly added |
| `performance` | activities, paces, load, plan versions, reviews | normal tenant storage; exportable |
| `operational` | job status, feature flags, error traces | may exist without `user_id` only if strictly non-attributable; ids hashed |
| `credentials` | provider tokens, webhooks secrets | encrypted, rotated, never returned by any read API |

## Environment & residency
Dev/staging use synthetic profiles only (`eval/golden-plans` fixtures are ideal test data); never a
prod dump. If EU users arrive, note GDPR health-data specifics (explicit consent, DPIR/DSAR paths,
standard contractual clauses for the LLM provider, and a documented subprocessor list) — decided
before marketing there, tracked in [ADR-0006](../adr/0006-llm-processing-consent-and-data-boundary.md).

## Backup / restore
Point-in-time recovery plus a per-user export/import round-trip test (the export format is the
restore contract). A restore that cannot reproduce a user's plan versions and comment history
byte-for-byte is not a restore of this product.
