---
id: red-s-and-relative-energy-deficiency
type: evidence
status: draft
tags: [safety, red-s, energy-availability, referral, women-s-health]
sources: [FB-S2, FB-S3, FB-S4]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Low energy availability: what a planner may and may not do

**Bottom line:** the 2023 IOC consensus defines REDs as impaired physiological function associated with
**relative energy deficiency in sport**, with low energy availability as the primary driver and a long
list of multi-system consequences (menstrual disruption, bone health, immunity, cardiovascular,
psychological) ([FB-S2]). For us this is not a coaching topic — it is the one place where **the correct
product behaviour is to reduce training load and refer**, and where the interface must say nothing about
food, weight, or calories. The validated CAT2 tool is a triage-and-escalation instrument for
non-clinicians with explicit stop/refer thresholds ([FB-S3]); we copy the *posture*, not the diagnosis.

## Facts

- Low energy availability is the driver; LEA is **relative** to the individual's physiological needs, not
  to a body size ([FB-S2]). This is why we never surface a number, a target, or an estimate.
- Consensus guidance is to **reduce training load** while energy availability is restored
  ([FB-S2], [FB-S3]). Increasing training in this state is the specific harm we are designed not to do.
- The REDs CAT2 is explicitly a screening/escalation tool for use *without* making a diagnosis, with
  red-flag items that require immediate reduction of load and clinical referral
  ([FB-S3]). Its companion paper describes the clinical picture in runners
  ([FB-S4], grade A).
- Menstrual disruption (including the *absence* of periods, and functional hypothalamic amenorrhoea) is
  both a marker and a source of bone-health risk; combined with stress-fracture history it is the highest
  acuity cluster ([FB-S2], [FB-S3]).
- REDs occurs in men and in non-competitive runners. Framing it as "a women's eating-disorder issue"
  causes missed cases; our screen is therefore **not** sex-gated.

## What the product does

**Screen (private, health-sensitive class):** a small set of yes/no items, offered at profile setup and
re-offered at most quarterly, never in the daily entry
([../feedback-and-autoregulation/daily-feedback-taxonomy.md](../feedback-and-autoregulation/daily-feedback-taxonomy.md)):

- periods absent, unusually irregular, or stopped since training increased (if applicable)
- a stress fracture or bone-stress injury in the last 24 months
- unexplained weight loss, or weight loss the runner is not trying for
- training or life circumstances making it hard to eat enough for the load being asked
- frequent illness, or slow recovery, alongside the above

**Act:** if ≥3 flags, or any bone-stress-injury flag with current rising load →
`safety-hard-stops.yaml#reds-flag-pattern`: remove quality sessions, hold volume at ~60% for 14 days, and
show the referral block. The runner may keep easy movement; the volume subtraction is not overridable.

**Say:** pattern language + referral + a question to ask the clinician. Never a diagnosis, never a
condition name, never an energy number.

> Observed: three weeks of sessions coming out harder than planned, two flagged items from your health
> questions, and a load rise of 14% while that was happening. I've taken intensity out and lowered volume
> for two weeks. This pattern is worth an in-person assessment — a sports-medicine clinician or your
> doctor. Useful to bring: when it started, your last period (if applicable), any past stress injury, and
> your weekly distance for the last 3 months.

**Never say:** "you're under-fuelling", "eat more", a BMI/weight target, "RED-S" as a label, or anything
that reads as treatment. Per [../../AGENTS.md](../../AGENTS.md) rule 6 and
[guardrails-and-disclaimers.md](guardrails-and-disclaimers.md).

## Design consequences that are easy to get wrong

1. **Screening data is `health-sensitive`**: encrypted at rest, never in analytics even aggregated,
   excluded from exports, deletable independently
   ([../../docs/data/data-model.md](../../docs/data/data-model.md)). A runner answering "no" to
   everything must not be identifiable from the aggregate either (k ≥ 20 floor).
2. **The plan must not quietly keep rising.** The most damaging version of this product is a ramp that
   obeys `weekly_increment_pct` while ignoring everything else. `reds-flag-pattern` forces the ramp
   conservative band through `load-progression.yaml#safety-ceiling-lowers-ramp`.
3. **Praise is harmful here.** "Great consistency — 5 weeks straight!" is the exact sentence that makes a
   runner keep training in this state. When the pattern is active, comments carry instructions only
   ([daily-feedback-rules.yaml#safety-text-first](../heuristics/daily-feedback-rules.yaml)).
4. **Goal conversations get quieter.** No "you're on track" while a flag pattern is active; the goal is
   simply not the topic of the week.
5. **Postpartum and adolescent profiles** have their own gates — pregnancy/postpartum locks phase
   advancement outright ([../personas/postpartum-return.md](../personas/postpartum-return.md),
   [../heuristics/medical-flags.yaml](../heuristics/medical-flags.yaml)).

## Controversies

- **Should an app screen for this at all?** The counter-argument — screening without clinical support is
  a liability — is serious. Our position: a *load reduction plus referral* is the intervention the
  consensus itself recommends, and refusing to notice is not neutral. The screen is opt-in at profile
  setup and can be permanently dismissed.
- **Is a count-based screen defensible?** The thresholds are ours; CAT2's items are more clinical and we
  deliberately simplified. Anything beyond `confidence: medium` here would be dishonest, and no knob may
  cite this file as `high`.
- **Where does motivation end and pathology begin?** Nowhere visible from our data. Which is why the
  output is a referral, not an interpretation.
