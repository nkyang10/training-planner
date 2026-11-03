---
id: workout-library/fartlek
title: "Fartlek (unstructured / speed-play)"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S4, PLAN-S8]
---

**Key takeaways**

1. Fartlek is a **structure-free intensity session**: effort changes across the run, chosen by terrain,
  feel, or a simple rule. It is the best session when the slot is unstructured or the mood will not
  tolerate a track.
2. Its main risk is the opposite of its main virtue: without a rule, fartlek drifts into a medium run —
  the exact junk pattern the distribution evidence warns about. [PLAN-S4]
3. Two families to keep separate in the picker: **long fartlek** (many 1–3 min surges, moderate-hard,
  threshold-flavoured) and **short fartlek** (10–20 × 20–45 s, top-end-flavoured).
4. It is a legitimate substitute for either quality day, and the recommended first "hard" session for
  novice-adjacent runners who find intervals intimidating.

## Purpose

Aerobic and neuromuscular variety without stopwatch pressure; teaches pacing by feel, keeps a hard day
enjoyable, and survives bad weather, children, travel, and unknown routes. Also useful as a
"re-entry" session after a disrupted block because it self-regulates.

## Structure

```yaml
long_fartlek:  "40–60 min: every 4–6 min, 90 s–3 min at threshold effort, easy between"
short_fartlek: "35–45 min: 12–20 × 20–40 s strong, jog between, chosen by landmarks"
rule_based:    "surges on every lamp-post pair / every second horizon / every uphill"
time_based:    "30-30s: 30 s on / 30 s off × 16, continuous, no stopping"
placement:     "replaces a threshold day (long) or a top-end day (short), never both in one week"
logging:       "record as one session with an effort average; do not fake exact split data"
```

## Dosing by goal

| Goal | Form | Weekly role | Notes |
|---|---|---|---|
| First 5K | 20-min run with 6 × 20 s "play" surges | not a hard day | play, not prescription |
| 5K / 10K | short fartlek 12–16 × 30 s | top-end day, 1/wk | good indoor/travel substitute |
| Half / marathon | long fartlek 6–8 × 2 min "marathon-to-threshold" | threshold day in Build | lower mental cost than tempo |
| Finish-only | long fartlek by feel, 5–6 surges | optional hard day | effort language only |
| Trail/ultra | **the default hard day** — surges on terrain | 1/wk | matches race demands exactly |
| Masters 40+ | short fartlek 8–12 × 20–30 s | top-end day | self-limiting, short efforts |
| Time-poor 3-day | 30-30s × 16 inside 40 min | top-end day | no warm-up-and-reps arithmetic |
| Post-layoff (late steps) | 8 × 20 s in-run play | not a hard day | the bridge back to intensity |

## Intensity prescription

- Because there are no measured repetitions, the plan prescribes **rules and effort bands**, never paces:
  "surges at a strong-but-controlled 7/10, easy between means actually easy".
- The 28-day distribution still governs: a fartlek counts in the zone its effort actually lands in.
  A "long fartlek" run hot is a threshold session; a "short fartlek" run hot is an interval session with
  junk rests. [PLAN-S1, PLAN-S4]
- Landmark rules beat time rules when there is no watch-friendly route, and are more robust on trails.
- Effort calibration check: after the first surge the user should feel able to repeat it 6 more times at
  the same effort. If not, the surge was too hard.

## Common errors

- The whole run becoming medium: no easy segments, no real surges — the session with the worst
  cost/benefit ratio in the library. [PLAN-S4 grade B]
- Two fartlek days a week because "they don't feel like workouts", quietly tripling moderate-zone time.
- Choosing surges that end at the top of a hill where the effort spikes unsafely on a cold day.
- Doing fartlek the day before a key session and reporting "heavy legs" without connecting them.
- Logging it as an easy run, which makes the engine's intensity-distribution accounting silently wrong —
  and the honesty rule matters more than the tidiness of the data.
- Using fartlek as an excuse to test fitness every week (each surge a mini time trial).

## Contraindications / substitute

- Contraindicated where the surface or traffic makes surging unsafe (shared paths with unpredictable
  obstacles, ice, night without lighting) — substitute a treadmill or a structured session.
- Substitutes: structured cruise intervals (same stress, more controllable) → hills → strides + easy run
  → plain easy run.
- For personas where a medium day is the risk (competitive amateurs with junk mileage), prefer the
  structured version over the free version, and say why.

## Progression ladder

1. Free play: 6 × 20 s surges inside an easy run, landmarks chosen by the user.
2. Short fartlek: 10–12 × 30 s strong / 60–90 s jog, 1 × /wk.
3. 16 × 30-30s continuous — the classic self-dosing session.
4. Long fartlek: 6–8 × 2 min at threshold effort in a 50-min run.
5. Terrain-matched (trail personas): surges chosen by the profile, 8–10 exposures, hike/walk recovery on
   climbs.
6. Race-specific: surges at race effort at the exact points where the target race demands them (a bridge,
   a climb, a kick), 3–5 weeks out.
