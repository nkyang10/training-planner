# What the review/advice literature actually supports — external evidence note

Researched on **2026-11-05** with the search key supplied for this session. These are external sources, not this
repository's corpus: they inform the **coach memory** passages and the review vocabulary, but they do not override the
deterministic gates, and none of them is a medical instruction.

## Sources found

| Topic | Source | What it says (as reported by the source) |
|---|---|---|
| Internal vs planned load | [Inoue et al., 2022, PMC8897524](https://pmc.ncbi.nlm.nih.gov/articles/PMC8897524/) | Session RPE is a practical internal-load measure; coaches' prescribed/intended RPE and athletes' perceived RPE are compared in the study |
| Load quantification beyond weekly distance | [Paquette et al., 2020 (PDF)](https://coachathletics.com.au/s/paquette-et-al-2020-moving-beyond-weekly-distance-optimizing-quantification-of-training-load-in-runners.pdf) | External load (volume, pace) and internal load (session RPE) are different axes; weekly distance alone is incomplete |
| Acute:chronic workload ratio | [Qin et al., 2025, PMC12487117](https://pmc.ncbi.nlm.nih.gov/articles/PMC12487117/) | A review of ACWR's predictive value; the evidence is evaluated, not assumed |
| ACWR for runners | [Full Speed Performance](https://www.fullspeed-performance.com/using-the-acute-to-chronic-training-ratio-for-runners-prevent-or-predict-injuries/) | A practitioner explainer: ACWR as a monitoring heuristic, with the usual cautions about ratios above ~1.3 |
| Readiness monitoring | [Matter Performance](https://matterperformance.com/blog/athlete-readiness-monitoring) | Readiness combines sleep, HRV, soreness, load and subjective state; no single metric is the answer |
| Missed sessions | [TrainRight — missed training](https://trainright.com/what-to-do-if-you-missed-training/) | Guidance to rearrange part of missed days rather than cramming everything into the next week |
| Missed long run | [Your Austin Marathon](https://youraustinmarathon.com/how-to-handle-a-missed-long-run-without-panicking/) | One missed session rarely undoes a block; check why and look at the coming week |
| Coach practice vs evidence | [Wells et al., 2025](https://journals.sagepub.com/doi/10.1177/17479541241305677) | Triathlon coaches' load practices only partly align with evidence-based recommendations; subjective monitoring is not universal |

## How this maps into the product (and what it does not justify)

| Literature point | Product behaviour |
|---|---|
| RPE is a legitimate internal-load input | The day entry records `rpe`; the advisor request carries it; the gates treat a high RPE as a fact, not a diagnosis |
| Weekly distance alone is incomplete | The request already carries planned km **and** RPE **and** signals; the coach memory includes the "beyond weekly distance" passage |
| ACWR is a heuristic with contested evidence | **Not implemented.** No ACWR gate, no "safe ratio" claim. A reference may mention it as context, never as a threshold the model may apply |
| Readiness is multi-factor | The request carries pain, sleep/wellness fields and signals; no readiness score is invented |
| Missed sessions are normal | The plan's rule is **never cram the missed work into the next week**; the coach memory carries that passage, and the deterministic planner already refuses weekly load spikes |
| Coaches' practice is uneven | A reason the product keeps a **deterministic validator + audit row** instead of trusting the model's judgement |

## The honest limits of this note

- These are **external** sources and this note is a reading aid, not a systematic review. The ACWR literature is
  explicitly contested in the sources above; the product therefore does not implement ACWR.
- No source here prescribes a medical action; the safety layer remains the repository's own subtract-only rules, and any
  pain escalation still ends in a clinician referral.
- The coach memory (built in a later slice) cites **repository** documents, not these URLs, so a passage can be
  audited against a file in this repo. This note is the external map, not a second corpus.
