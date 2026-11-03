---
id: guardrails-and-disclaimers
type: reference
status: draft
tags: [safety, guardrails, legal, tone, honesty]
sources: [FB-S1, FB-S2, FB-S3]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Guardrails: what this product may never say or do

**Bottom line:** one list, enforced in three places (the engine's output type, the narrator's
post-processing, and the UI copy review). A guardrail that exists only in prose is not a guardrail.
Machine copy: [../heuristics/language-guardrails.yaml](../heuristics/language-guardrails.yaml) and
[../heuristics/safety-hard-stops.yaml](../heuristics/safety-hard-stops.yaml); the LLM constraints are in
`docs/engine/explanation-and-trust.md` (pending M1).

## Absolute prohibitions

| Never | Instead | Enforced by |
|---|---|---|
| A diagnosis or condition name ("you have OTS / RED-S / tendinopathy / anemia") | Pattern language + referral | narrator post-processor: block-list of condition terms in output |
| Nutrition, calorie, or food guidance | "A clinician or sports dietitian is the right person for that" | output filter + copy review |
| Weight or body-composition targets, or any BMI mention | Nothing. We do not have a legitimate use | field-level: weight is never a plan input |
| Predictions stated as outcomes ("you'll run 3:28", "you're on track for BQ") | A band, the evidence anchor, and its age | schema: pace targets require `evidenceAnchor` |
| Guarantees of any kind ("guaranteed", "this will prevent injury") | Ranges and reasons; "reduces risk of" only with a citation | copy review checklist |
| "You must", medical orders, or scare tactics | The instruction, once, plainly, for safety stops | `feedback-microcopy.md` tone rules |
| Recovery percentages, "readiness score", "training age", "durability score" as if measured | Descriptive text about what was observed | `language-guardrails.yaml#no_recovery_percentage`, `no_durability_score` |
| Moral framing of missed days ("you failed", "broken streak", "no excuses") | The decision for today | `daily-feedback-rules.yaml#comment-contract` |
| Demographic determinism ("women lose gains faster", "after 40 you can't…") | Individual baseline + the reason for a conservative band | `no_demographic_stereotypes` + `individual-baselines.yaml` |
| Vendor composites as plan inputs (Training Effect, Recovery Time, readiness stars) | Display-only, labelled as vendor | `metric-catalog.yaml#grade_gate` |

## Referral, not treatment

Medical questions end with a referral section, always containing: (a) what we observed, (b) that an
in-person assessment is needed, (c) what to bring or say, (d) an explicit "this app cannot assess that".
Levels: `urgent` (emergency/same-day), `routine-urgent` (days), `sports-medicine` (weeks). Never a
treatment protocol, never a medication, never a dose of anything
([red-flags-for-escalation.md](red-flags-for-escalation.md), [FB-S3]).

## The three sentences that must be reachable at all times

1. **What this is**: "Coaching software, not medical advice. It cannot assess you; it reacts to what you
   report." On the onboarding screen, in the settings screen, and in every referral block.
2. **What a number means**: any displayed number carries its source and age — "threshold pace from the
   2026-09-12 5 km race (8 weeks old)" — never a bare figure
   (`docs/engine/explanation-and-trust.md` (pending M1)).
3. **How to leave**: export and delete are one tap each, and deletion removes health-sensitive answers
   immediately and independently of the rest ([../../docs/architecture/per-user-isolation.md](../../docs/architecture/per-user-isolation.md)).

Kept short on purpose: a five-screen disclaimer nobody reads is a legal decoration, not honesty. These
three sentences are also the ones our own tests assert appear in the right contexts.

## Honest uncertainty in the LLM layer

- The narrator receives a **fact object with an `allowedNumbers` list**; any output containing a number
  outside it is discarded and the deterministic template is used. A missing comment is a better failure
  than an invented one ([../../AGENTS.md](../../AGENTS.md) rule 2).
- The narrator must never *soften* a safety instruction into a suggestion, and never *hedge* one into
  optionality. `safety-text-first` freezes sentence one.
- Uncertainty language is required where the evidence is weak and **must not be invented**: if the fact
  object says `confidence: low`, the comment says so in plain words ("this is a rough guide")
  (`zone_uncertainty_disclosure`).

## Legal / operational posture (draft, not legal advice)

- Terms of service must state: no medical purpose; user responsible for their own health decisions;
  referral-only for health topics; no guarantee of performance outcomes.
- Health-sensitive answers get the higher protection class wherever the platform offers it
  ([../../docs/data/data-model.md](../../docs/data/data-model.md)).
- Minors: 16+ with a guardian acknowledgement; below that, no health screening questions at all and no
  intensity above a defined ceiling ([../heuristics/medical-flags.yaml](../heuristics/medical-flags.yaml)).
- Jurisdiction-specific review is **out of scope for this repository** and is a launch checklist item
  ([../../docs/roadmap/milestones.md](../../docs/roadmap/milestones.md)).

## Controversies

- **Do guardrails make us sound less useful?** Yes, and users notice. The alternative — a system that
  sounds like a doctor and is not one — is worse. Where we can be genuinely useful is *precision about
  training* (which session, which week, which order) and *clarity about the boundary* (where a clinician
  takes over).
- **Should we show a disclaimer every time a stop happens?** No. Repeated boilerplate trains dismissal.
  The stop text says "this needs an in-person assessment", which *is* the disclaimer in context.
- **Weight is a health metric runners legitimately track.** True — and it is a different product. Keeping
  it out of the planner's input set is what lets us make the other promises
  ([../plan-construction/inputs-and-output.md](../plan-construction/inputs-and-output.md)).
