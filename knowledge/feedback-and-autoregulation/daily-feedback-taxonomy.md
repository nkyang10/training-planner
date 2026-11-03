---
id: feedback-and-autoregulation/daily-feedback-taxonomy
title: What a runner can tell us every day, and what each answer is actually worth
status: draft
confidence: high
evidence: [review, practitioner]
applies_to: [all]
last_reviewed: 2026-11-03
owner: fb-agent
supersedes: []
sources: [FB-S1, FB-S4, FB-S6, FB-S9]
---

## Key takeaways

- **Ten fields carry almost all of the decision value.** Everything else is optional depth that
  costs adherence. The taxonomy below is ranked by *information per second of runner effort*.
- `legs` (heaviness) and `rpe` are **different questions** and both are needed; collapsing them loses
  the ability to tell "fit" from "fresh".
- A skipped session's **reason** changes the plan more than the skip itself. Missing a session before
  a travel week is noise; missing the third hard day in a row is a signal.
- Free-text notes matter for *context* and almost never for *numbers*. The engine reads intent codes;
  the narrator reads tone.
- Every field has a **missing-data branch**. A runner with no watch, no HR, and 20 seconds of effort
  must still get a useful comment. Design for that runner first, not the 1%-device-complete one.

## Facts — the fields, in value order

| # | Field | Scale | What it predicts / reveals | Cost to answer | Drives |
|---|---|---|---|---|---|
| 1 | Did it happen? `outcome` | rest · completed · partial · skipped · missed | adherence, completion rate, whether the plan fits real life | 1 tap | `completion_rate`, missed-session rules |
| 1b | What was actually done? `sessionTaken` | as-prescribed · alternate · extra · none | an alternate is a success for load but not for running ramp; extra subtracts rather than earning credit | 0 extra taps (derived from the same tap as `outcome`) | missed-session rules |
| 2 | `outcomeDetail` (why) | illness · travel · work · family · sleep · motivation · pain · weather · equipment · just-didn't | intent, risk trajectory, whether to escalate | 1 tap | `adherence_intent_mix`, review triggers |
| 3 | `legs` | 1–5 (feathered → wrecked) | residual fatigue; the strongest single subjective predictor of a bad next session | 1 tap | micro-adjust of the next day |
| 4 | `rpe` | 1–10 | true internal load (session-RPE load), the `rpe_gap` signal — prescription vs reality | 1 tap | `load_sRPE`, `rpe_gap`, zone calibration |
| 5 | `pain` (site + intensity + next-morning + gait) | 0–10 + 3 booleans | injury trajectory; the only field that can trigger a **non-overridable** stop | ~10 s | safety layer, `pain_trend` |
| 6 | Sleep hours | hours | short-term capacity, and (weakly) injury risk when chronically short | 1 tap | `sleep_debt`, display, advise |
| 7 | Illness symptoms (above/below neck, fever) | enum | stop-vs-continue decisions | 1 tap | safety hard stop |
| 8 | Soreness / `musore` | 1–5 | tissue response, distinguishes muscle damage from systemic fatigue | 1 tap | advise, micro-adjust |
| 9 | `mood` / `stress` | 1–5 | life-load context; a tiebreaker and an honesty check on the load story | 1 tap | display, advise only |
| 10 | Note (free text) | text | the reason behind anomalies; the raw material for tone | optional | narrator, intent codes |

Device-derived facts (HR, pace, HRV, cadence) sit *beside* this list, not above it: they refine
numbers but cannot supply intent, and roughly half of amateur runners never provide them
([docs/architecture/integrations.md](../../docs/architecture/integrations.md)).

## Facts — what each answer is *not*

- `rpe` is not effort during the session only: it is the runner's whole-session judgement, and it
  drifts with experience. A novice's 7 and a veteran's 7 are not the same load ([FB-S6]).
- `legs` at 4 the morning *after* a long run is normal; `legs` at 4 on the third easy day of a week is
  the interesting case. Interpretation is always relative to plan position — see
  [interpretation-windows.md](interpretation-windows.md).
- `mood` is not an adherence lever. Using it to praise or shame would be the fastest way to make it
  dishonest, and a dishonest field is worse than an absent one ([FB-S9];
  [docs/ux/feedback-microcopy.md](../../docs/ux/feedback-microcopy.md#never-say)).
- A 0/10 pain report after a hard session is not evidence of no risk; it is one observation.
  Trajectory, not level, is what carries information
  ([risk-and-safety/injury-risk-and-pain-triage.md](../risk-and-safety/injury-risk-and-pain-triage.md)).

## Practice — how the form is presented

1. **Three taps minimum, and it must be possible to stop there.** `outcome` → `rpe` → `legs`. The
   system comment is generated from those three plus what happened. `sessionTaken` rides along on
   the same tap as `outcome` (a long-press offers alternate/extra) so it costs nothing.
2. **Ask about pain only when there is something to ask.** A body map on every day trains runners to
   answer nothing; ask when a session was hard, a session was skipped for `pain`, or a pain exists in
   the last 14 days.
3. **Remember yesterday** for wellness fields; a delta is the useful question, not an absolute.
4. **Never block the save.** A partial entry saves and the comment says what is missing —
   "no RPE, so I used distance and pace band" is honest and keeps the loop alive.
5. **Backfill window 72 h silently, 7 days with a `correctionReason`**
   ([docs/engine/feedback-loop.md](../../docs/engine/feedback-loop.md)).
6. Ask the *next* day's intent on the evening of a rest day ("tomorrow: as planned / listen to body /
   just move") — one tap that turns the next morning's entry into a conversation instead of a report.

→ rule: `heuristics/daily-feedback-rules.yaml#minimum-viable-entry`
→ rule: `heuristics/daily-feedback-rules.yaml#pain-question-trigger`

## Controversies

- **How much subjective data is too much?** The monitoring literature favours daily, multi-item
  wellness questionnaires; coaching practice and our own adherence constraint favour 3–5 items.
  Nobody has published the trade-off for a self-coached app. Our answer: minimal daily core, deeper
  weekly questions on the Sunday summary, and *never* more depth than the plan can act on.
- **Is `mood` worth collecting at all?** It correlates with overreaching in cohort data, and it is the
  item most likely to be answered performatively. Kept as display-only, low weight, permanently.
- **Numeric pain scales.** A 0–10 scale is crude and culturally variable, yet a triage rule needs a
  number. We use the number only for *trend* and let the three booleans (next-morning, gait, night)
  carry the escalation decisions.

## Escalate to a clinician

Pain and illness fields can trigger a stop and a referral, never a diagnosis or a treatment plan. Any
entry containing chest pain, fever with a below-neck illness, night pain, or blood in urine ends the
conversation with the referral section and no training advice
([risk-and-safety/guardrails-and-disclaimers.md](../risk-and-safety/guardrails-and-disclaimers.md)).
