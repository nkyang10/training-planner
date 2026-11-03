---
id: workout-library/test-workouts
title: "Test workouts (field tests that produce a pace anchor)"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S4, PLAN-S8, PLAN-S9]
---

**Key takeaways**

1. A test workout exists to produce **one evidence item**: a dated performance number the pace model can
  use. Everything else the plan does is inference from that.
2. A race is the best test. When there is no race, the 20-minute field threshold test and a 3-mile/5K
  time trial are the two with the least conversion error.
3. Tests are **scheduled, recovered-for sessions** — not something squeezed into a tired week. A test in
  a fatigued week produces a wrong band for weeks afterwards, which is worse than no test.
4. Exactly one active anchor at a time; a new anchor marks the old one `superseded_by`.
   [see `plan-construction/measurement-and-testing.md`]

## Purpose

Set or re-check the pace bands (easy, threshold, I, race-pace), and give the runner an honest, dated
reference for goal conversations. A test is also a rehearsal: it teaches pacing discipline and is often
the most race-like 30 minutes in a training block.

## Structure

```yaml
menu:
  - {name: "race",                 yields: "best anchor; any distance",       need: "a race entry"}
  - {name: "parkrun / 5K TT",      yields: "5K pace → VDOT-style table",     need: "48 h fresh"}
  - {name: "3-mile test",          yields: "5K-ish pace",                    need: "measured course, 48 h fresh"}
  - {name: "20-min field threshold", yields: "threshold pace (avg HR of last 10 min ≈ LT-HR)", need: "30 min, flat loop"}
  - {name: "treadline ramp (+1 km/h per min)", yields: "vVO2max, HRmax",      need: "a treadmill; effort-maximal"}
  - {name: "Yasso 800s",           yields: "marathon-time folklore",         grade: "D — display only, never a band source"}
session: "12–15 min warm-up + 4 × 20 s strides + test + 10 min easy"
placement: "end of a down week or the first week of a new phase; never within 10 days of a goal race"
```

## Dosing by goal

| Phase / persona | Test frequency | Which test | Notes |
|---|---|---|---|
| Base, all | once at the start | race or 5K TT | establishes the anchor and the plan's bands |
| Build | every 4–6 weeks | 20-min threshold or 3-mile | threshold moves fastest here |
| Specific | once, 4–7 weeks out | tune-up **race** (half or 10K) | the best marathon anchor; never later than 3 weeks out |
| Taper | none | — | a taper test is a false reading in both directions |
| Novice | every 6–8 weeks | parkrun or a 20-min "how far" effort | attendance-based progress matters more |
| Masters 40+ | every 6–8 weeks | 20-min threshold (lower max-effort demand) | avoid maximal ramps without clearance |
| Time-poor | every 6 weeks | parkrun fits a slot best | it is also the social anchor |
| Trail/ultra | rarely | a 60-min effort test on terrain, or a race | flat-paced tests mislead here |
| Post-layoff / postpartum | none until late steps | effort-based re-baseline only | a maximal test is not the goal at those steps |

## Intensity prescription

- The test is honest only if the user is fresh: ≥ 48 h since any hard session, ≥ 2 easy days, normal
  sleep, no illness, no fever in the last 7 days, and resting HR normal.
- 20-minute field threshold test: after the warm-up, 20 min as hard as sustainable; **average HR of the
  last 10 minutes** ≈ lactate-threshold HR, and the pace is a threshold approximation for that day's
  conditions. Effort per kilometre should be even or slightly negative-split.
- Ramp test to exhaustion: increments of 1 km/h per minute; the last completed stage ≈ vVO₂max.
  Maximal-effort: not for novices, unmanaged hypertension, or anyone without clearance.
- Pacing rule to state in the session text: "first kilometre at target, not faster" — the dominant
  failure mode of every self-administered test.

## Common errors

- Testing in a fatigued or sick week, then re-pacing the whole plan from a bad number.
- Testing every 2 weeks because the app makes it easy; each test costs a real hard day plus 2 recovery
  days, and the noise between tests is bigger than most true changes.
- Choosing a windy, hilly, crowded or hot course and comparing to an indoor anchor.
- Keeping two competing anchors (an old 10K and a new threshold test) and mixing the bands they imply.
  One active anchor, the other `superseded_by`.
- Reading Yasso 800s or a device "fitness age" as a plan input — grade D, display only, never a band
  source. [AGENTS: device metrics must not drive plan changes]
- Converting a test result to a **goal** in the same sentence. The test yields a band; the goal is a
  human decision that sits inside, at the edge of, or outside that band.

## Contraindications / substitute

- No maximal testing without clinician clearance when: cardiac symptoms, uncontrolled blood pressure,
  recent illness with fever, pregnancy, postpartum below the late impact steps, or a gait-changing
  injury. Substitutes: a recent race result the user already has, a submaximal ramp, or feel-based
  bands with a wider width and a stated expiry date.
- Substitute when conditions are wrong rather than cancelling the plan: move the test 7–10 days, keep the
  week's structure, and log why.
- If the user refuses testing (a legitimate choice), the plan runs on effort bands and the comment
  language must drop pace promises. Honesty rule: no band, no pace claim.

## Progression ladder

1. **Anchor from what exists**: any race in the last 12 months, labelled with its age and conditions.
2. **Submaximal first**: a 20-min threshold test gives usable bands with far less fatigue than a 5K TT.
3. **Then a race**: parkrun or a 5K, which doubles as a goal-race rehearsal for novice personas.
4. **Then phase-appropriate tune-ups**: half marathon 5–7 weeks out for marathoners, 10K 4 weeks out.
5. **Re-baseline on triggers, not calendar**: ≥ 10 days off, a clinician-managed health/medication
   change, fever or resting HR +10% for 3 days, a new season/altitude, or a racing-shoe change.
   [see `plan-construction/measurement-and-testing.md`]
6. **Retire the anchor in the last 10 days**: no new numbers, plan on the existing band, and the comment
  says what it is based on and when it was measured.
