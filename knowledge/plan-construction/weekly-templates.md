---
id: plan-construction/weekly-templates
title: "Weekly templates: slot-level shapes the generator instantiates"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [plan-generator, workout-picker]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S4, PLAN-S8, PLAN-S9, PLAN-S10, PLAN-S11]
---

**Key takeaways**

1. Templates are **slot skeletons**, not sessions. The generator picks a template by days available,
  then fills types from `workout-library/` and doses from the phase.
2. Hard-day spacing is the invariant: **≥48 h between hard days** by default, one easy day after every
  hard day. Everything else in the week is negotiable.
3. The long run goes where the **time** and the **recovery** are, and the race-day rule overrides
  aesthetics: weekend race ⇒ long run 2–3 weeks before, on the same weekday and time of day.
4. A 3-day week cannot be a shrunken 5-day week. Its hard session carries the plan.
5. Back-to-back weekend runs are a marathon-specific tool with a real cost: they belong in Specific
  phase, at ≤5 days from the previous hard day, never in a novice's plan.

## Facts

- Distribution is preserved across the week, not per session: an 80/20-ish week in runners means one
  or two hard days out of 4–6, which is arithmetically impossible with three sessions unless the
  fraction is allowed to rise. [PLAN-S2, PLAN-S4]
- Published book plans converge on **2–3 quality sessions** per week in the build/specific phases and
  long runs on the weekend. [PLAN-S8, PLAN-S9 grade C/D]
- → rule: heuristics/weekly-templates.yaml#hard_days_per_week (range 1–3)
- → rule: heuristics/weekly-templates.yaml#min_gap_hard_days_h (range 24–72, default 48)
- → rule: heuristics/weekly-templates.yaml#easy_day_after_hard (bool, default true)

## Practice

### 3 running days — the minimum viable plan

```yaml
template: 3-day-minimum
hard_days: 1
shape:
  - {day: tue, session: easy, minutes: 40, intensity: Z1, purpose: volume, notes: strides optional}
  - {day: thu, session: KEY, minutes: 55, intensity: Z3|Z2, purpose: the week's adaptation,
     notes: "rotates VO2 ↔ threshold weekly; never both in the same 3-day week"}
  - {day: sat, session: long-run, minutes: 90, intensity: Z1 (Z2 segments only in Specific),
     purpose: endurance, notes: "this is the second-hardest session; place on the longest slot"}
constraints:
  - "no second hard day unless a persona explicitly allows it (time-poor-3-days)"
  - "if a slot < 35 min, the key session shrinks; the long run does not"
  - "hard day must have ≥48 h before and after the long run when the long run has MP work"
```

### 4 running days — the default recreational week

```yaml
template: 4-day-standard
hard_days: 2
shape:
  - {day: tue, session: vo2max-intervals|tempo-cruise-intervals, minutes: 55, intensity: Z3/Z2, purpose: top-end}
  - {day: wed, session: recovery-run, minutes: 30, intensity: Z1, purpose: flush, notes: optional, drop first}
  - {day: thu, session: easy, minutes: 45, intensity: Z1, purpose: volume, notes: "6 strides in phase Base"}
  - {day: sat, session: long-run|progression-long-run, minutes: 100, intensity: Z1→Z2, purpose: endurance}
  - {day: sun, session: easy, minutes: 40, intensity: Z1, purpose: volume, notes: "only if 4th day is Sunday"}
constraints:
  - "if the 4th day is not adjacent to the long run, make it easy, never key"
  - "key day and long run separated by ≥1 easy day outside the Specific phase"
```

### 5 running days — three-key week becomes possible

```yaml
template: 5-day-three-key
hard_days: 2   # 3 only in Specific, and then the 5th day is deleted, not added
shape:
  - {day: mon, session: rest}
  - {day: tue, session: KEY-1, minutes: 60, intensity: Z3, purpose: "VO2 or repeats, alternating weeks"}
  - {day: wed, session: easy, minutes: 45, intensity: Z1}
  - {day: thu, session: KEY-2, minutes: 55, intensity: Z2, purpose: "threshold / cruise intervals"}
  - {day: fri, session: rest|recovery-run 25, intensity: Z1}
  - {day: sat, session: KEY-3 long-run with race-pace block (Specific) | long easy (Base), minutes: 110}
  - {day: sun, session: easy, minutes: 40, intensity: Z1, notes: "sharpened by strides in Base only"}
```

