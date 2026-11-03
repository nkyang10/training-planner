---
id: periodization/intensity-distribution
title: "Intensity distribution: 80/20, polarized, pyramidal, and what a generator enforces"
status: contested
confidence: medium
evidence: [meta-analysis, review, cohort, practitioner]
applies_to: [plan-generator, workout-picker, review-engine, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S1, PLAN-S2, PLAN-S3, PLAN-S4, PLAN-S6]
---

**Key takeaways**

1. 80/20 is an **observed distribution in trained athletes**, not a prescription measured in
   recreational runners. The primary cohort behind it is 11 junior elite cross-country **skiers**.
   [PLAN-S1]
2. The comparison literature supports "polarized ≥ pyramidal, and polarized > threshold-heavy" — the
   harm case is stronger than the optimum case. Build the engine to prevent a **middle-heavy** week,
   not to hit a magic ratio.
3. Enforce the distribution over a **rolling 28-day window**, never per week; a 3-day week cannot
   contain 20% high intensity without rounding errors.
4. The most common real failure is not too much hard running — it is too much **medium** running
   (junk miles): easy days at 75–85% of hard pace, hard days below threshold.
5. Hard-day **placement** is as load-bearing as the ratio: at least one easy day after every hard
   day, and no two hard days adjacent unless the persona file explicitly allows a back-to-back.

## Facts

- Observed distribution, elite junior endurance athletes (n = 11 nationally competitive male
  cross-country skiers, 384 sessions over 32 consecutive days, HR-based): **75 ± 3% low / 8 ± 3%
  moderate / 17 ± 4% high**; session-RPE gave 76 ± 3 / 5 ± 3 / 18 ± 4%; lactate in 60 sessions:
  71% < 2 mM, 7% 2–4 mM, 22% > 4 mM. [PLAN-S1 grade B cohort, non-running population]
- Review of retrospective and prospective training-intensity-distribution (TID) studies: most
  published elite profiles are **pyramidal** (high low-intensity volume, moderate moderate-volume,
  small high-intensity volume); some world-class athletes train polarized in certain phases;
  prospective randomised studies show **superior endurance adaptations for polarized** compared with
  a distribution emphasising high-volume low-intensity or threshold work in well-trained and
  recreational individuals. [PLAN-S2 grade A review]
- Meta-analysis, polarized vs threshold-emphasised: 4 studies (3 pooled) for time trial, low method
  quality (PEDro 4–5/10), **ES −0.66 (95% CI −1.17 to −0.15)** favouring polarized. [PLAN-S3 grade A
  meta / grade B base studies]
- Runner-specific randomised comparison, 12 sub-elite runners, 5 months: 80.5 ± 1.8% Z1 / 11.8 ±
  2.0% Z2 / 8.3 ± 0.7% Z3 improved a simulated 10.4 km race by **157 ± 13 s**; 66.8 ± 1.1% Z1 /
  24.7 ± 1.5% Z2 / 8.5 ± 1.0% Z3 improved by **121.5 ± 7.1 s** (p = 0.03). Note what differs is
  *moderate* volume (11.8% vs 24.7%), not high volume (equal at ~8%). [PLAN-S4 grade B]
- Network meta-analysis of individual participant data on TID and VO₂max / time-trial performance
  exists (Sports Med 2025); its pooled effect estimates were **not re-read in this pass**, so no
  number from it is used here. [PLAN-S6 grade A; confidence in this entry: low]
- → rule: heuristics/intensity-distribution.yaml#pct_high_zone (range 3–20% of weekly time)
- → rule: heuristics/intensity-distribution.yaml#pct_moderate_zone (range 5–25% of weekly time)
- → rule: heuristics/intensity-distribution.yaml#window_days (range 14–56, default 28)

## Practice

### Zones the engine actually uses

Three zones by **purpose**, not by a device's HR algorithm:

