---
id: plan-construction/mileage-and-progression
title: "Weekly volume and progression: growth rate, step cycles, ceilings"
status: contested
confidence: medium
evidence: [review, practitioner]
applies_to: [plan-generator, review-engine, safety-layer]
last_reviewed: 2026-11-04
owner: unowned
supersedes: []
sources: [PLAN-S7, PLAN-S11, PLAN-S12]
---

**Key takeaways**

1. The "10% per week" rule is a coaching heuristic, **not** a validated threshold. It survives because
   it is easy to remember, and it fails at both ends of the volume range and after every layoff.
2. The injury literature supports the *direction* (rapid load rise is the most-studied modifiable
   risk) and not a number. Effect estimates are inconsistent across studies. [PLAN-S7]
3. Cap growth with **three** limits at once: percentage, absolute km, and hard-session count. The
   binding one is usually the absolute one for beginners and the session-count one for improvers.
4. Volume grows in **step cycles** (3:1 default, 2:1 for masters and returning runners). A down week is
   part of the progression, not a pause in it.
5. Adding a **day** is a bigger load step than adding 5 km. Never add more than one running day at a
   time, and the new day is always easy.

## Facts

- Systematic review of "training errors" and running-related injury: load-related variables (weekly
  volume, rapid increases, long-run distance) are the most-studied exposure; associations were
  **inconsistent** between studies and no predictive threshold was established. [PLAN-S7 grade A
  review; confidence medium]
- No randomised trial has tested a maximum safe weekly increment. Every number below is therefore
  either coaching consensus (grade C) or an explicitly labelled engineering default. [PLAN-S7 gap]
- Reality check on volume expectations by event: in a study of well-trained endurance athletes, weekly
  training time was 5.2 ± 0.9 h for marathon runners versus 12.9 ± 2.6 h for Ironman triathletes.
  A marathon-shaped volume logic imported into an ultra plan is off by roughly a factor of two in
  hours. [PLAN-S12 grade B cohort]
- → rule: heuristics/load-progression.yaml#weekly_increment_pct (range 0–15, default 8–10)
- → rule: heuristics/load-progression.yaml#weekly_increment_km_abs (range 0–8)
- → rule: heuristics/load-progression.yaml#step_cycle (values 2:1 | 3:1 | 4:1)
- → rule: heuristics/load-progression.yaml#down_week_pct (range 55–80, default 65)

## Practice

### Growth rule the engine uses

For week *n+1* from week *n* (both in "load-equivalent km", see below):

```
Δkm ≤ max(1.5 km, min(weekly_increment_pct × km_n, weekly_increment_km_abs))
hard_sessions_{n+1} ≤ hard_sessions_n + (1 if no new day added else 0)
running_days_{n+1} ≤ running_days_n + 1, and ≥ 2 weeks since the last day added
```

- The floor (1.5 km) exists because 10% of 24 km is 2.4 km and rounding to "no change" stalls a
  beginner; the ceiling (absolute km) exists because 10% of 140 km is 14 km.
- **Load-equivalent km** = easy km × 1.0 + threshold/MP km × 1.3 + interval/repeat km × 1.6 (weights
  are engineering defaults, not measured; they exist so that swapping 10 easy km for 10×400 m does not
  look like zero change). status: contested — replace when a validated load metric exists.

**Review candidates are judged against the base plan, not against their own ratio.** When
`checkInvariants` is given the plan a candidate was derived from (`baseVersion`), the increment
ceiling asks *"does this plan add load relative to the plan the runner was already on?"*. Without
that, a reduction of week *n* lowers the base of week *n+1*, and week *n+1* then looks like a jump
although its absolute load never changed. The review engine would refuse the reduction it exists to
offer — the engine would be blocked by an artefact of its own arithmetic. A plan built from scratch
has no base and is checked against itself, as before.

### Step cycles

| Cycle | Shape | Who | Down-week volume |
|---|---|---|---|
| 2:1 | 2 build, 1 down | novices, masters, returning-after-layoff, injury history | 60–70% of block peak |
| 3:1 | 3 build, 1 down | default for everyone else | 60–75% |
| 4:1 | 4 build, 1 down | high training age, stable 3+ years, opt-in only | 65–75% |

[Hansons deliberately omits down-weeks — see `periodization/models-comparison.md` Controversies;
grade C textbooks disagree with each other. PLAN-S10, PLAN-S11]

