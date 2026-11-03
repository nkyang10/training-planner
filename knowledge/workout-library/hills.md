---
id: workout-library/hills
title: "Hill repeats / hill work"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S7, PLAN-S8]
---

**Key takeaways**

1. Hills are the best risk-adjusted quality session for most personas: high intensity, short duration,
  and far less coordination and impact risk than flat speed work.
2. Gradient selects the stress: **6–8% for VO₂max-like work, 8–12% for strength-like work, > 12% for
  short maximal efforts** that need a walk-back. (Coaching practice, grade C.)
3. Dose: 6–10 × 45–90 s uphill, jog down, total hill work ≤ 8 min for most personas, ≤ 10–12 min at the
  peak. [PLAN-S8 grade C]
4. It counts as the week's hard day, not as "a bit of fun on a run day" — and it substitutes cleanly for
  one flat interval day per week.
5. Descents are part of the session and part of its cost: downhill eccentric load needs its own
  progression, especially for trail personas.

## Purpose

Power development, stride mechanics, glute and calf recruitment, economy at speed, and race-specific
preparation for anything with elevation. Because the effort is self-limiting (the hill decides), it is
the safest way for a novice or a returning runner to touch high intensity.

## Structure

```yaml
warm_up: "15 min easy + 4 × 20 s strides before the first climb — mandatory"
shapes:
  - {name: "short-steep",  body: "8 × 8–10 s maximal, walk back"}          # neuromuscular
  - {name: "classic",      body: "8 × 60 s @ ~3K effort on 6–8%, jog down"} # VO2-like
  - {name: "strength-long",body: "5–6 × 2 min @ tempo effort on 5–7%", walk the easy part}
  - {name: "mixed",        body: "4 × 45 s steep + 4 × 75 s moderate"}
  - {name: "in-run",       body: "6–8 × 45 s picked out of a 60-min easy run"}  # low-cost version
placement: "Tuesday or Thursday, ≥ 72 h from another Z3 day; never on tired legs before a long run"
caps: {total_uphill_min: 10, reps: 10, rep_s: 120}
```

## Dosing by goal

| Goal | Hill dose | Role in the week | Notes |
|---|---|---|---|
| First 5K | 4–6 × 20 s *uphill* strides in-run | not a hard day | self-limiting introduction |
| 5K / 10K | 8 × 60 s | the top-end day, alternating with threshold | race-specific for hilly courses |
| Half / marathon | 6–8 × 45–60 s | replaces one interval day in Build | keep to 1/wk |
| Finish-only | 4–6 × 30 s in-run | not a hard day | builds the legs for the last 10K |
| Trail/ultra | 6–8 × 75 s + controlled descents | 1–2/wk, year-round | the primary quality session |
| Masters 40+ | 6 × 45–60 s **or** 6 × 10 s steep | the top-end day | often better tolerated than track intervals |
| Time-poor 3-day | 6 × 45 s inside a 40-min slot | the top-end day | no long warm-up penalty if the hill is on the route |
| Post-layoff (late steps) | 4 × 20 s gentle uphill in-run | not a hard day | the first intensity exposure after strides |

## Intensity prescription

- Effort-based by design: "3K-to-5K effort" on a 60 s climb; on shorter, steeper hills the pace number is
  meaningless and should not be shown.
- The jog-down is the recovery; walking it is allowed and often correct (masters, trail, heavy runners).
- Form cues the app can state as coaching language, not diagnosis: "quiet feet, tall posture, drive the
  elbows, don't overstride". Cadence naturally rises 3–6 spm uphill — that is expected, not a fault.
- Downhill: run it under control with a slight forward lean and quick steps; the plan should treat the
  first downhill-heavy sessions of a block as a dose to progress, not free transportation home.

## Common errors

- Sprinting the descent and turning a 6-repetition session into an unmanaged eccentric load (next-day
  soreness guaranteed, quad tendons loaded).
- Hills on the easy day, so the week has three medium days and no easy day. [PLAN-S4 junk pattern]
- Climbing too steeply for the prescribed duration: an 8 × 60 s session on a 14% wall becomes
  8 maximal efforts with 4-minute recoveries.
- Skipping the warm-up because "it's just a hill".
- Adding hills *and* intervals in the same week every week — a third hard day for a 4-day runner.
  [PLAN-S7 rapid-rise pattern]
- Trail personas doing all hills at race effort and never practising the walk.

## Contraindications / substitute

- Avoid or substitute when: Achilles or calf pain (hills load both), plantar symptoms, any gait-changing
  pain, downhill-intolerant quads early in a block, or icy/wet surfaces.
- Substitutes: flat strides → 6 × 45 s on a gentle 4% ramp → treadmill at 6–8% incline (excellent,
  controllable, and no downhill cost) → cruise intervals.
- Treadmill version: 8 × 60 s @ 7%, 90 s at 1% for recovery; log it as a hill day so load accounting
  stays honest.

## Progression ladder

1. In-run: 4 × 20 s uphill inside an easy run, walk down.
2. Dedicated: 6 × 45 s on 6%, jog down, full warm-up.
3. 8 × 60 s on 6–8%.
4. 6 × 90 s on 5–7% (strength flavour) **or** 5 × 2 min tempo-effort climbs.
5. Mixed session: 4 × steep short + 5 × moderate, plus controlled descents.
6. Race-specific: repeat the actual gradient profile of the target race, in race kit, 4–6 weeks out.
   Then hold 2–4 weeks and let the taper remove the volume, not the hill. [PLAN-S5]
