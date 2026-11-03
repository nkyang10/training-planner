---
id: periodization/models-comparison
title: "Periodization models compared: what a generator should default to"
status: draft
confidence: medium
evidence: [review, cohort, practitioner]
applies_to: [plan-generator, onboarding, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S3, PLAN-S4, PLAN-S5, PLAN-S7, PLAN-S8, PLAN-S9, PLAN-S10, PLAN-S11]
---

**Key takeaways**

1. No phase model has been shown superior across runners. The transferable, measured variables are
   intensity distribution, progression rate and taper — not the name of the block. [PLAN-S2]
2. Default for this product: **phase-labelled linear skeleton + concurrent week + 3:1 load cycle**.
   Phases give the calendar a story the user can repeat; the week stays concurrent so nobody needs
   six sessions a week.
3. A model is only valid at the session count it assumes. Block periodization assumes high volume;
   Hansons assumes six days; most of our users have three to five.
4. Every model fails the same way in recreational runners: the easy days drift to medium, so the
   "hard" day stops being hard. Enforce distribution before enforcing model. [PLAN-S2]
5. The engine does not pick a model per user by cleverness: it picks the model whose *constraints*
   the user's calendar satisfies, and records why.

## Facts

- Prospective trials compare *intensity distributions*, not named models: polarized beats
  threshold-emphasised in well-trained and recreational subjects in the studies a review summarises;
  retrospective profiles of elites are mostly pyramidal. [PLAN-S2 grade A review]
- Runner-specific randomised comparison, 12 sub-elite middle-distance runners, 5 months: a programme
  with 80.5 ± 1.8% low / 11.8 ± 2.0% moderate / 8.3% high improved a simulated 10.4 km cross-country
  race by 157 ± 13 s versus 121.5 ± 7.1 s for 66.8% low / 24.7% moderate / 8.5% high (p = 0.03).
  Small sample, one event, but it is runners rather than cyclists. [PLAN-S4 grade B]
- Polarized beats threshold-emphasised training for time-trial performance across 3 low-to-moderate
  quality studies: effect size −0.66 (95% CI −1.17 to −0.15). [PLAN-S3 grade A meta, small base]
- Taper: a ~2-week taper with exponential volume reduction of 41–60% maximised performance in a
  meta-analysis; intensity and frequency were not reduced. [PLAN-S5 grade A]
