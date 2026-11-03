---
status: draft
last_reviewed: 2026-11-04
---

# Event catalog

`events` is the append-only spine. Naming: `domain.action`, past tense. The envelope is a contract of
its own — [events.schema.json](../../schemas/json/events.schema.json) — and carries
`{userId, type, occurredAt, actor, payloadVersion, payload, trainingDay, timezone, dayStartHour,
idempotencyKey?, causationId?, supersedesEventId?}`. Payload field names are camelCase like every
other JSON contract; the columns that store them are snake_case (`causation_id`), and codegen owns
that mapping ([schemas/README.md](../../schemas/README.md) rule 7). `trainingDay` is stored, not
derived at read time, so a runner moving timezone next year cannot silently rewrite which day today's
run belonged to.

## Identity & profile
| Type | Emitted when | Payload essentials | Consumers |
|---|---|---|---|
| `user.created` | signup | `locale`, `tz` | onboarding |
| `user.timeZoneChanged` | settings | `from`, `to`, `dayStartHour` | day recompute |
| `profile.updated` | profile edit | `diff`, `source` | regeneration trigger |
| `profile.goalChanged` | goal/race change | `oldGoal`, `newGoal` | **review candidate** |
| `availability.changed` | calendar edit | `range`, `diff` | regeneration |
| `healthFlag.added` / `.removed` | flag toggle | `flag`, `clearance?` | safety layer, plan branch |

## Planning
| Type | Notes | Consumers |
|---|---|---|
| `plan.generated` | `planVersionId`, `plannerVersion`, `knowledgeHash`, `inputsHash`, `horizon` | audit, UI |
| `plan.activated` | `fromVersionId`, `toVersionId`, `effectiveFrom` | notifications |
| `plan.superseded` | always paired with a `plan.diffStored` | audit |
| `plan.diffStored` | `fromDay`, `diff` | review screen, weekly summary |
| `plan.regenerated` | rolling refinement; `changedDays[]`, `budgetUsed` | weekly summary "what changed and why" |
| `session.published` | day-level refinement (coarse → detailed) | calendar |
| `session.adjusted` | micro-adjustment applied; `ruleId`, `factSnapshot` | calendar chip, loop metrics |
| `session.reverted` | runner undid an adjustment | calibration |
| `session.cancelledBySafety` | `ruleId`, `scope` | calendar, notifier suppression |
| `session.substituted` | runner chose the `alternate` branch | adherence |
| `session.skipped` | explicit skip (distinct from `unlogged`) | missed-session rules |

## Logging & observation
| Type | Notes |
|---|---|
| `entry.submitted` | the daily feedback entry; `status`, `rpe`, `legs`, optional tiers, `note`, `clientId` |
| `entry.corrected` | backfill/typo fix; references the superseded row + `reason` if > 72 h |
| `entry.reminded` | nudge sent (one per day budget) |
| `activity.observed` | import/manual activity; `provenance`, `rawHash` |
| `activity.linked` | session ↔ activity; `matchMethod`, `confidence` |
| `activity.unlinkRequested` | ambiguity surfaced to the runner |
| `pain.reported` | site, intensity, during/next-morning, gait change |

## Interpretation & review
| Type | Notes |
|---|---|
| `signal.computed` | cache-fill event (low value for audit; kept for reproducibility of a policy run) |
| `comment.generated` | `ruleId`, `templateId`, `narrator`, `factObject`, `locale`, `guardrailResult` |
| `comment.feedbackGiven` | "useful / unclear" tap |
| `review.suggested` | rule fired within budget |
| `review.opened` | user or system opened it |
| `review.optionsGenerated` | `options[]`, `costs`, `plannerVersion`, `knowledgeHash` |
| `review.accepted` | `chosenOptionId`, `changesCount`, `appliedPlanVersionId` |
| `review.declined` | `runnerReason` — autonomy learning |
| `review.deferred` | `recheckAt` |
| `review.checkpointed` | outcome verdict, closes the learning loop |
| `safety.flagRaised` / `.acknowledged` / `.overridden` / `.clinicianClearanceRecorded` | full audit chain |
| `integration.connected` / `.revoked` / `.syncFailed` | token lifecycle |

## Rules for the catalog

1. **An event must be replayable.** Given the events up to time T plus the knowledge hash, the
   system must be able to reconstruct the effective plan and every comment. If a feature can't say
   which events produce its state, it is hiding state somewhere.
2. **Payloads are versioned** (`payloadVersion`, integer, currently 1), additive-only; readers ignore
   unknown fields and never guess a missing one.
3. **No secret or `health-sensitive` payload in logs** — pain *notes* live in `pain_reports` /
   `day_entries`, not in the general event stream or in traces ([per-user-isolation.md](../architecture/per-user-isolation.md#data-classification-drives-logging-retention-and-export)).
4. **Idempotency keys are mandatory** for runner-initiated writes (`entry.submitted`,
   `session.skipped`, `session.substituted`, `availability.changed`) so an offline retry cannot
   double-log a run. The envelope makes this structural rather than a convention: an event with
   `actor: runner` and a null `idempotencyKey` fails validation at write time.
5. **`causationId` links comment → entry → rule → signals bundle**, which is exactly the chain the
   "why did you say that?" affordance walks.
6. Adding an event type requires: an entry here, a payload shape (this table is a catalogue, not a
   schema — the envelope only constrains the shape around the payload), a reducer/metric mapping, and
   a replay test fixture. A type name that exists here and nowhere in code, or the reverse, is a bug
   the replay fixtures should catch.
