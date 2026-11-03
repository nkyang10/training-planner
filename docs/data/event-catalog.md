---
status: draft
last_reviewed: 2026-11-03
---

# Event catalog

`events` is the append-only spine. Naming: `domain.action` in past tense payloads. Every event
carries `{user_id, type, occurred_at, actor, payload, idempotency_key?, causation_id?}`.

## Identity & profile
| Type | Emitted when | Payload essentials | Consumers |
|---|---|---|---|
| `user.created` | signup | `locale`, `tz` | onboarding |
| `user.timeZoneChanged` | settings | `from`, `to`, `day_start_hour` | day recompute |
| `profile.updated` | profile edit | `diff`, `source` | regeneration trigger |
| `profile.goalChanged` | goal/race change | `old_goal`, `new_goal` | **review candidate** |
| `availability.changed` | calendar edit | `range`, `diff` | regeneration |
| `healthFlag.added` / `.removed` | flag toggle | `flag`, `clearance?` | safety layer, plan branch |

## Planning
| Type | Notes | Consumers |
|---|---|---|
| `plan.generated` | `plan_version_id`, `planner_version`, `knowledge_hash`, `inputs_hash`, `horizon` | audit, UI |
| `plan.activated` | `from_version`, `to_version`, `effective_from` | notifications |
| `plan.superseded` | always paired with a `plan.diffStored` | audit |
| `plan.diffStored` | `from_day`, `diff` | review screen, weekly summary |
| `plan.regenerated` | rolling refinement; `changed_days[]`, `budget_used` | weekly summary "what changed and why" |
| `session.published` | day-level refinement (coarse → detailed) | calendar |
| `session.adjusted` | micro-adjustment applied; `rule_id`, `fact_snapshot` | calendar chip, loop metrics |
| `session.reverted` | runner undid an adjustment | calibration |
| `session.cancelledBySafety` | `rule_id`, `scope` | calendar, notifier suppression |
| `session.substituted` | runner chose the `alternate` branch | adherence |
| `session.skipped` | explicit skip (distinct from `unlogged`) | missed-session rules |

## Logging & observation
| Type | Notes |
|---|---|
| `entry.submitted` | the daily feedback entry; `status`, `rpe`, `legs`, optional tiers, `note`, `client_id` |
| `entry.corrected` | backfill/typo fix; references the superseded row + `reason` if > 72 h |
| `entry.reminded` | nudge sent (one per day budget) |
| `activity.observed` | import/manual activity; `provenance`, `raw_hash` |
| `activity.linked` | session ↔ activity; `match_method`, `confidence` |
| `activity.unlinkRequested` | ambiguity surfaced to the runner |
| `pain.reported` | site, intensity, during/next-morning, gait change |

## Interpretation & review
| Type | Notes |
|---|---|
| `signal.computed` | cache-fill event (low value for audit; kept for reproducibility of a policy run) |
| `comment.generated` | `rule_id`, `template_id`, `narrator`, `fact_object`, `locale`, `guardrail_result` |
| `comment.feedbackGiven` | "useful / unclear" tap |
| `review.suggested` | rule fired within budget |
| `review.opened` | user or system opened it |
| `review.optionsGenerated` | `options[]`, `costs`, `planner_version`, `knowledge_hash` |
| `review.accepted` | `chosen_option_id`, `changes_count`, `applied_plan_version_id` |
| `review.declined` | `runner_reason` — autonomy learning |
| `review.deferred` | `recheck_at` |
| `review.checkpointed` | outcome verdict, closes the learning loop |
| `safety.flagRaised` / `.acknowledged` / `.overridden` / `.clinicianClearanceRecorded` | full audit chain |
| `integration.connected` / `.revoked` / `.syncFailed` | token lifecycle |

## Rules for the catalog

1. **An event must be replayable.** Given the events up to time T plus the knowledge hash, the
   system must be able to reconstruct the effective plan and every comment. If a feature can't say
   which events produce its state, it is hiding state somewhere.
2. **Payloads are versioned** (`payload_version`), additive-only; readers ignore unknown fields.
3. **No secret or `health-sensitive` payload in logs** — pain *notes* live in `pain_reports` /
   `day_entries`, not in the general event stream or in traces ([per-user-isolation.md](../architecture/per-user-isolation.md#data-classification-drives-logging-retention-and-export)).
4. **Idempotency keys are mandatory** for user-initiated writes (`entry.submitted`,
   `session.submitted`) so offline retries cannot double-log a run.
5. **`causation_id` links comment → entry → rule → signals bundle**, which is exactly the chain the
   "why did you say that?" affordance walks.
6. Adding an event type requires: an entry here, a JSON Schema, a reducer/metric mapping, and a
   replay test fixture.
