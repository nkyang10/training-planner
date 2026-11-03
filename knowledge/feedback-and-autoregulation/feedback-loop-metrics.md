---
id: feedback-loop-metrics
type: practice
status: draft
tags: [metrics, adherence, evaluation, product]
sources: [FB-S9]
last_reviewed: 2026-11-03
owner: fb-agent
---

# How we know the feedback loop is working

**Bottom line:** three questions, in order: do runners **report**, do they **read and act**, do they
**still have a plan in 8 weeks**. Everything else is instrumentation. A loop can look highly engaged
(comments opened, reviews accepted) while quietly producing runners who quit after a block — so the
retention metrics are the ones that veto, not the engagement metrics.

## The four that matter (product dashboard)

| Metric | Definition | Healthy | What it means when it fails |
|---|---|---|---|
| **log_rate_28d** | days with a real entry ÷ days with a planned or expected session, rolling 28 d | ≥ 0.80 falling to ≥ 0.60 by week 8 | Reporting is too costly, or the runner has stopped running. Check entry time first (`entry_seconds_p90`) |
| **comment_engagement** | share of comments opened **and** scrolled-to-end (proxy: dwell ≥ 1.5 s) | not a target — a *watch* metric | If engagement collapses while log_rate holds, the comment is decoration; shorten it |
| **review_offer_accept_rate** | reviews where the runner picked a change ÷ offers (manual reviews excluded) | 0.25–0.60 | < 0.15 ⇒ offers are noise (raise thresholds); > 0.8 ⇒ the runner has stopped choosing, which is its own problem |
| **plan_survival_w8** | share of users still on a generated plan (not churned, not silent) at 8 weeks after goal date selection | the north star | The plan was built for ambition instead of capacity — see `plan-too-big` in [../heuristics/review-triggers.yaml](../heuristics/review-triggers.yaml) |

## Supporting instrumentation

- `entry_seconds_p90` — time from opening the entry screen to saved. Budget: **< 15 s** for a normal
  day, **< 45 s** with pain questions. This is the leading indicator of `log_rate_28d`.
- `unlogged_rate_7d` — absence, treated as missing, never as zero
  ([missed-session-rules.yaml](../heuristics/missed-session-rules.yaml#unlogged-is-not-zero)).
- `easy_zone_share_28d` — the distribution the plan *claims* vs what happened. Drift upward (easy days
  run too fast) is the most common silent failure of a real plan
  ([../periodization/intensity-distribution.md](../periodization/intensity-distribution.md)).
- `rpe_gap_median` — planned-vs-experienced effort; a rising gap is the earliest "too much" signal we
  have that needs no device.
- `hard_stop_follow_through` — share of hard stops where the runner actually rested. Low follow-through
  is not defiance to be nagged; it is a signal that our stop text did not land.
- `intervention_precision` — of reviews accepted, share where the 14-day completion and RPE gap
  *improved*. This is the only honest measure of whether the review engine is any good.
- `silent_weeks_to_churn` — distribution of weeks-of-silence before cancellation. Tells us the real
  warning window for a re-engagement attempt (and whether one is ethical — see
  [../risk-and-safety/guardrails-and-disclaimers.md](../risk-and-safety/guardrails-and-disclaimers.md)).

## Rules for measuring this honestly

1. **Never ship a new comment style without a comparison.** Prompt-level A/B on copy is fine; anything
   that changes the *plan* needs a staged rollout with a holdback, because the outcome we care about
   (survival at 8 weeks) is slow.
2. **Aggregate only, anonymously, with a k-anonymity floor of 20**
   ([../../docs/architecture/per-user-isolation.md](../../docs/architecture/per-user-isolation.md)).
   Product analytics never sees an individual's health-sensitive fields
   ([../../docs/data/data-model.md](../../docs/data/data-model.md)).
3. **Do not use `plan_survival` alone to judge a safety rule.** A hard stop that ends a plan is
   sometimes the correct outcome. Read `hard_stop_follow_through` next to it.
4. **The LLM's contribution must be measurable as zero.** Grounding failures are counted as
   `narrator_rejected_to_template` and are reported like errors. If the model adds nothing measurable,
   keep it for multilingual phrasing and drop it for cost — do not keep it for the feeling of intelligence.

## Controversies

- **Engagement vs outcomes.** A daily comment maximises opens and can worsen fatigue with the app.
  Consider an explicit quarterly experiment: comment every day vs only on event (miss, pain, stop,
  review). If the difference in `plan_survival_w8` is nil, ship the quieter product
  ([system-comment-playbook.md](system-comment-playbook.md#controversies)).
- **Retention as the goal.** Retaining a runner who should be resting is a harm, not a win. Any
  experiment that improves retention by reducing rest is rejected by design, which is why safety metrics
  sit on the same dashboard as growth metrics.
