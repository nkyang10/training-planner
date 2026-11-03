---
id: review-policy-evidence
type: evidence
status: draft
tags: [review, notification, trust, evidence]
sources: [FB-S1, PLAN-S7, FB-S9]
last_reviewed: 2026-11-03
owner: fb-agent
---

# When should the system ask to look — and when should it stay quiet?

**Bottom line:** the failure mode of an adaptive system is not a wrong recommendation, it is a runner
who stops reading. Thresholds must therefore be set from **interpretation windows** (a signal's noise
floor) and **notification budget** (about one invitation per week), not from what the engine is capable
of detecting. There is almost no peer-reviewed literature on review *cadence* for training plans; what
we have is (a) injury evidence that rapid load rises are the dominant modifiable risk
([PLAN-S7], title-level only), (b) the OTS consensus that a sustained performance decrement plus
symptoms deserves a load reduction ([FB-S1]), and (c) self-determination theory for the *form* of the
interaction ([FB-S9], pending verification). Everything else here is an explicitly labelled design bet.

## Facts we can lean on

- Rapid increases in volume, intensity, or terrain are the most-studied modifiable injury risk factor in
  runners ([PLAN-S7]). Effect estimates were **not** captured in the 2026-11-03 research pass, so this
  justifies *direction and thresholds as knobs*, never a specific percentage presented as measured.
- A performance decrement persisting beyond ~2 weeks with elevated resting HR, disturbed sleep, and mood
  change is the recognised pattern that warrants reduced training ([FB-S1]). This is why
  `overreach-check` requires **multiple corroborating signals over ≥14 days** rather than one bad week.
- Interventions in exercise apps retain better when the user keeps agency and understands the reason
  (SDT framing, [FB-S9] pending). This supports the accept/decline pattern and the visible diff; it does
  **not** support frequent prompting — the same theory predicts that controlling language ("you must")
  undermines adherence.
- Nothing in the literature sets `dwell_days = 7` or `max_prompts_per_week = 1`. Those are ours, from
  product reasoning about fatigue, and they are knobs precisely so a real cohort can change them.

## Practice — the four gates a trigger must pass

| Gate | Requirement | Why |
|---|---|---|
| **Window** | Every signal in `when:` has reached its `review_ready_on` window | A 2-day HRV dip is noise ([interpretation-windows.md](interpretation-windows.md)) |
| **Corroboration** | ≥2 independent channels (load + a subjective, or performance + load), or 1 red-flag symptom | Single-metric triggers produce confident nonsense |
| **Actionability** | The proposal must be one of ≤2 concrete, reversible changes with a stated cost | A review with no option set is anxiety, not help |
| **Budget** | Dwell + cooldown + weekly prompt cap | The alternative to being ignored is being muted |

Ordering matters. `plan-too-big` and `capacity-change` are the highest-value, lowest-risk reviews
(they subtract). `goal-feasibility` is the most delicate: it touches identity, so it presents a *band and
the age of the evidence*, never a verdict.

## The honesty rule about the goal conversation

The engine may say: *"Your last 5 km evidence is 11 months old and current sessions are running ~8 s/km
slower than the band it produced; at 9 weeks out, the defensible options are a tune-up race or a wider
target."*
It may not say: *"You will not make 3:30."* Nor: *"You're on track for 3:30!"* — a goal restated as a
promise is the single most common way coaching software lies
([../risk-and-safety/guardrails-and-disclaimers.md](../risk-and-safety/guardrails-and-disclaimers.md)).

## Controversies

- **Should the system ever review without asking?** Safety stops do exactly that (subtract + inform), and
  runners accept it when the reason is one sentence. Structural changes without consent are a line we do
  not cross.
- **Is silence a valid response?** Yes, and it is under-used. Most weeks the correct output is a normal
  comment and no review — a system that reviews every week teaches the runner that reviews mean nothing.
- **Threshold calibration**: currently expert-guess ranges. M3 ships an offline replay over anonymous
  aggregate logs (`knowledge/analytics/`, k ≥ 20) to see how often each trigger *would* have fired; a
  trigger that fires for >20% of users in a week is too sensitive by construction.
