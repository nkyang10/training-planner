---
status: draft
last_reviewed: 2026-11-04
---

# Data model

Two load-bearing ideas:

1. **The event log is the truth.** Everything a runner did, said, or felt is an append-only fact.
2. **Everything computed is a derived, rebuildable view.** Metrics, rollups, comments' fact objects,
   notifications — all recomputable from events + rules. A metric-definition fix is a backfill, not a
   migration of history.

DDL: [`schemas/sql/schema.sql`](../../schemas/sql/schema.sql) — **this is the spelling authority**, and
CI proves it by applying it to a real Postgres 16 and reading the isolation claims back. Contracts:
[`schemas/json/`](../../schemas/json/). Every tenant table has `user_id uuid not null references
users(id)`, an RLS policy, and `created_at timestamptz default now()`.

**Read the tables below as the *reasons*, not as the definition.** They used to be a copy of the
column lists, and they rotted within days of the DDL existing: twenty-two such disagreements, each
measured and decided in
[contract-vocabulary.md](../engineering/contract-vocabulary.md). Where a name here and a name in the DDL differ, the
DDL is wrong *only if* that page says so — otherwise this page is wrong.

## Core tables

### Identity & settings
| Table | Purpose | Key fields |
|---|---|---|
| `users` | account | `id`, `email`, `tz` (IANA), `locale` (`en`\|`zh-Hant`), `day_start_hour` default 4, `onboarding_complete` |
| `athlete_profiles` | slowly-changing planning inputs (1 current + history) | `valid_from`, `valid_to`, `profile jsonb` — everything else (`injury_history`, `health_flags`, `availability`, `goal`) lives *inside* that document, validated by `athlete-profile.schema.json` at the edge, never re-typed as columns here |
| `profile_revisions` | audit of *why* the athlete changed what they changed | `changed_by`, `diff jsonb`, `source` (`user`\|`import`\|`review`) |
| `notification_prefs` | per-channel budgets | `channel`, `budget_per_day`, `quiet_from`, `quiet_to` |
| `provider_connections` | encrypted tokens | `provider`, `scope`, `token_enc`, `status`, `last_sync_at`, `error`; a CHECK makes "revoked ⇒ no token" structural rather than a test that only fails on the day a code path forgets |

### Facts (append-only)
| Table | Purpose | Notes |
|---|---|---|
| `events` | the log | `id bigserial`, `type`, `occurred_at`, `payload jsonb`, `actor` (`runner`\|`system`\|`worker`\|`import`\|`support`), `idempotency_key unique per user`, no `UPDATE`/`DELETE` grants to `app_user`. `actor` is five values because *who wrote it* decides whether the row may be corrected: an `import` can be re-run, a runner's word cannot. Partitioning is **not** implemented — the DDL says so and defers the strategy to the storage ADR |
| `day_entries` | what the runner reported about a day | `day`, `status` (`rest`\|`completed`\|`partial`\|`skipped`\|`missed`), `rpe`, `legs`, `sleep_h`, `stress`, `mood`, `note`, `source` (`manual`\|`voice`\|`import`), `timezone`, `submitted_at`. **A revision is a row, not a JSON array**: PK `(user_id, day, revision)` + `superseded_by`, read through the view `day_entries_current`. Pain is *not* a field here — it is `pain_reports`, because it has the lowest intervention threshold and needs its own history |
| `activities` | observed exercise | `provider`, `provider_activity_id`, `started_at`, `duration_s`, `distance_m` (**metres**: the unit the device speaks; weekly targets are km, the unit the runner plans in), `avg_hr`, `max_hr`, `hr_series bytea`\|`hr_zones jsonb`, `cadence`, `power`, `gpx_ref`, `raw_hash`, `provenance`, `quality_flags[]` |
| `activity_links` | planned session ↔ activity | `session_occurrence_id`, `activity_id`, `match_method` (`auto`\|`suggested`\|`manual`), `confidence` |
| `pain_reports` | first-class, because it has the lowest intervention threshold | `site`, `intensity`, `during_run`, `next_morning`, `trend_gait_change bool`, `day` |

