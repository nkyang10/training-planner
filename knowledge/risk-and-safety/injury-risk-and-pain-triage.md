---
id: injury-risk-and-pain-triage
type: practice
status: draft
tags: [safety, injury, pain, tendon, bone-stress, triage]
sources: [FB-S2, FB-S3, PLAN-S7]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Pain 0–10: the scale the planner actually uses

**Bottom line:** runners do not need to know whether it is "tendinopathy or a stress reaction"; they need
a **run/no-run decision today** and a rule for the next week. So the triage is functional, not
diagnostic: does the pain change how you run, is it there when you are not running, and is it getting worse
across reports. The three bands below are the only pain logic in the engine. Rapid load rise is the
dominant modifiable risk factor ([PLAN-S7] — title-level only; the effect estimates were not captured in
the 2026-11-03 pass), which is why every "keep going" band is also a "stop rising" band.

## The bands

| Band | Definition | Today | Next 7 days |
|---|---|---|---|
| **0–3 "monitor"** | Felt only on effort, eases as you warm up, no gait change, gone at rest | Run as planned; keep it easy if it is an easy day | Normal progression **allowed**, but no more than one variable increases this week ([../heuristics/load-progression.yaml](../heuristics/load-progression.yaml#one-variable-per-week)) |
| **4–6 "modify"** | Present during the run and after it, or recurring at the same site every hard session, or 4+/10 on two of three days | Run **easy** by effort, or swap the quality session for an easy one; pain must not change your stride | No intensity; volume ≤ previous week; long run capped; re-check in 3 days |
| **7+ / gait change / night pain "stop"** | Alters your stride, hurts walking, present at rest or at night, or point-tender on bone | Do not run | Everything removed; referral; return through a load-tolerating test, not through a date |

Machine copy: [../heuristics/safety-hard-stops.yaml](../heuristics/safety-hard-stops.yaml#pain-escalation),
`#night-pain-or-bone-tenderness`. Question trigger and field set:
[../heuristics/daily-feedback-rules.yaml](../heuristics/daily-feedback-rules.yaml#pain-question-trigger).

## Red flags (see the list)

Night pain, rest pain, bone point-tenderness, swelling, locking, numbness, and any inability to
weight-bear go straight to [red-flags-for-escalation.md](red-flags-for-escalation.md). So does the
recurring pattern — *the same site hurts every time load rises* — because that is a load-intolerance
problem the plan cannot fix by rearranging sessions.

## Facts we lean on

- Bone-stress injury sits on a continuum from stress reaction to fracture, and **night pain / rest pain /
  point tenderness** are the features that raise urgency; this is the highest-acuity running injury in
  our population and the one most often dismissed as "soreness". Consensus-aligned with the REDs bone
  discussion ([FB-S2], [FB-S3]) — the injury-specific clinical detail lives with a clinician, not here.
- Tendon pain classically **eases with warm-up** and returns after; that "warm-up phenomenon" is exactly
  why the 0–3 band permits running, and why "it felt fine after 10 minutes" is not evidence to add load.
- **Tissue adaptation lags cardiorespiratory adaptation.** The reason we cap the ramp is that fitness
  improves faster than the structures tolerate it
  ([../physiology/fatigue-fitness-recovery.md](../physiology/fatigue-fitness-recovery.md),
  [../heuristics/progression.yaml](../heuristics/progression.yaml#structural_tissue_lag_factor)). Grade C
  consensus; the lag *factor* is our knob, not a measurement.
- Returning after time off, changing surface or footwear, and adding speed work are the three contexts
  where the same weekly volume produces different risk. Handled as context, not as fear:
  [../heuristics/context.yaml](../heuristics/context.yaml),
  [../personas/returning-after-layoff-or-injury.md](../personas/returning-after-layoff-or-injury.md).

## Practice — the four questions, and only when they are warranted

Asked only when `legs ≥ 4`, an RPE gap ≥ 2, or an injury history exists (a nightly questionnaire loses
the log): site · intensity 0–10 · present at rest or at night? · does it change how you run? · worse the
next morning? Two fields are decisive and are always asked once triggered: **night pain** and **gait
change**. Everything else is context for the review, not a diagnosis.

The comment states the band's decision, not a theory:

> Pain 5 at the Achilles, worse in the first kilometre of yesterday. Today: easy, 35 minutes, conversational —
> no intervals. If it changes how you run, walk home and tell me. Nothing gets added this week.

## Returning

Return is gated by a **load-tolerating test the runner can do themselves**, not by a calendar: pain ≤ 2
during, gone by the next morning, and no gait change, at a volume slightly below where it hurt. Then
re-introduce in this order: easy volume → hills/strides → one quality session → the ramp. Never restart
intensity first, because intensity is what revealed the problem. Codified in
[../heuristics/recovery.yaml](../heuristics/recovery.yaml#return-from-pain).

## Controversies

- **Is "pain during running = stop" simpler and safer?** It would prevent more injuries and cause far more
  abandonment, and it is wrong for the 0–3 band where continuing is usually benign. Unresolved for
  novices, where reporting reliability is worst — a candidate for a novice-specific tightening
  (`confidence: low` on any band applied to first-5k personas).
- **Should we ever name a structure ("it's your ITB")?** Never. Naming invites self-treatment and reads
  as diagnosis ([guardrails-and-disclaimers.md](guardrails-and-disclaimers.md)).
- **Video gait analysis / wearables as injury predictors?** Attractive, unevidenced at consumer accuracy
  for individual prediction. Out of scope for M1–M3; recorded in
  [../../docs/roadmap/backlog.md](../../docs/roadmap/backlog.md).
- **Missing source:** a runner-specific load-injury dose-response (the "wellness-adjusted ACWR" line of
  work) is discussed in [../signals-and-metrics/acute-chronic-workload.md](../signals-and-metrics/acute-chronic-workload.md)
  and is the reason ACWR is display-only. No verified citation for pain-specific thresholds: **[FB-S8]
  remains a placeholder** — every pain knob stays at `confidence: medium` until it is filled.
