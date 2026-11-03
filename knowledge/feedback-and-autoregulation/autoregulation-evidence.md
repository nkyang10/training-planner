---
id: autoregulation-evidence
type: evidence
status: draft
tags: [autoregulation, evidence, self-management, adherence]
sources: [FB-S1, FB-S9]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Does letting the plan react to the runner actually help?

**Bottom line:** autoregulation reliably improves **adherence and tolerance**, and the evidence that it
improves **performance** over a well-chosen fixed plan is thin and mostly not in runners. Our design
therefore treats autoregulation as a *retention and safety* mechanism with a performance hypothesis
attached — not as a proven performance edge. Anyone selling "adaptive AI coaching" as an outcome
improvement is ahead of the literature.

## Facts

- The functional-overreach → non-functional-overreach → overtraining continuum, and the finding that
  **no marker or test diagnoses OTS**, are consensus ([../sources/bibliography.md](../sources/bibliography.md)
  [FB-S1]). That is the strongest autoregulation argument we have: the cost of continuing is
  disproportionately large and there is no blood test that saves us.
- Autoregulation is old practice, not new technology. Arthur Lydiard adjusted weeks on feel; Daniels
  prescribes "run the I session until it stops feeling like an I session". Grade C.
- The self-determination framing (competence, autonomy, relatedness) predicts continued exercise
  better than the plan's optimality does ([FB-S9], **pending citation verification**). Our autonomy
  choices — the runner accepts or declines a review, always sees the diff — come from here, not from a
  performance study.
- Where adaptive protocols have been tested (HRV-guided training being the best-known family), results
  are mixed and typically in **cyclists or recreators over 4–10 weeks**, with small samples. See
  [../signals-and-metrics/hrv-and-wellness.md](../signals-and-metrics/hrv-and-wellness.md) for the
  specific trial-level claims and their grades rather than repeating them here.
- Nobody has shown that *daily* plan changes beat *weekly* plan changes. Our choice — micro-adjust only
  tomorrow, structural change only at a review — is a bet on the interpretation windows in
  [interpretation-windows.md](interpretation-windows.md), not a tested design.

## What we are actually claiming (and what we are not)

| Claim | Status in this repo |
|---|---|
| Adjusting on pain/illness/fever reduces harm | Accepted on consensus + mechanism ([FB-S1], [FB-S3]) |
| A plan the runner accepts is more likely to be followed | Accepted (SDT framing, [FB-S9] pending) |
| Reactive plans improve race outcomes vs a good fixed plan | **Not claimed.** Hypothesis; `confidence: low` |
| Daily micro-adjustment is better than weekly | **Not claimed.** Our cadence is a design choice |
| An LLM comment improves adherence | **Not claimed.** Must be measured — see [feedback-loop-metrics.md](feedback-loop-metrics.md) |

The reason this table exists in the knowledge base: marketing copy is written by people who have not
read it. Every row in the lower half must be argued with data from *our* users before it may appear in
the product.

## Practice

1. **Every automatic change must be explainable without the model.** If we cannot say which signal,
   which window, and which knob, the change does not happen. This is what makes the thin evidence
   tolerable: the mechanism is legible, so a wrong rule is discoverable.
2. **Subtract freely, add slowly.** Reversibility asymmetry, documented in
   [interpretation-windows.md](interpretation-windows.md#practice). Cost of an unnecessary rest day is
   ~0; cost of a stacked weekend is weeks.
3. **Give autoregulation a floor and a ceiling.** Hysteresis, dwell, and `max_changes_per_review` in
   [../heuristics/review-triggers.yaml](../heuristics/review-triggers.yaml) exist because a reactive
   system with no damping is *less* trustworthy than a rigid one — runners describe the loss of trust as
   "it keeps changing my plan".
4. **Measure the counterfactual in the product, not in a lab.** Log every review offer, its options, the
   choice, and the following 14 days of completion. That data is both the adherence evidence and the
   training data for calibrating thresholds.

## Controversies

- **"Adaptive" as identity vs mechanism.** Products market adaptability; the literature mostly
  demonstrates tolerance. We say what it does, never what it guarantees.
- **How much autonomy is good?** Full runner control produces drift toward comfort (skipping intervals,
  running easy days too fast). Our compromise: the runner always chooses, but the *options* are authored
  by the engine, and "keep the plan" is always option one.
- **Does narrating the mechanism help or exhaust?** Unresolved — see
  [system-comment-playbook.md](system-comment-playbook.md#controversies).
