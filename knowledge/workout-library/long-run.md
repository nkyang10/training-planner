---
id: workout-library/long-run
title: "Long run"
status: draft
confidence: high
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S7, PLAN-S8, PLAN-S11]
---

**Key takeaways**

1. The long run is the plan's **durability** session: the adaptation that decides the last third of a
  race. It is the last session to cut and the hardest to overdo.
2. Growth is in **minutes first, kilometres second**, and the long run must stay ≤ 30–35% of the week.
3. Effort stays easy-to-moderate; the difference between a long run and a marathon-pace run is that the
  long run's *ending* should feel repeatable.
4. Its dose is set by race duration, not race distance: 60% of expected race time is the minimum
  durability marker, 70–75% the maximum useful dose for non-professionals.

## Purpose

Musculoskeletal and metabolic durability: glycogen storage and fat oxidation at hours-long effort,
slow-twitch fibre recruitment under fatigue, gut tolerance for fuel, plus the confidence of having been
out there for the distance. Also the session that establishes the weekly volume ceiling.

## Structure

```yaml
duration: 60–180 min (persona/distance-dependent; ultrarunners to 300)
placement: "the day with the most free time; normally Sat or Sun; must not follow a hard day"
pace: "easy +20 to +45 s/km from easy-run pace late in the run is acceptable drift"
fuel_rehearsal: "the user's own routine; the app schedules the rehearsal, prescribes no amounts"
gear_rehearsal: "race shoes and race kit at least twice before race week"
variants: [continuous-easy, progression, fast-finish, back-to-back-partner, trail-time-on-feet]
```

## Dosing by goal

| Goal / persona | Peak duration | Frequency | Notes |
|---|---|---|---|
| First 5K | 45–60 min | 1/wk | by minutes; run/walk allowed |
| 10K | 60–80 min | 1/wk | no pace work inside it needed |
| Half marathon | 90–110 min | 1/wk | 20–30 min race-pace block from week 6 |
| Marathon | 120–150 min **or** 30–34 km | 1/wk | ≤ 25% of weekly km at MP inside it [PLAN-S8 grade C] |
| Finish-only marathon | 100–140 min continuous | 1/wk | no pace target; "able to continue" is the metric |
| Ultra | 150–300 min | 1/wk | ≥ 2 sessions at 60–75% of race time; hike the steeps |
| Masters 40+ | 90–120 min | 1/wk | cap by time, recover with a full easy day after |
| Time-poor 3-day | 75–100 min | 1/wk | the most protected session of the week |

Ceilings and weekly-share rule: `→ rule: heuristics/load-progression.yaml#long_run_share_pct` (range
20–40). Growth: +10 min or +2–4 km per step, never both. [see
`plan-construction/mileage-and-progression.md`]

## Intensity prescription

- Default: Z1 throughout, RPE 3–4, drifting to 5 in the last 20 min — that drift is fine.
- Only the **Specific phase** adds intensity inside it, and only in one of three legal shapes:
  1. progression: last 20–30 min at marathon pace;
  2. sandwich: easy / 30–60 min @ MP / easy;
  3. fast finish: last 10–15 min at half-marathon effort, once per macrocycle.
- Never a full-length race-pace long run: the load-equivalent cost of 30 km at MP approaches that of an
  interval session stacked on 2+ hours of impact. Load-equivalent weights live in
  `plan-construction/mileage-and-progression.md` (engineering defaults, `status: contested`).

## Common errors

- Longest run of the block 8–10 days before the race; the fatigue outlives the benefit.
- Growing the long run 5 km a week while the weekly total also grows — double load rise. [PLAN-S7]
- Making it a race against a training partner, then arriving at the next key session in a hole.
- Adding it as a make-up session for a missed midweek run.
- Ignoring the 30–35% weekly-share ceiling: a 32 km run inside a 55 km week is 58% — the week has no
  structure, only a spike.
- Zero downhill or trail practice for a trail race, then a destroyed quad at km 40.
- Fueling for the first time on race day.

## Contraindications / substitute

- Substitutes when impact is limiting: a long bike/aqua session preserves time-on-feet but **not**
  running-specific durability; label it clearly and keep the plan's race expectation honest.
- Contraindicated (substitute a shorter run) when: a pain report in the last 72 h, a long run already
  done the previous day in a back-to-back block, < 6 h sleep the night before, or fever symptoms.
- Novice, post-layoff, and postpartum personas: no back-to-back partner session and a hard ceiling of
  ~90 min until the persona's clean-week rule is satisfied.

## Progression ladder

1. **Time**: 60 → 75 → 90 → 105 → 120 min, one step per week, never two.
2. **Shape**: continuous-easy → progression (last 20 min quicker) → MP sandwich → MP block extended.
3. **Terrain**: road → park/trail → race-like surface (mandatory for trail personas).
4. **Weekend structure**: single long run → long run + next-day 40-min easy run (back-to-back) — the
   last rung, only in Specific, ≤ 2 per block, ≥ 10 days apart.
5. **Taper reverses the ladder**: duration first, then intensity, frequency last. [PLAN-S5,
   `plan-construction/taper-and-peak.md`]