- Practical shape of a published book plan (Daniels' half-marathon, 3rd ed., 118 pp. of plans): four
  phases of 4–6 weeks, three quality sessions per week in phases 2–4, phase 4 mostly threshold with
  two quality sessions per week. The reviewer's own criticism: the book gives no down-weeks, only a
  passing reference to rest days, and a weak strength section. [PLAN-S9 grade D practitioner blog]
  → rule: heuristics/periodization-models.yaml#quality_sessions_per_week (range 0–3)

## Practice

### Model cards

| Model | Typical macro shape (weeks) | Weekly intensity bias | Signature key session | Suits | Failure modes |
|---|---|---|---|---|---|
| **Linear (classic)** | base 8–12 → build 6–8 → sharpen 4–6 → taper 2–3 | volume → intensity, distribution ~80/20 throughout | long run → threshold → intervals at race pace | first serious race block, coached athletes, generators | base "medium-ish" creep; aerobic decay in sharpen; base too long for masters; phases outlast motivation |
| **Block (accumulating / transmuting / realizing)** | 2–4 wk per block + 1 wk transition; 3–6 blocks per season | one emphasized quality per block, others maintained at minimum dose | block-matched: 3×8 min threshold → 5×3 min VO2 → race-pace | multi-race seasons, track/road 5K–10K, ≥5–6 sessions/week, high volume | other qualities decay; needs volume the user does not have; "focus block" becomes all-medium; overlapping stimulus in week 3 |
| **Concurrent / daily-undulating** | 12–18 wk continuous, qualities side by side | 3 qualities coexist weekly, distribution preserved by capping each | hard-easy pairs: Tue speed, Thu threshold, Sat/Sun long | 4–5 days/week recreational, multi-distance racers, people who race often | every session feels medium; no clear peak; hard days stack silently |
| **Reverse (intensity/volume-first reversed)** | intensity 6–8 wk first, race-specific volume last | high intensity early at low volume | short reps + strides early, long run lengthens late | masters, time-poor, winter/indoor, ultra runners needing late durability | race-specific endurance arrives late; hard session before tissue tolerance; little runner-specific trial evidence (contested) |
| **Daniels' phases** | PT → PF (aerobic support) → Build → Race/Fixation → Maintain/Repair; variants 4–8 wk each | threshold + interval twice weekly in Build, MP work in Fixation | cruise intervals, then MP run | plan-followers who want explicit paces from one test; 5K–marathon | no down-weeks in the book's own plans; MP volume can exceed a recreational week |
| **Hansons** | ~18 wk, three-week cycles, deliberate cumulative fatigue; taper last 3 wk | high frequency of quality; "hard-easy" pairs; short long run (≈16–20 mi ceiling) | Friday short long + Saturday long, Thursday lactate-threshold | experienced marathoners with ≥5–6 days and a stable base | skips recovery weeks by design; brittle for injury-prone or time-poor users; hard to justify to a 3-day runner |
| **Pfitzinger** | 3:1 or 2:1 cycles inside 12–16 wk, marathon-specific last 8–12 wk | progression long runs + one threshold + strides | progression long run (middle/last segment at MP) | improvers with 4–6 days, moderate volume, goal times | progression long run overreaches on tired legs; volume ceilings ignored |

[PLAN-S8, PLAN-S10, PLAN-S11 grade C textbooks; PLAN-S9 grade D corroboration]

### Why the generator defaults to the hybrid

- Phases are **cheap to explain**: "you are in week 3 of Build" survives as a sentence a user can
  repeat back, which the daily comment needs.
- The week must stay **concurrent** because 3–5 running days cannot rotate single-quality blocks
  without losing everything else.
- The engine can enforce what is actually measured (distribution over a 28-day window, progression
  rate, taper) inside any label.
- Reviews rewrite future sessions only, so the model must be **re-derivable from today's date and
  the race calendar**, not from a fixed start day written in stone. A phase machine with absolute ISO
  boundaries satisfies this; a rigid 18-week grid does not.
- → rule: heuristics/periodization-models.yaml#default_model (linear-phased-concurrent)
- → rule: heuristics/periodization-models.yaml#macro_length_weeks (range 8–36)
- → rule: heuristics/periodization-models.yaml#block_min_weeks (range 2–6)

### Model selection is constraint satisfaction, not taste

- ≥5 running days AND ≥1 prior race at distance AND goal is a time → allow block or Hansons-flavoured
  concurrent.
- ≤4 days OR returning OR injury history → linear-phased concurrent, max 2 quality sessions/week.
- Race within 6 weeks → skip straight to SPECIFIC/TAPER; do not start a base block.
- Two A-priority races < 6 weeks apart → one shared build, second race becomes a hard session.
- → rule: heuristics/periodization-models.yaml#max_quality_sessions (range 0–3)

## Controversies

- **"Recovery weeks are optional."** Hansons' cumulative-fatigue design omits them; load-progression
  practice and injury reviews treat rapid load rise as the main modifiable risk. The engine treats
  down-weeks as on by default and off only for an explicit, recorded opt-in. [PLAN-S7, PLAN-S10]
  status: contested
- **Block periodization in runners.** Most block evidence is from strength sports and cycling; the
  runner-specific comparison literature is about distributions. Treat block as a shape, not a
  proven advantage. [PLAN-S2] status: contested
- **Reverse periodization** has enthusiastic coaching follow-up and thin runner-specific trial data.
  Offer it as an option for masters/time-poor, labelled experimental. status: contested, low
- **How many quality sessions** an amateur can absorb: 2 (Daniels-style), 3 (book half plans), 3
  plus a "short long" (Hansons). Individual; cap by persona and by 28-day hard-day ratio.

## Individual differences

- Age ≥40, ≥1 injury in 12 months, <6 months continuous running, or <4 advertised days: prefer fewer
  qualities per week, longer phases, mandatory down-weeks.
- High training age with a stable 5-year base: model choice matters less than session quality; keep
  the same shape across years rather than chasing novelty.

## Gaps to verify

- Hansons' exact cycle length, "down week" policy and long-run ceiling: re-read the book and replace
  the D-grade summary. [PLAN-S10]
- Pfitzinger volume tables by goal time: not re-verified in this pass; quoted numbers in
  `plan-construction/mileage-and-progression.md` are flagged low. [PLAN-S11]

## Escalate to a clinician

Not applicable. Injury-related model changes are handled by
`risk-and-safety/red-flags-for-escalation.md` and the safety layer, which can only subtract.
