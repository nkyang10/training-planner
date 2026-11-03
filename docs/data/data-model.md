---
status: draft
last_reviewed: 2026-11-03
---

# Data model

Two load-bearing ideas:

1. **The event log is the truth.** Everything a runner did, said, or felt is an append-only fact.
2. **Everything computed is a derived, rebuildable view.** Metrics, rollups, comments' fact objects,
   notifications — all recomputable from events + rules. A metric-definition fix is a backfill, not a
   migration of history.

DDL: `schemas/sql/schema.sql` (pending M1). Contracts:
[`schemas/json/`](../../schemas/json/). Every tenant table has `user_id uuid not null references
users(id)`, an RLS policy, and `created_at timestamptz default now()`.

## Core tables

### Identity & settings
| Table | Purpose | Key fields |
|---|---|---|
| `users` | account | `id`, `email`, `tz` (IANA), `locale` (`en`\|`zh-Hant`), `day_start_hour` default 4, `onboarding_complete` |
| `athlete_profiles` | slowly-changing planning inputs (1 current + history) | `valid_from`, `valid_to`, `profile jsonb` (validated by `athlete-profile.schema.json`), `injury_history[]`, `health_flags[]`, `availability`, `goal` |
| `profile_revisions` | audit of *why* the athlete changed what they changed | `changed_by`, `diff jsonb`, `source` (`user`\|`import`\|`review`) |
| `notification_prefs` | per-channel budgets | |
| `provider_connections` | encrypted tokens | `provider`, `scope`, `token_enc`, `status`, `last_sync_at`, `error` |

### Facts (append-only)
| Table | Purpose | Notes |
|---|---|---|
| `events` | the log | `id bigserial`, `type`, `occurred_at`, `payload jsonb`, `actor` (`user`\|`system`\|`worker`), `idempotency_key unique per user`, **partitioned monthly**, no `UPDATE`/`DELETE` grants to `app_user` |
| `day_entries` | materialised latest entry per user-day | `day date`, `status`, `rpe`, `legs`, `sleep_h`, `stress`, `mood`, `pain jsonb`, `note`, `revisions jsonb`, `source` (`manual`\|`voice`\|`import`), `superseded_by` |
| `activities` | observed exercise | `provider`, `provider_activity_id`, `started_at`, `duration_s`, `distance_m`, `avg_hr`, `max_hr`, `hr_series bytea`\|`hr_zones jsonb`, `cadence`, `power`, `gpx_ref`, `raw_hash`, `provenance`, `quality_flags[]` |
| `activity_links` | planned session ↔ activity | `session_occurrence_id`, `activity_id`, `match_method` (`auto`\|`suggested`\|`manual`), `confidence` |
| `pain_reports` | first-class, because it has the lowest intervention threshold | `site`, `intensity`, `during_run`, `next_morning`, `trend_gait_change bool`, `day` |

### Planning
| Table | Purpose | Notes |
|---|---|---|
| `plan_versions` | immutable generated plans | `id`, `parent_version_id`, `status` (`draft`\|`active`\|`superseded`\|`archived`), `planner_version`, `knowledge_hash`, `inputs_hash`, `reason`, `created_from_review_id` |
| `plan_weeks` | weekly targets | `iso_week_start`, `volume_m`, `longest_run_m`, `intensity_target jsonb`, `phase_id` |
| `phases` | dated phase blocks | `kind`, `start`, `end`, `purpose`, `exit_criteria jsonb` |
| `session_occurrences` | **the effective session on a date** (materialised: base + overrides) | `day`, `plan_version_id`, `kind`, `structure jsonb`, `targets jsonb`, `primary_target`, `purpose`, `non_negotiable`, `explain jsonb {rule_ids, knowledge_refs}`, `alternate jsonb`, `state` (`planned`\|`adjusted`\|`cancelled`\|`done`) |
| `session_overrides` | micro-adjustments; **never mutate `session_occurrences`** | `kind`, `payload jsonb`, `reason_rule_id`, `fact_snapshot jsonb`, `accepted bool`, `reverted_at` |
| `plan_diffs` | stored parent→child diffs | `from_day`, `diff jsonb` (`plan-diff.schema.json`), `cost jsonb` |
| `reviews` | the review record | `trigger` (`user_intent`\|`rule`), `rule_id`, `severity`, `status` (`suggested`\|`open`\|`accepted`\|`declined`\|`deferred`\|`expired`), `evidence_snapshot jsonb`, `evidence_hash`, `options jsonb`, `chosen_option_id`, `runner_reason`, `changes_count`, `applied_plan_version_id`, `checkpoint_at`, `checkpoint_verdict` |
| `safety_events` | flags, stops, overrides, clearances | `rule_id`, `tier`, `scope jsonb`, `acknowledged_at`, `override jsonb`, `clearance jsonb` |
| `system_comments` | immutable narrated outputs | `day`, `rule_id`, `fact_object jsonb`, `template_id`, `narrator` (`template`\|`llm`), `model`, `text`, `locale`, `guardrail jsonb` |

### Derived (rebuildable)
| Table | Purpose |
|---|---|
| `metrics_daily` | per user-day rollups: `load_trimp`, `load_srpe`, `ctl`, `atl`, `tsb`, `acwr`, `wellness_ewma jsonb`, `hr_drift`, `monotony`, `log_quality`, `requires jsonb` |
| `signals_current` | latest computed signal bundle per user (cache for policy evaluation) |
| `pace_estimates` | derived paces with `method`, `confidence`, `valid_from`, `expires_at` |
| `analytics.*` | de-identified aggregates, separate role, k-anonymity floor, no `user_id` |

## Key constraints that encode product rules

| Constraint | Encodes |
|---|---|
| `events`, `day_entries` (supersede pattern), `plan_versions`, `system_comments` have no UPDATE/DELETE grants | "never change the past" (AGENTS rule 4) at the permission layer, not in code review |
| `day_entries (user_id, day, revision)` unique | append-only revisions per day |
| `activities (user_id, provider, provider_activity_id, revision)` unique | idempotent sync |
| `session_overrides` FK to a *future* `session_occurrences.day` (checked in a trigger) | micro-adjustments cannot reach back in time |
| `reviews.changes_count <= 2` (check constraint) | max-two-changes |
| `plan_versions` immutable once `active` | a plan a runner followed must remain explainable |
| `pace_estimates` cannot overlap for a `(user_id, distance)` with `valid_to` set | one authoritative pace per distance |

## Time handling (this bites, so it is specified)
- Storage: `timestamptz` for instants; `date` + `tz` for *training days*; never derive a training day
  from UTC.
- `users.tz` + `day_start_hour` define the day boundary; a "day" is `[day 04:00 tz, next day
  04:00 tz)`. DST transitions are handled by date labels, not by hour arithmetic.
- Every derived metric stores the `tz` and `day` it was computed for; a timezone change triggers a
  bounded recompute (the runner's history must not silently shift by a day).

## Retention & deletion
`events` partitioned monthly with a documented retention (default: indefinite while the account is
alive — history is the product). `provider_connections.token_enc` destroyed on revoke. Deletion
cascade defined explicitly in the DDL, with `analytics` contributions removed and `case-studies`
already aggregated and therefore unaffected.
