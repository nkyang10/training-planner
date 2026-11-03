---
status: draft
last_reviewed: 2026-11-03
---

# Backlog

Not a schedule — an ordered set of things we believe, with the evidence that would change our mind.
Effort: S (< 1 wk) · M (1–3 wk) · L (> 3 wk).

## Now (pre-M2)

Rows 8--11 came out of [the end-user 5W1H self-review](../review/2026-11-03-enduser-5w1h-review.md)
(F1--F10); F1 and F2 are launch blockers for the loop itself, not polish.

| # | Item | Why | Effort | Risk if skipped |
|---|---|---|---|---|
| 1 | Encode the 6 golden-plan personas as fixtures with coach-annotated expectations | the planner's specification; every later rule change is measured against it | M | planner correctness becomes opinion |
| 2 | Knowledge lint in CI (`last_reviewed` age, source ids resolve, `status` values, `→ rule:` links resolve) | the knowledge base is a product artifact; rot is silent | S | knowledge drifts from code invisibly |
| 3 | Message-catalogue completeness check `en` vs `zh-Hant` | a missing key at launch looks like a broken product for half the users | S | fallback language leaks into the comment |
| 4 | Banned-output test suite for the narrator (diagnosis, weight/calorie, guarantees, shame) in both languages | safety requirement, not style | S | our worst failure mode ships in prose |
| 5 | Entry-form timing instrumented from day one of M2 | adherence is the business risk; we must see it in week 1 | S | guessing at the biggest risk |
| 6 | Remaining contracts: `plan-version` and `events` JSON Schema, then `schemas/sql/schema.sql` | `plan-diff` and `review` are written; the DDL is where RLS becomes real | M | engine and UI inventing two different shapes |
| 7 | `docs/engine/explanation-and-trust.md` + `docs/vision/personas-and-journeys.md` | the comment is half the product; explaining a plan is the trust surface | S | trust work deferred until it is a redesign |
| 8 | Feedback-prompt policy: nudge hour from the runner's own behaviour, quiet hours, the 3-day/7-day silence ladder, one shared prompt budget (**F1**) | the rare event (a review) is exhaustively specified and the daily one is absent | S | the loop quietly stops and we read it as low motivation |
| 9 | Say how long today takes and what the alternate dose gave up (**F2**, **F10**) | elapsed time is an input today and an output nowhere; race day has no card | S | the time-poor runner cannot plan the evening they actually have |
| 10 | Sessions the runner does not control: club night, parkrun, pacing a friend (**F3**) | the group decides Tuesday; the plan has to survive that | S | every club runner's first week is fiction |
| 11 | Surfaces for what is already posture: season view, heat/altitude cost, travel week shift, export and delete (**F4**–**F6**, **F9**) | a promise with no screen is not a promise | M | trust decays exactly where the runner is most exposed |

## Next (M3–M5)

| Item | Why | Effort |
|---|---|---|
| Review-option cost model (state the cost of every option numerically) | consent without cost is not consent | M |
| Post-hoc missed-event audit (what runners reported that policy did not flag) | the only honest way to tune escalation | M |
| Individual ramp-tolerance calibration from the runner's own history | population defaults are the reason generic plans fail | L |
| `alternate` session branches used deliberately (plan B for a bad morning) | turns "I failed the session" into "I chose the other option" | M |
| Pace-evidence provenance UI ("why these paces, and when they expire") | pace distrust kills plan trust | M |
| GPX/CSV import + manual activity creation polish | manual-first must not mean manual-punishing | M |
| Notification budget per user + local scheduling (promoted to `knowledge/engagement-policy`, **F1**) | spam kills the loop quietly | S |
| Accessibility pass (keyboard calendar, colour-independent states, screen-reader labels) | a runner with low vision is a user | M |

## Later, deliberately

| Item | Why later | Revisit trigger |
|---|---|---|
| Strava beyond 10 athletes (app review) | external gate; submit paperwork early, build later | review granted |
| Garmin / wearables beyond Strava | access unverified ([PROD-S2](../../knowledge/sources/bibliography.md)) | verified access |
| Watch write-back | gated by every vendor; the plan is already usable | a platform opens it |
| Coach/grant tier | needs the grant model in [per-user-isolation](../architecture/per-user-isolation.md#sharing-later-without-breaking-isolation) and legal review of health-data sharing | paying coaches appear |
| Community / anonymous benchmarks | health-adjacent data in aggregates is the riskiest data decision we could make | DPI + k-anonymity design reviewed |
| Multi-sport, strength block, trail-specific terrain modelling | each one multiplies planner states | marathon/5K loop proven |
| Conversational "ask the coach" | collapses the language/decision boundary from [ADR-0007](../adr/0007-llm-language-only-with-template-fallback.md) | rule coverage + eval suite strong enough to defend it |
| Native app | mobile web + push may be enough; the loop is 30 s | push-delivery data says otherwise |
| Second language (Japanese, Simplified Chinese) | catalogue infrastructure makes this cheap later | demand signal |

## Research gaps we are carrying (tracked, not hidden)

| Gap | Current posture | What would resolve it |
|---|---|---|
| Optimal intensity distribution for *amateurs* (80/20 vs pyramidal at ≤ 4 sessions) | use population default (polarised-leaning, capped hard days) and let `rpe_gap` + adherence argue; documented as contested | our own cohort data by persona |
| ACWR as a risk signal | **display only**; never actionable ([metric-definitions](../data/metric-definitions.md#fitness--fatigue)) | a reproducible, uncoupled alternative |
| Garmin API access | assumed gated; nothing depends on it | direct enquiry, not blog posts |
| Does a daily comment cause adherence, or does adherence cause comments? | measure with in-product variation (M5 scaffolding), assume confounded | a designed experiment with real users |
| Individual HRV usefulness in novices | gated behind sufficiency checks; often absent for the first 3 weeks | cohort evidence from our own data |
| Postpartum and masters-specific guardrails beyond current rules | conservative knobs + clinician-referral paths; personas exist but are thin | a coach/physician review pass — the knowledge base needs it, and it is the least-evidenced area we cover |
