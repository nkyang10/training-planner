---
id: workout-library/repeats-anaerobic
title: "Short repeats / anaerobic & speed work (R-pace)"
status: draft
confidence: low
evidence: [practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S8]
---

**Key takeaways**

1. The most injury-prone session in the library and the least necessary one for amateur distance goals:
  short, fast repetitions with long recovery (200–400 m, or 30–60 s, at ~mile/1500-m effort).
2. Its honest value is **neuromuscular**: turnover, economy, stride mechanics, and the ability to
  finish or respond to a move. It is not an aerobic session and is not "cardio".
3. Dose is tiny: 4–8 × 200–400 m, full recovery, **at most 2 exposures per macrocycle** for amateur
  marathoners, and it is always optional. [PLAN-S8 grade C, practitioner cap]
4. No verified physiological source for this session's dosing is in the knowledge base — treat every
  number here as grade C coaching practice, `confidence: low`.

## Purpose

Improve running economy and neuromuscular coordination, rehearse race-speed mechanics at low aerobic
cost, and build the "kick" response. For 5K–10K racers it supports the interval day; for faster track
goals it becomes a primary session and leaves the scope of this persona set.

## Structure

```yaml
shapes:
  - {name: "speed repeats", body: "6–10 × 200 m @ mile effort, 400 m jog (2:1–4:1 rest)"}
  - {name: "30/30s",        body: "10–16 × 30 s strong / 30 s jog"}   # scalable, track or road
  - {name: "hill sprints",  body: "6–8 × 8–10 s maximal uphill, walk back"}  # safest variant
  - {name: "R-pace",        body: "4–6 × 400 m @ R-pace, 200–400 m jog"}
placement: "midweek in Build, on a fresh-ish leg (≥ 48 h from any quality day)"
caps: {reps: 8, rep_m: 400, per_macrocycle: 2, min_surface: "track or flat, predictable surface"}
```

## Dosing by goal

| Goal | Dose | Frequency | Notes |
|---|---|---|---|
| First 5K | none | — | strides cover the need at far lower risk |
| 5K / 10K | 6 × 200 m or 10 × 30/30 s | once per 2–3 weeks in Build | never the same week as a hard interval day |
| Half marathon | 4–6 × 200 m strides-plus | optional, twice per block | economy only |
| Marathon | ≤ 2 exposures per macrocycle, or none | Build only | strides are the better investment |
| Finish-only | none | — | — |
| Trail/ultra | none on flat; 6 × 10 s uphill strides | optional | speed work on technical ground is an injury |
| Masters 40+ | hill sprints only, 6 × 8–10 s | once per 2–3 weeks | the highest value/lowest risk version |
| Time-poor 3-day | none | — | strides already fit the slot |

## Intensity prescription

- Effort, not pace, for anything under 400 m: "strong, controlled, smooth — 8/10 with the form held",
  not a maximal sprint to a line. Pace targets are unusable on a windy day or a crowded path.
- Recovery is long on purpose: 2:1–4:1 work:rest. If the user cannot hold the same effort in rep 6 as in
  rep 2, the rest is too short or the reps too fast; that turns it into an aerobic session in speed
  clothing.
- Surface matters: track, a quiet loop, or a hill. Never a pavement kerb-run with traffic, and never
  technical trail.
- Full warm-up (15–20 min plus drills) is mandatory: this is where hamstrings and calves get hurt.

## Common errors

- Doing repeats as a fitness test — all-out, watched, recorded — instead of as controlled repetitions.
- Short rests because "I don't want to lose the workout"; the workout *is* the quality of each rep.
- Adding them to a week that already has two hard days, producing a third hard day with a sprint
  mechanic on tired legs.
- Choosing them over strides when time is short: 6 × 200 m costs a full warm-up and 2 days of recovery;
  6 × 20 s strides cost 15 minutes.
- Sprinting on a niggle that only appears at speed (the classic first signal of a calf or hamstring that
  will not tolerate the block).
- Judging the session by lap times on a GPS with 0.3 s sampling and concluding the reps were "sloppy".

## Contraindications / substitute

- Contraindicated for: novices, post-layoff, postpartum, masters users with any hamstring history,
  anyone with gait-changing pain, and on wet/icy/technical surfaces. Also avoid in the last 4 weeks
  before a goal race for amateur personas: the risk/benefit turns negative.
- Substitutes, descending: hill sprints (8–10 s, walk-back) → shorter strides (6 × 20 s) → 4 × 100 m
  "smooth, not fast" → nothing at all, which is a legitimate output.
- If the user reports a "grab" in a hamstring or calf, stop the session on the spot and hold speed work
  for 10–14 days; refer if it repeats. This is not a diagnosis and not a knob.

## Progression ladder

1. Strides 4–6 × 20 s on grass (already covered in `workout-library/strides.md`) — the true entry point.
2. 4 × 30 s "strong, not maximal" with 90 s walk/jog.
3. 6 × 200 m @ mile effort, 400 m jog.
4. 8 × 200 m, or 4 × 400 m with 400 m jog.
5. Broken speed: 2 × (4 × 200 m / 200 m jog), 400 m jog between sets — the ceiling for amateur personas.
6. Then stop: repeat count does not grow further. Any further progression is a track-programme decision,
  outside this product's persona set.