| Zone | Feel | Pace anchor | Purpose |
|---|---|---|---|
| Z1 easy | conversational, nose-breathable | ≥ 60 s/km slower than 10K pace, or < 75% HRmax | volume, tissue tolerance, recovery |
| Z2 moderate/"comfortably hard" | 3–5 word sentences | half-marathon to 10K pace | threshold, MP adaptation |
| Z3 high | 1–2 words or none | 5K pace or faster, incl. strides/reps | VO₂max, neuromuscular, race rehearsal |

A session counts as Z1 only if the **whole** session is Z1; a long run with 40 min at MP counts its
MP minutes in Z2. This is how the generator keeps the ratio honest instead of naming everything easy.

### Product defaults (reversible, engine-level)

- 28-day rolling target: **~75–85% Z1, ~8–15% Z2, ~5–15% Z3** of running time.
  These bands are an engineering default sitting inside the ranges above, not a measured constant.
- Hard-day cap by days available: 3 days → 1 hard + optional strides; 4 days → 2 hard; 5 days → 2
  hard + 1 medium-long; 6–7 days → 3 hard max. → rule: heuristics/intensity-distribution.yaml#hard_days_cap (range 1–3)
- A week is never judged alone. If week N is threshold-heavy, the generator repairs it by making week
  N+1 easy, not by deleting the session retroactively (we never rewrite completed days).
- Long run intensity is **earned**: MP or threshold segments inside the long run only after 6 weeks
  of consistent running and a weekly volume that can absorb them (see
  `plan-construction/mileage-and-progression.md`).

### Easy-day quality ("junk miles") — the operational definition

A run is junk when it is too fast to recover and too slow to adapt:

- 5K-pace-for-30-minutes "easy" runs; tempo sessions run at interval pace and then needing two easy
  days; long runs where the last 30 min drift to half pace because the plan had no fuel/rest rule.
- Engine rule: if a session's prescribed pace is within 10 s/km of the user's half-marathon pace and
  its type is `easy`, the plan is wrong — flag it as a generator bug, not as user error.
- Practice rule (coaching, grade C): the easy day should leave the runner feeling better at the end
  than at the start. That is the feedback question we can actually ask on the calendar.

## Controversies

- **Is 80/20 right for recreational runners?** The observation is elite and partly non-running; the
  runner trial above had a *recreational-to-sub-elite* sample and did favour the more polarized
  distribution, but with n = 12 and one 10.4 km simulated race. Treat 80/20 as a safe **upper bound
  on hard work**, not as a floor on easy work. [PLAN-S1, PLAN-S4] status: contested
- **Pyramidal vs polarized.** Retrospective elite data is mostly pyramidal; prospective comparisons
  favour polarized over *threshold-heavy*. Those two statements are compatible: pyramidal and
  polarized differ mainly in how much time sits in Z2, and most elites' Z2 is small anyway.
  [PLAN-S2] status: contested
- **Quality of easy running:** "run slow to go fast" is coaching consensus; individuals with very low
  aerobic backgrounds may need walk-breaks more than slow running, which our engine supports as
  run/walk (see `workout-library/easy-run.md`).
- **Zone model** (3 vs 5 zones, HR vs pace vs power) changes the reported distribution enormously.
  Never compare a user's "80/20" against a device's 5-zone chart; state which model produced a
  number. status: contested

## Individual differences

- **Time-poor (3 days)**: distribution math breaks; instead of chasing 80/20, guarantee one hard,
  one medium-long, one easy session and accept a higher hard-day *fraction*. [PLAN-S2 warns the
  polarized advantage comes from well-trained subjects — a 3-day runner is a different animal.]
- **Masters (40+)**: same distribution, longer spacing — hard days 48–72 h apart, and the second
  hard day of the week is often better replaced with strides + hills.
- **Returning after layoff**: keep Z3 at near zero for the first 2–4 weeks of re-entry regardless of
  how good Z1 feels; the cardiovascular system returns faster than tendon.
- **Trail/ultra**: Z3 becomes hill repeats and sustained uphill efforts; a track-style 17% high-zone
  fraction is neither achievable nor needed.

## Escalate to a clinician

Not applicable. A user reporting chest pain, syncope, or pain that changes gait is handled by
`risk-and-safety/red-flags-for-escalation.md`; the safety layer may only remove sessions.
