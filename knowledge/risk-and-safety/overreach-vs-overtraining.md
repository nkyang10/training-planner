---
id: overreach-vs-overtraining
type: evidence
status: draft
tags: [safety, overreaching, overtraining, recovery]
sources: [FB-S1, FB-S5]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Functional overreach, non-functional overreach, and what we refuse to diagnose

**Bottom line:** the consensus position is a **continuum** — functional overreaching (FOF, short,
supercompensation after recovery), non-functional overreaching (NFR, longer, performance decrements with
or without major symptoms), and overtraining syndrome (OTS, prolonged, diagnosis of exclusion) — and
there is **no accepted diagnostic marker or test** ([FB-S1]). Two consequences for this product:
we never tell a runner they have OTS, and we treat *reduced load* as the only intervention we will
prescribe on this axis. Everything else a runner reads about — iron, hormones, "immunity", readiness
scores — is somebody else's clinical question.

## Facts

- The three-stage continuum and the absence of a diagnostic test are the joint ECSS/ACSS consensus
  ([FB-S1], grade A). A later position stand restates the same caution and emphasises that mood, sleep,
  and appetite changes are **non-specific** ([FB-S5], grade A).
- Recognised *pattern* features of NFR/OTS: sustained performance decrement (often the only reliable
  one), elevated resting HR, disturbed sleep, mood disturbance, appetite change, recurrent illness, and
  a plateau or decline despite continued or increased training ([FB-S1]).
- Recovery from OTS is measured in **months**, and the consensus is explicit that prevention is the only
  practical strategy. That asymmetry is the whole reason the safety layer exists.
- Diagnosis of exclusion means infection, anaemia, endocrine disease, and inadequate energy availability
  must be ruled out by a clinician ([FB-S1], [FB-S2]). A plan app cannot exclude any of them, so a
  "you are just overreached" statement from us is always a guess.
- What is **not** established: any single biomarker, any "overtraining score", any readiness composite
  that claims to detect it. Vendor composites are grade D by policy
  ([../sources/bibliography.md](../sources/bibliography.md)).

## Practice — how the planner behaves on this axis

| Pattern (all windows per [interpretation-windows.md](../feedback-and-autoregulation/interpretation-windows.md)) | Engine response |
|---|---|
| 1–3 hard sessions in a tough week, performance normal, legs 3–4 for ≤2 days | **FOF**: nothing. This is the point of training. Comment: normal. |
| Performance decrement over ≥3 sessions of the same class **and** legs ≥ 4 for 3 consecutive days **and** monotony above band | **NFR watch**: `constrain` next 7 days to 70% volume, no intensity; flag a review (`overreach-check`) |
| Decrement ≥ 2 weeks **with** elevated RHR ≥ 7 bpm sustained **or** sleep/mood disturbance ≥ 7 days | `hard_stop` on quality sessions; 14 days at reduced volume; referral language; no condition naming |
| Any red flag from [red-flags-for-escalation.md](red-flags-for-escalation.md) | Stop + refer, irrespective of the pattern above |

Rules that follow from the consensus rather than from taste:

1. **Subtract, never prescribe a cure.** "Reduced training is the treatment" is the only therapeutic
   statement we make ([FB-S1]). No supplement, no protocol, no "deload formula" presented as medicine.
2. **Require corroboration.** One depressed session is data; three below-band sessions plus two
   symptom channels is a pattern. Single-signal triggers are what make runners distrust an app
   ([review-policy-evidence.md](../feedback-and-autoregulation/review-policy-evidence.md#practice)).
3. **Never use the words overtraining or overreached as a label in UI copy.** Describe what was observed
   and what we changed: *"Three sessions came out harder than planned and your legs have been heavy for
   four days. I've taken intensity out of this week."*
4. **The runner may decline the reduction, not the stop.** `non_overridable: false` on the constrain
   level, `true` on red-flag stops. Declines are recorded and used to raise that trigger's threshold
   rather than to argue ([review-triggers.yaml#rejected-review-is-data](../heuristics/review-triggers.yaml)).
5. **Energy availability is a separate file, and separate logic** — underfuelling mimics NFR almost
   perfectly, which is why the REDs screen sits alongside this one
   ([red-s-and-relative-energy-deficiency.md](red-s-and-relative-energy-deficiency.md)).

## Controversies

- **Is FOF worth chasing?** Block-periodisation theory treats a short overreach as the stimulus for the
  supercompensation that follows a taper. For our population (recreational, life-limited, injury-prone)
  the risk/reward is poor: we aim for *enough* stimulus and generous recovery. Documented as a design
  value, not a finding.
- **Does HRV suppression indicate NFR?** Mixed, and confounded by sleep, alcohol, and menstrual cycle
  ([../signals-and-metrics/hrv-and-wellness.md](../signals-and-metrics/hrv-and-wellness.md)). Used as one
  corroborating channel, never as a trigger — codified in
  [../heuristics/readiness.yaml](../heuristics/readiness.yaml#direction_policy).
- **How long is "prolonged"?** The consensus does not fix a number. We use ≥2 weeks as our knob
  (`performance_decline_sessions` + windows in `review-triggers.yaml`), which is a choice.
