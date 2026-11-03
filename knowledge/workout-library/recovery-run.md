---
id: workout-library/recovery-run
title: "Recovery run"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S1, PLAN-S2]
---

**Key takeaways**

1. A recovery run is a **short, deliberately slow** run placed 18–30 h after a hard day. Its job is to
  make the next hard day possible, not to add fitness.
2. The dose is 20–40 minutes at an effort the user would call embarrassing. If it isn't slow, it isn't a
  recovery run — it's a second medium day. [PLAN-S1, PLAN-S4 junk pattern]
3. It is optional in every persona template and the first running session the plan deletes when a week
  breaks. It is never replaced by a hard session.
4. When in doubt between a recovery run and a rest day, the plan should be able to justify whichever it
  picks, in one sentence, in the plan's own reason strings.

## Purpose

Increase weekly aerobic minutes at almost zero recovery cost, aid perceived freshness (the "loosen up"
effect), and — most valuably — create a structured easy day that protects the spacing between two hard
days. No verified evidence in this knowledge base supports a specific physiological mechanism; keep the
claim behavioural and structural, not mechanistic. [confidence medium, practitioner]

## Structure

```yaml
duration: 20–40 min
effort: "RPE 2–3/10; nasal breathing for the whole session is a usable self-test"
pace: "easy band +15 to +30 s/km SLOWER than the easy-run band; no pace target shown in finish-only mode"
terrain: "flat, familiar, boring, safe; a treadmill at 1% is ideal in bad weather"
placement: "18–30 h after a hard day, or the day after a long run (never 2 days after and 1 day before two hard days)"
hard_rule: "a recovery run never becomes a quality session, in the plan or in the user's head"
```

## Dosing by goal

| Goal | Include a recovery run? | Dose | Notes |
|---|---|---|---|
| First 5K | no | — | 3 days/wk, every session is structural |
| 10K / half, 4 days | optional | 25–35 min | only if the week already has 2 hard days well spaced |
| Marathon, 5–6 days | yes | 30–45 min | the day after the long run is its natural home |
| Finish-only | optional | 25–40 min by time | often better spent walking with the family |
| Trail/ultra | yes | 30–45 min easy off-road | hike the steeps, no surges |
| Masters 40+ | yes, high value | 25–35 min | preferred over a second hard day, always |
| Time-poor 3-day | no | — | the slot is worth more as a key session |
| Post-layoff | not yet | — | frequency comes before extra easy volume |

## Intensity prescription

- The only correct intensity is "slower than the easy run". Set the ceiling by effort and stop the
  session when the effort rises: 25 honest minutes beats 45 drifting ones.
- Do not show pace feedback during it if the user tends to speed up; show duration only. This is a UX
  setting the plan can carry as a flag (`hide_pace: true`).
- Heart rate is useful here only as a **fatigue signal**: if easy effort lands 8–10% above the user's
  usual easy HR two days after a hard session, the recovery debt is real → the next hard day moves.
  That is a display-assisted judgement, not an autonomous plan surgery (device metrics are grade D).

## Common errors

- Running it at easy pace, which turns a 3-day-quality week into a 3-medium-day week. [PLAN-S1]
- Using it to "make up" a missed key session — the most common way a plan's structure dies.
- Adding it on top of a week that already exceeded its volume step (extra load, not recovery).
- Doing it on the only day the user had for a hard session, so the key session gets dropped and the
  recovery run becomes the day's only content.
- Treating a bad-feeling recovery run as a test result. It is a feel session by design; the plan reads
  it as a signal, not as data about fitness.
- Calling a 70-minute slow jog a recovery run: duration itself is a load.

## Contraindications / substitute

- Substitute a **rest day** whenever: sleep < 6 h, resting HR clearly elevated, any pain report, or the
  week already contains 2 hard days plus a long run and something else has to go.
- Substitute **cross-training** (bike/elliptical 20–30 min, Z1) when impact is the constraint — the
  structural benefit stays, the impact cost goes. Log it as cross-training.
- Substitute a **walk** for novice, postpartum (step 1–2), and post-layoff personas: the same
  time-on-feet logic with no impact risk.
- Never substitute a tempo or interval session for a recovery run. If the plan is tempted to do that, it
  has a scheduling problem, not a motivation problem.

## Progression ladder

1. 20 min easy after the week's hardest session, once per week.
2. 30 min, and a second recovery run the day after the long run (marathon personas only).
3. 35–45 min, keeping the effort ceiling the same — the only progression is duration.
4. Add 4 × 15–20 s strides at the end **only** in a sharpening phase, ≥ 4 days before a race.
   [see `workout-library/strides.md`]
5. In the taper, recovery runs keep their length and lose nothing — frequency is the last thing a taper
   touches. [PLAN-S5, `plan-construction/taper-and-peak.md`]
