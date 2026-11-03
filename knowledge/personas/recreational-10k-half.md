---
id: personas/recreational-10k-half
title: "Persona — recreational 10K and half-marathon runner"
status: draft
confidence: medium
evidence: [review, cohort, practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S1, PLAN-S2, PLAN-S4, PLAN-S8]
---

**Key takeaways**

1. This is the persona the runner-specific distribution evidence actually covers: sub-elite to
  recreational runners improved more with a low-intensity-heavy distribution than a
  moderate-heavy one. [PLAN-S4 grade B]
2. The limiter is almost never the top end — it is the **middle**: easy runs run too fast, and a long
  run that is secretly a tempo run.
3. Half-marathon training fails on **specificity**: enough volume, no race-pace exposure. 10K training
  fails on **patience**: too much threshold, too little real 5K-pace work.
4. Two quality sessions per week, one long run, everything else honestly easy. That is the whole
  architecture.
5. Race frequency is the biggest schedule risk: this persona tends to race 6–8 times a season and
  calls them all "training".

## Facts

- 12 sub-elite distance runners, 5 months: 80.5% Z1 / 11.8% Z2 / 8.3% Z3 improved a simulated 10.4 km
  race by 157 ± 13 s versus 121.5 ± 7.1 s for 66.8% Z1 / 24.7% Z2 / 8.5% Z3 (p = 0.03). The differing
  variable was moderate-intensity volume. [PLAN-S4 grade B, n = 12]
- Observed elite distribution: ~75% / 8% / 17% by HR in 384 sessions of national-level junior athletes
  (cross-country skiers). [PLAN-S1 grade B cohort, non-running]
- Prospective comparisons favour a polarized over a threshold-heavy distribution for time-trial
  outcomes. [PLAN-S2 grade A review]

## Practice

- Volume anchor: growth follows `plan-construction/mileage-and-progression.md`; the persona's own risk
  is holding a peak too long. Peak weeks 3–4, then race or reset.
- Long run: 60–100 min (10K block) → 80–120 min (half block). Race-pace work inside the long run starts
  5–7 weeks out for a half (e.g. 4 × 2 km @ half pace, building to 8 km continuous).
- Threshold dose: 20 min continuous or 3 × 8 min cruise intervals; ≤ 10% of weekly km at T. [PLAN-S8
  grade C]
- Weekly hard-day count 2 (3 only for ≥5 days and ≥60 km/wk, and never in the same week as a volume
  increase).
- Race-as-training is allowed and encoded: 1 B/C race per 4–6 weeks in Base, counted as the week's key
  session with the rest of that week easy.

## Controversies

- **How much threshold for a half?** Coaching texts disagree (2 sessions/wk vs 1). The meta-analytic
  signal favours polarized over threshold-heavy, so the engine defaults to **1 threshold + 1
  VO2/race-pace session** and only offers the second threshold on request. [PLAN-S2] status: contested
- **Does a recreational runner need a 12-week half marathon plan?** Many do well on 6–8 focused weeks;
  longer plans invite staleness and volume creep for this population. Engine offers 6/8/10/12 and
  recommends the shortest that reaches the volume target. status: contested
- **Pace vs HR for this persona.** HR is honest on easy days and dishonest in heat; pace is honest on
  key days and dishonest on hills. Prescribe pace bands + feel, use HR as the easy-day governor.
  status: contested

## Plan shape

```yaml
weeks: 8 default (6 / 10 / 12 allowed)
sessions_per_week: 4 preferred; 3 supported with a 1-key shape; 5 for volume-raising blocks
hard_days: 2
volume_range: 32–75 km/wk (warn above persona ceiling table)
phase_split: {base: "40–45%", build: "30%", specific: "20%", taper: "10–12%"}
shape_4_day:
  - {tue: "KEY-1 alternating: intervals 5×4′ @ I  |  cruise intervals 3×8′ @ T"}
  - {wed: "easy 40–50 (strides ×2/wk)"}
  - {sat: "KEY-2 long run 70–120 min, race-pace block from wk 5 of the half block"}
  - {sun_or_thu: "easy 40"}
races: {b_race_rule: "counts as KEY-1 that week; following week ≤ 80% volume; none in the last 3 weeks"}
taper: {days: 10, volume_cut_pct: 45, frequency_floor_pct: 75}
```

## Typical self-inflicted errors

- Easy runs at 75–85% of hard pace → the "everything is medium" week the 12-runner trial punished.
- Adding mileage and intensity in the same week, twice in a row.
- Racing a 10K on Saturday and calling Thursday's tempo run "sharp work" two days before the A race.
- Long runs where the last third is at half pace without it being programmed (drift, not design).
- Chasing a parkrun PB in the middle of a half-marathon build, then losing 10 days to a calf.
- Doing no strides all block and being surprised by leg speed on race day.

## Messaging tone

- Adult, specific, a little technical: this persona reads the "why". Give the reason and the number
  range, not the slogan.
- Name the mechanism once, then use the shorthand: "easy means easy so Thursday's 8-milers land".
- Challenge is welcome here — but always with the evidence attached, never as a boast.
- Do not say: "trust the process" with no process named; "you're not serious about racing"; any promise
  about a predicted time.
- Examples (EN):
  - Easy drift: "Saturday's long run averaged 4:52 with 5:05 for the first half. That's a tempo run in
    easy clothing. Next one: cap the first 60 min at 5:25 and let the last 20 min happen if it wants
    to."
  - Good week: "Two clean quality sessions and an easy week around them — that is the exact shape that
    worked in the research with runners close to your profile."
- 繁體中文（語氣：尊重、具體、給理由）：
  - 輕鬆跑太快：「週末長跑前半段 5:05、整體 4:52，這其實是披著輕鬆跑外衣的節奏跑。下一次前半小時請設在 5:25 以內。」
  - 完成度好：「這週兩次品質課都穩定完成，其他日子都很輕鬆——這就是業餘跑者最有效的週結構。」

## Review sensitivity

- **Medium overall.** This persona reports often and over-reports significance; the engine must resist
  one-session re-pacing (see `plan-construction/measurement-and-testing.md` anti-triggers).
- Triggers: 2 consecutive weeks with < 75% completion → shrink, don't advance. Any pain in the same
  location twice → downgrade one quality session. Race within 3 weeks + a B race requested → decline
  the B race, offer a rehearsal run.
- Not triggers: one missed session, a slow split on a hot day, "felt flat", HR 6 bpm above usual for a
  single run.
- Preferred change type: **reschedule or shorten**, not delete; this persona's adherence improves when
  the plan keeps its rhythm.
