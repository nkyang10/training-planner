---
status: draft
last_reviewed: 2026-11-03
---

# Scope, non-goals, and the MVP cut

## In scope (v1)

- One runner per account, self-managed. No team/coach accounts in v1 (schema keeps `user_id` so a
  coach can be *granted read* or *grant-assist* access later without a rewrite).
- Plan generation over a rolling horizon (default: full plan to race day, generated weekly into
  dated session drafts; see [planner-engine.md](../engine/planner-engine.md#horizon-and-regeneration)).
- Calendar-first UI: month/week view, each day cell = session + feedback state + comment thread.
- Daily feedback entry with offline capture and backfill.
- System comment after each entry.
- Review: user-triggered and system-triggered, producing a future-plan diff and a new plan version.
- Structured manual logging **first**; device import second.
- English + Traditional Chinese.

## Explicitly out of scope for v1

| Excluded | Why | Revisit when |
|---|---|---|
| Weight / body-composition tracking, calorie or meal advice | RED-S risk profile; we are not clinicians and the harm is asymmetric. P6 + P4 | never, without clinician review |
| Diagnosis of injury or illness | we triage and refer, we do not diagnose | never |
| Group/coach dashboards, plan authoring for others | changes the tenancy and permission model; ship the loop first | v2 |
| Social feed, leaderboards, kudos | the feedback loop must not be gamified into performance pressure | v2, cautiously |
| Multi-sport (triathlon) periodisation | plan construction differs enough to corrupt the running defaults | v2 |
| Watch/band *write-back* of workouts | integration-heavy; read-only import delivers most value | v2 |
| Autonomous multi-season athlete development | needs years of per-user data and a much stronger evidence base | long-term |
| Real-time in-run pacing/coaching | different product surface entirely | never in this product |

## The MVP cut (what we would defend in an argument)

If we can only ship three things:

1. **Onboarding → generated 12-week plan on a calendar.** Even with no feedback, this is useful.
2. **Daily entry + system comment.** This is the retention engine and the data engine.
3. **One review flow with a real diff.** This is the differentiator and the trust engine.

Everything else (metrics charts, integrations, streaks, pace calculators, race prediction) is
supporting cast and should be judged only by whether it makes one of the three better.

### Deliberate technical MVP constraint: **manual logging first**

Device integration is the classic way this kind of product dies: approval gates, rate limits, token
expiry, per-vendor field differences (see
[integrations.md](../architecture/integrations.md) — Strava alone requires a paid account to create
an app, starts in single-player mode, and caps at 10 athletes before an app review). So:

- v1 must be **fully valuable with zero connected devices**. Distance/time/RPE typed in, or even
  "did the session: yes/no".
- Import is an **enrichment layer**: it fills in actuals we would otherwise estimate, and it makes
  pace-vs-HR divergence detectable. It must never be a prerequisite for a comment or a review.
- Every derived metric declares its `requires:` input set so the UI can say *why* something is
  unavailable ("connect a device to see HR drift") instead of showing an empty chart.

## Acceptance criteria that keep us honest

| Capability | Acceptable | Not acceptable |
|---|---|---|
| Plan generation | deterministic, reproducible from `{profile, seed, knowledgeHash}`, golden-tested | "roughly the same plan each time" |
| Availability | respects declared days off and minute budgets exactly; a 3-day runner never gets 4 mandatory runs | squeezing sessions into unavailable days |
| Daily entry | completable in ≤30 s, works offline, survives a page reload mid-entry | a form with required fields |
| Comment | names something from today + states tomorrow; degrades to honest silence when data is missing | generic motivational text; invented numbers |
| Review | explicit diff + reason + cost + consent; ≤2 changes; recorded | silently regenerating the calendar |
| Safety | hard stops cannot be bypassed by a tap; override is recorded and timestamped | "are you sure?" single-click bypass |
| Isolation | cross-user read impossible at the database layer (RLS), tested with an automated RLS test suite | app-layer filtering alone |

## Known risks at the scope boundary

1. **Silent-adaptation addiction.** A loop that always adjusts tomorrow can train learned
   helplessness. Mitigation: micro-adjust shows as a visible "because …" chip; the weekly summary
   shows what we *would* have prescribed unchanged.
2. **Self-selection in the data.** Bad days go unlogged, so the system looks at a filtered world.
   Mitigation: measure log-quality by day type (are hard days logged as often as easy days?); a
   missing entry is itself a signal, never treated as "fine".
3. **Over-escalation.** Too many reviews → noise → users ignore the thing that matters. Mitigation:
   review budget (dwell time + cooldown) in `knowledge/heuristics/review-triggers.yaml`.
4. **Under-escalation.** Missing a real injury because the runner typed "a bit tight". Mitigation:
   pain has its own triage path with a low threshold to interrupt; false alarms on pain are the
   cheaper error (P4).
5. **Scope creep toward "AI coach".** Cheap to demo, dangerous to run. Rule from
   [AGENTS.md](../../AGENTS.md): the LLM writes language, the engine writes numbers.
