---
id: workout-library/easy-run
title: "Easy run"
status: draft
confidence: high
evidence: [review, meta-analysis, practitioner]
applies_to: [workout-picker, plan-generator, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S1, PLAN-S2, PLAN-S4, PLAN-S8]
---

**Key takeaways**

1. The easy run is where the aerobic adaptation happens and where the hard days stay possible. It is
  60–85% of the plan's sessions and most of its minutes. [PLAN-S1, PLAN-S2]
2. Its defining property is **effort, not pace**: conversational, nasal-breathing-able, and by
  perception "could keep going for another hour".
3. The single most common generator bug in this product's domain: an easy run prescribed within ~10
  s/km of half-marathon race pace. That is a junk session by construction. [PLAN-S4]
4. Easy runs are the **only** sessions a review may freely delete, shorten, or move; they are never
  silently converted into quality sessions.

## Purpose

Aerobic base: mitochondrial and capillary density, stroke volume, fat oxidation, running economy, and
tissue tolerance — the adaptation that everything else is rented against. Also active recovery between
quality days, and the session that makes weekly volume survivable.

## Structure

```yaml
duration: 25–75 min (persona-dependent; marathoners up to 90)
terrain: flat-to-rolling, low-traffic, repeatable surface
warm_up: "the first 10 min ARE the warm-up — start slower than feels correct"
cool_down: "walk 2–3 min at the end; not optional after a hard day"
strides: "optional 4 × 20 s at the end (this does not make it a quality session)"
hr_zone: Z1 by measurement, not by device default
pace: "easy band = +35 to +70 s/km from half-marathon pace, wide and personal"
```

## Dosing by goal

| Context | Dose | Notes |
|---|---|---|
| Novice / first 5K | 20–35 min, run/walk allowed | minutes are the unit; see `personas/novice-first-5k.md` |
| 5K–10K goal | 35–50 min, 2–3/wk | easy days carry the aerobic share |
| Half / marathon goal | 45–70 min, 3–4/wk | one is a post-long-run recovery run at 40–60 min |
| Finish-only mode | 30–60 min by time, no pace target | effort anchors only |
| Masters 40+ | 40–60 min, ≥ 1 the day after every hard day | recovery spacing is the point |
| Trail/ultra | 45–75 min off-road | Z1 by effort; hike steep grades |
| Returning post-layoff | 20–35 min Z1, walk breaks programmed | see `personas/returning-after-layoff-or-injury.md` |

## Intensity prescription

- Primary anchor: **talk test** — full sentences comfortably. Secondary: RPE 3–4/10.
- If a device HR channel exists, use a **measured** Z1 ceiling (from a lab or field test), not
  220 − age. Devices' auto-zones are display-only.
- Effort, not number, is the truth in heat, altitude, hills, and after illness: a 6:40/km easy run in
  30 °C is an easy run.
- Rule to enforce in the generator: `easy_pace_floor` = half-marathon pace + 35 s/km at minimum, widen
  for heavier or novice runners. → rule: heuristics/pace-model.yaml#easy_band
  [PLAN-S4: the moderate zone is the one that must stay small — 11.8% vs 24.7% separated the arms]

## Common errors

- Running it at "marathon pace minus a bit" — the medium-day epidemic; produces 4 medium days, 0 real
  quality days, and a plateau.
- Judging the session by pace instead of effort and "improving" the easy run.
- Adding a GPS leaderboard to an easy day.
- Skipping the first 10 minutes of gentleness, which turns the whole session medium.
- Deleting easy days first when time is short — the correct order is quality → long run → easy, but for
  *busy* weeks the easy day is legitimately the one to cut; what must never happen is converting it
  into a hard day to "make the week count".
- Treating a walk break as a failure; programmed walk breaks are structure.

## Contraindications / substitute

- Essentially none at Z1 effort. Substitute when impact is the limit: bike, elliptical, aqua-jog, or a
  brisk walk-run, logged as cross-training so the engine's impact accounting stays honest
  (`workout-library/cross-training.md`).
- If the user cannot keep the effort down — legs won't settle, HR unusually high for the pace — treat
  that as a recovery signal: this session becomes a walk, and the next hard day moves. That is a
  subtraction, and it is the correct one.
- Illness with fever or resting HR +10% for 3 days: no running until it resolves (see
  `plan-construction/measurement-and-testing.md` re-baselining triggers).

## Progression ladder

1. **Duration first**: 20 → 30 → 40 → 50 → 60 min, +5–10 min per week on one session only.
2. **Frequency second**: add a day only after 4 clean weeks, +1 day maximum, ≥ 2 weeks before the next.
3. **Terrain third**: introduce rolling ground, then a technical surface for trail personas.
4. **Strides last**: 4 × 20 s at the end of one easy run per week — the cheapest neuromuscular stimulus
   in the library and the one to preserve when everything else is cut.
5. **Never** progress an easy run by making it faster. The ladder is time → frequency → terrain →
   strides.