### Long-run growth

- +10 min **or** +2–4 km per week, whichever is smaller; every 3rd week flat or −20%.
- Ceiling by goal: 5K/10K 90 min; half 110–130 min; marathon 100–150 min (most recreational runners
  gain nothing beyond ~2.5 h beyond the musculoskeletal cost). Ultra: time-on-feet specific, see
  `personas/trail-ultra.md`. [grade C]
- Long run ≤ **30–35% of weekly volume** — the single most useful ceiling for the generator, because
  a 32 km long run in a 45 km week is structurally unsound regardless of fitness.
  → rule: heuristics/load-progression.yaml#long_run_share_pct (range 20–40)

### "Maximum adaptive window" (coaching concept, grade C)

Define it operationally rather than mystically: the stretch of **8–12 weeks** in which the plan is
simultaneously (a) at or near peak volume, (b) race-specific in paces, and (c) not yet eroded by
accumulated fatigue. Practical consequences:

- Peak weeks last 3–6 weeks, never the whole block; the rest of the block ramps to and from them.
- A plan that is "hardest" in its final week before the taper is a planning bug, not a peak.
- The best weeks are 2–4 weeks pre-race, and they should be reproducible in hindsight from the
  calendar: if the user cannot point at them, the shape was wrong.

### Weekly volume reference ceilings by running days

Engineering defaults for a **recreational** runner with ≤ 2 h/day available. Not a physiological
limit; a guardrail against the generator writing plans nobody can finish. Confidence low by design.

| Running days | Typical sustainable range | Generator ceiling before it must warn |
|---|---|---|
| 3 | 20–40 km | > 45 km |
| 4 | 30–60 km | > 70 km |
| 5 | 45–85 km | > 100 km |
| 6 | 65–120 km | > 140 km |
| 7 | 85–160 km | > 180 km |

Cross-check in hours: a recreational marathoner in the literature trained ~5.2 h/wk [PLAN-S12]; a plan
demanding > 9 h/wk for that profile is outside any evidence the knowledge base has.

### Adding days (0 → 5, and every step)

- One new day per 2–4 weeks. The new day is **easy, ≤ 30 min, Z1 only**, for its first 4 exposures.
- Order of insertion: add the day that fits the user's slot reliability first, not the day that makes
  the prettiest hard-day spacing; a skipped Tuesday teaches the engine nothing.
- After a layoff of < 3 weeks: return to ~80% of the last good week, then progress normally.
  3–8 weeks: ~50–60%, 2:1 cycle. 3–6 months: ~30–40% with 2 weeks of Z1 only, then 2:1.
  > 6 months or injury-with-rest: treat as a new runner — walk/run allowed — and see
  `personas/returning-after-layoff-or-injury.md`. [grade C practitioner; no trial evidence]
- Rebuild speed asymmetry: fitness returns faster than tissue tolerance. The engine caps by *tissue*
  (recent volume history), never by *feel*. This is the single most common cause of a layoff relapse.

## Controversies

- **"10% rule" as a hard rule.** Widely taught; untested; inconsistent with the injury literature's
  inability to find a threshold. Engine keeps it as a *cap*, not as a target, and allows weeks with
  0% growth. status: contested
- **Volume vs intensity priority for time goals.** Some coaches grow volume first, others add intensity
  at fixed volume. Both work; the constraint is total load. The engine grows volume until the persona's
  ceiling, then grows session quality. status: contested
- **Is more frequency always riskier?** Frequency raises load episodes and convenience of "junk" runs,
  but easy days also aid recovery from the hard ones. No runner-specific trial; hence the rule "add a
  day, hold volume constant for one week" rather than "add a day and its km". status: contested

## Individual differences

- Body mass, tendon history, and running economy change the safe ceiling substantially; two users with
  identical 10K times can have a 2× difference in sustainable volume. Never transfer one user's peak
  week to another's plan.
- Masters, postpartum-returning and returning-after-injury users get the **2:1 cycle and the lower end
  of every ceiling**, and their growth is capped by time-on-feet rather than km.
- High-frequency, low-volume profiles (50–60 min daily, no long run) are a legitimate variant for
  3-day-limited users; do not force them into a 5-day shape.

## Escalate to a clinician

Rising pain in the same location across two consecutive weeks, or pain that changes gait, stops
progression — that is a clinical question, not a knob. `risk-and-safety/red-flags-for-escalation.md`.
