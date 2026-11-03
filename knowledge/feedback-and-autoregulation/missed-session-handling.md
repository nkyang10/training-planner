---
id: missed-session-handling
type: practice
status: draft
tags: [feedback, missed-sessions, adherence, autoregulation]
sources: [FB-S8, FB-S9, FB-S1]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Missing a session is the normal case, not the exception

**Bottom line:** most plan abandonment starts with a *make-up session*. A missed run costs one week of
a plan; a double-hard weekend to recover it costs a month. The correct behaviour is almost always
**"do the next one as scheduled"** — with the missed session either deleted or, rarely, *swapped* for a
session of the same class later in the same week when spacing allows. The planner therefore has no
"add volume" path at all ([../heuristics/missed-session-rules.yaml](../heuristics/missed-session-rules.yaml)),
and the comment never calls a miss a failure.

## Facts

- Adherence, not plan elegance, is the strongest predictor of a training block's outcome — see
  [plan-construction/inputs-and-output.md](../plan-construction/inputs-and-output.md) and the
  self-determination framing in [feedback-loop-metrics.md](feedback-loop-metrics.md). Grade C/D for the
  specific substitution rules below: **[FB-S8] is a placeholder** in the bibliography, so no rule here
  may carry `confidence: high` until a real source is attached.
- Missed-session *reasons* are not interchangeable ([daily-feedback-taxonomy.md](daily-feedback-taxonomy.md)):
  **capacity** (work, family, travel), **avoidance** (dread, low motivation), **symptom**
  (illness, pain), and **friction** (weather, gear, timing). Each has a different correct response, and
  only the first is solved by scheduling.
- A missed *quality* session is usually worth less than a missed *easy* session in the same week — the
  easy days carry the aerobic volume and the recovery; the quality slot can be dropped without breaking
  the block as long as the week keeps one or two stimuli. Grade C practice consensus.
- Consecutive missed days change the answer. 1–2 days = continue. 3–7 days = reduce and rebuild. Beyond
  that the profile's capacity assumption is stale and this becomes a restart question, not a
  make-up question ([plan-construction/mileage-and-progression.md](../plan-construction/mileage-and-progression.md),
  [physiology/restart-after-layoff.yaml](../heuristics/restart-after-layoff.yaml)).
- Intent matters for interpretation: a day the user *chose* to rest after registering the intent is
  information about the plan's size, not a compliance failure ([../../docs/engine/feedback-loop.md](../../docs/engine/feedback-loop.md#3)).
- An `alternate-taken` day (swim, hike, indoor trainer, a long bike) is a **success** to be counted as
  mostly-met, not a miss. Recreational training is movement-shaped, and refusing to count the cross-training
  a user volunteered teaches them to stop reporting.

## Practice

The ladder the planner follows, in order, and what the comment says:

| Situation | Response | Comment shape |
|---|---|---|
| Missed **easy** run | Delete. Do not move. | "Tuesday's easy run is gone — Thursday stays as written." |
| Missed **quality**, ≥72 h before the next one, same week | *Swap* into the nearest legal slot; keep spacing; never into the day before the long run. | "Moved the intervals to Saturday — still 72 h from Thursday." |
| Missed **quality**, no legal slot left | Delete. Keep the week's other stimulus. | "Skipping them is fine. Wednesday's tempo carries the week." |
| Missed **long run**, <10 days from race | Delete; do not compress two long efforts together. | "No catch-up long run before the race." |
| Missed **long run**, mid-block | Optionally shorten it into a free slot; never extend another day to compensate. | "If you have 60 min Saturday, an easy long run there — otherwise leave it." |
| `alternate-taken` | Count as met for load; note the modality; **do not** convert it to running load for ramp maths. | "Swim counts. Nothing extra needed." |
| `extra-activity` | Log it, thank them once, and **reduce** the next day if it lands within 48 h of a planned hard day. | "Good. I've made tomorrow easy so this doesn't stack." |
| `skipped` + `intent` registered | Treat as plan-too-big evidence; queue a review candidate; never argue. | "You flagged rest on Monday — that's the plan being wrong, not you." |
| `skipped` + `just-didnt` | No lecture. Shrink the next session's friction (shorter, closer to home, earlier). | "Tomorrow's 30 easy, right outside the door." |
| 3–7 consecutive missed days | Re-anchor volume to what they actually did; step the ramp down; no intensity until a week of consistency. | "Restarting from this week's real load: 24 km." |
| Missed during a `hard_stop` | Nothing to say about the plan; safety text only. | — |

Three rules that are not negotiable:

1. **Never add.** Missing work reduces the week; it never increases a later day.
2. **Never stack.** A swap is only legal if spacing and the "easy day after hard" rule survive.
3. **Never moralise.** The comment acknowledges, interprets, recommends ([system-comment-playbook.md](system-comment-playbook.md)).

## Review path

Three or more misses in a rolling 14 days — or two missed *quality* sessions in one week — is not a
scheduling problem. It raises a review candidate with `proposedChanges` that *reduce*: fewer hard days,
shorter sessions, or a persona switch to `time-poor-3-days` ([../heuristics/review-triggers.yaml](../heuristics/review-triggers.yaml#plan-too-big)).

## Controversies

- **Should a missed key session ever be mandatory?** Coaches differ. The risk asymmetry (a lost
  stimulus is cheap, a stacked hard weekend is expensive) settles it for us toward deletion, but
  marathon-specific blocks before a A-race may deserve a single narrow exception. Unresolved.
- **Does counting cross-training as "met" hide running-specific deconditioning?** Partly. We count it
  for load and morale, and never for the ramp. If a runner repeatedly substitutes non-impact work before
  a race, that belongs in a review as a *specificity* concern, not silently accepted.
- **Is 7 days the right cut for "restart"?** It is our chosen boundary, aligned with the short-detraining
  bucket in [physiology/aerobic-energy-and-adaptation.md](../physiology/aerobic-energy-and-adaptation.md).
  No runner-specific evidence.