### Planning
| Table | Purpose | Notes |
|---|---|---|
| `plan_versions` | immutable generated plans | `id`, `parent_version_id`, `status` (`draft`\|`active`\|`superseded`\|`archived`), `planner_version`, `knowledge_hash`, `inputs_hash`, `reason`, `created_from_review_id`. `knowledge_hash` is what makes a plan explainable years later (AGENTS rule 1), so it now carries the same `^sha256:…` CHECK as `inputs_hash` |
| `plan_weeks` | weekly targets | `iso_week_start`, `volume_km`, `longest_run_km`, `intensity_target jsonb`, `phase_id` |
| `phases` | dated phase blocks | `kind`, `start_day`, `end_day` (not `start`/`end`: `end` is reserved, and the pair should read like `first_day`/`last_day`), `purpose`, `exit_criteria jsonb` |
| `session_occurrences` | **the effective session on a date** (materialised: base + overrides) | `day`, `plan_version_id`, `kind`, `hard_day`, `non_negotiable`, `granularity`, `structure jsonb`, `targets jsonb`, `primary_target`, `summary_text`, `explain jsonb {ruleIds, knowledgeRefs}`, `alternate jsonb`, `state` (`planned`\|`adjusted`\|`cancelled`\|`done`). One row per day, rest included — rest is a prescription, and a missing row means something else. `state` is the **plan's** axis; what the runner reported is `day_entries.status`, and the two are deliberately not one vocabulary |
| `session_overrides` | micro-adjustments; **never mutate `session_occurrences`** | `kind`, `payload jsonb`, `reason_rule_id`, `fact_snapshot jsonb`, `accepted bool`, `reverted_at` — the snapshot is what lets a chip be re-explained after the knowledge file has changed |
| `plan_diffs` | stored parent→child diffs | `from_day`, `diff jsonb` (`plan-diff.schema.json`), `cost jsonb`; `plan_diff_changes` holds one row per change with its `reason`, `signal_id`, and `is_safety` |
| `reviews` | the review record | `opened_by` (`system-signal`\|`user-request`\|`post-race`\|`post-layoff`\|`phase-boundary`) — the wire's `openedBy`; the wire's *evidence* object (signals, rules, grade, streak) lands in `rule_id` + `evidence_snapshot` + `evidence_hash`, not in a column named `trigger`. `severity`, `changes_count`, `options jsonb`, `chosen_option_id`, `runner_reason`, `applied_plan_version_id`, `checkpoint_at`, `checkpoint_verdict`. Its `status` is the item-4 set — `open / accepted / rejected / deferred / expired / superseded` — and the CHECK now admits exactly those: a review row exists because it opened, so `suggested` is gone, and the runner's refusal is spelled `rejected`, not `declined`. Its `severity` is one of the three tiers, kebab in the column exactly as in the YAML and the wire (items 5, 6). |
| `safety_events` | flags, stops, overrides, clearances | `rule_id`, `tier`, `scope jsonb`, `acknowledged_at`, `override jsonb`, `clearance jsonb`; a CHECK refuses an `override` with no recorded `acknowledged_at` (AGENTS rule 3 as data) |
| `system_comments` | immutable narrated outputs | `day`, `rule_id`, `fact_object jsonb`, `template_id`, `narrator` (`template`\|`llm`), `model`, `text`, `locale`, `guardrail jsonb` — no UPDATE or DELETE policy, because the text a runner read three months ago has to be that text |

### Derived (rebuildable)
| Table | Purpose |
|---|---|
| `metrics_daily` | per user-day rollups: `load_trimp`, `load_srpe`, `ctl`, `atl`, `tsb`, `acwr`, `wellness_ewma jsonb`, `hr_drift`, `monotony`, `log_quality`, `requires jsonb` |
| `signals_current` | latest computed signal bundle per user (cache for policy evaluation) |
| `pace_estimates` | derived paces with `anchor_day`, `method`, `confidence`, `valid_from`, `valid_to` — a claim about a window, not a row that expires |
| `analytics.*` | de-identified aggregates, separate role, k-anonymity floor, no `user_id` |

## Key constraints that encode product rules

| Constraint | Encodes |
|---|---|
| `events`, `day_entries`, `system_comments` have **no `UPDATE`/`DELETE` policy** *and* a `refuse_mutation` trigger; `plan_versions` has update and delete policies and is held instead by `plan_versions_immutable` (`before update`, once the version is `active`) | "never change the past" (AGENTS rule 4). The three facts are append-only by permission — a draft plan version is still editable, an `active` one is not |
| `day_entries (user_id, day, revision)` unique | append-only revisions per day |
| `activities (user_id, provider, provider_activity_id, revision)` unique | idempotent sync |
| `session_overrides` FK to a *future* `session_occurrences.day` (checked in a trigger) | micro-adjustments cannot reach back in time |
| `reviews.changes_count <= 2` (check constraint) | max-two-changes |
| `plan_versions` immutable once `active` | a plan a runner followed must remain explainable |
| partial unique index on `pace_estimates (user_id, distance_km) where valid_to is null` | one **open** estimate per distance; closed ones may overlap, because they describe windows that ended |

## Time handling (this bites, so it is specified)
- Storage: `timestamptz` for instants; `date` + `tz` for *training days*; never derive a training day
  from UTC.
- `users.tz` + `day_start_hour` define the day boundary; a "day" is `[day 04:00 tz, next day
  04:00 tz)`. DST transitions are handled by date labels, not by hour arithmetic.
- Every derived metric stores the `tz` and `day` it was computed for; a timezone change triggers a
  bounded recompute (the runner's history must not silently shift by a day).

## Retention & deletion
History is the product, so the default retention is "while the account is alive"; the partitioning
and retention *mechanics* are deferred to the storage ADR and the DDL says so rather than pretending.
`provider_connections.token_enc` destroyed on revoke. Deletion cascade defined explicitly in the DDL,
with `analytics` contributions removed and `case-studies` already aggregated and therefore unaffected
— and the cascade is enumerated in dependency order, because referential actions run with row
security off and a `purger` that relies on them deletes nothing it did not name.