### 6 running days — marathon-shaped

```yaml
template: 6-day-marathon
hard_days: 3
shape:
  - {day: mon, session: rest}
  - {day: tue, session: KEY-1, minutes: 65, intensity: Z3, purpose: "intervals (Build) / MP cruise (Specific)"}
  - {day: wed, session: easy, minutes: 55, intensity: Z1}
  - {day: thu, session: KEY-2, minutes: 60, intensity: Z2, purpose: "threshold or hills"}
  - {day: fri, session: easy, minutes: 50, intensity: Z1, notes: strides}
  - {day: sat, session: KEY-3 progression-long-run, minutes: 120, intensity: Z1→MP, purpose: "marathon-specific"}
  - {day: sun, session: recovery-run, minutes: 40, intensity: Z1, notes: "back-to-back partner of the long run"}
```

### 7 running days — treat day 7 as a decision, not a default

```yaml
template: 7-day
hard_days: 3
delta_from_6_day: {add: {session: recovery-run, minutes: 30, intensity: Z1, placement: "the day after KEY-1"}}
constraints: ["never on the day after the long run", "requires ≥12 months of 6-day history",
              "the engine must ask why before offering this template"]
```

### Hard-day spacing rules (all templates)

- 1 hard day: place it mid-week (Tue/Wed) so the weekend long run stays a quality run.
- 2 hard days: Tue + Thu/Sat. Thu–Sat compresses recovery into one day; use Tue–Fri if long run is Sat.
- 3 hard days: Tue, Thu, Sat (long run = the third). Never three consecutive days, and never a third
  hard day added in the same review that adds volume.
- Race day counts as a hard day **and** as the long run in its week.

### Long-run placement

- Weekend race ⇒ long run on the race weekday (usually Sunday) at the race start time in the 3
  weeks before the race: `2027-01-31`, `2027-02-07`, `2027-02-14` for a `2027-02-28` race.
- Cannot train on the weekend at all ⇒ move the long run to a weekday and cap it at the slot; the
  plan notes must state that race-day rehearsal is therefore impossible.
- Long run is never the day after a VO₂max session in Base; in Specific it may follow a short MP
  session (see back-to-backs).

### Marathon back-to-backs (Specific phase only)

```yaml
back_to_back:
  saturday: {session: marathon-pace-run, structure: "20–26 km: 12–16 km @ MP", minutes: 120}
  sunday:   {session: easy-run, minutes: 40–60, intensity: Z1, notes: "on tired legs; purpose is fuel use and durability, not speed"}
rules:
  - "≤ 2 back-to-back weekends per block, ≥ 10 days apart"
  - "combined weekend volume ≤ 45% of weekly volume"
  - "forbidden: novices, injury history in the last 12 months, postpartum-return, returning-after-layoff"
  - "if Sunday is an OFF day, do not split across Friday/Saturday — delete the second run instead"
```
[grade C practice; PLAN-S11 style progression long runs, PLAN-S10 hard-easy pairs]

### Three-key-workout week (definition and cost)

Three key workouts = three sessions with a prescribed intensity block, e.g. Tue intervals / Thu
threshold / Sat long-with-MP. Cost: ≥5 running days, ≥60 km/wk, and a recovery capacity that the
engine verifies from feedback history (no "heavy legs" reports > 24 h in the last 3 weeks) before it
offers the week. Two keys done well beat three done at 80%.

## Controversies

- **Fixed weekday templates vs floating slots.** Fixed weekdays are explainable and match social
  life; floating slots maximise spacing. Default = fixed with slot-fit trimming; a "smart placement"
  experiment is allowed later. status: contested
- **Is the third key session worth it for sub-elite amateurs?** Book plans vary between 2 and 3;
  the polarized evidence emphasises that *where* the intensity sits matters more than its quantity.
  Engine offers 3 keys only above a volume/persona threshold. [PLAN-S2, PLAN-S8] status: contested
- **Strides on easy days**: some schools put them at the end of easy runs, others only after a rest
  day. Effect on the distribution is negligible; adherence is the deciding factor.

## Individual differences

- Shift workers and parents with unpredictable evenings: templates keyed to *slot length* (longest
  slot = long run) rather than weekday names; the plan then survives a swapped week.
- Users who reliably miss one weekday: move the key session off that weekday permanently after two
  occurrences; two misses is a scheduling fact, not a motivation problem.
