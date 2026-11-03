---
id: workout-library/strength-for-runners
title: "Strength training for runners"
status: draft
confidence: low
evidence: [practitioner]
applies_to: [workout-picker, plan-generator]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: []
---

**Evidence note:** no concurrent-training or strength study was verified in this pass (candidates in
`plan-construction/measurement-and-testing.md`'s gap list: concurrent-training meta-analyses, e.g.
Sabag 2018; Wilson 2012 — **not** re-read, so nothing here is quoted as evidence). Everything below is
**grade C coaching practice, `confidence: low`**, plus product policy. Where the user's clinician or
physiotherapist has given a program, that program wins and this file only schedules it.

**Key takeaways**

1. Two sessions per week, 20–40 minutes each, is the whole prescription for amateur runners. Frequency
  beats volume; consistency beats cleverness.
2. The purpose is **tissue tolerance and force production**, not "runner's legs": a few heavy-ish lifts
  or loaded carries, some single-leg work, and calf/foot capacity.
3. Strength never replaces a run and never gets scheduled on the same day as a top-end session for
  personas that need the recovery. It gets its own slot or follows an easy run.
4. This file **does not** prescribe load for a specific person, treat an injury, or address weight or
  body composition — the app never does any of those. [AGENTS rule 6]

## Purpose

Raise the force a runner can produce and the load tendons and bone can tolerate, which shows up as
better economy and fewer days lost. For masters and returning personas the tolerance argument matters
more than the performance argument.

## Structure

```yaml
frequency: 2 × /wk (1 × /wk is the floor; 3 × /wk needs a real reason)
session: "6–10 min prep + 3–4 main movements + 2–3 accessory/foot-calf blocks"
main_movement_menu:   # the plan schedules "the slot", the user fills it with what they can do safely
  - {pattern: "knee-dominant",  example: "goblet squat / split squat",        sets_reps: "3 × 5–8"}
  - {pattern: "hip-dominant",   example: "hip thrust / deadlift variation",   sets_reps: "3 × 5–8"}
  - {pattern: "single-leg",     example: "step-down / reverse lunge",         sets_reps: "2–3 × 8–10"}
  - {pattern: "calf/foot",      example: "isometric hold → slow heel-raise",  sets_reps: "3 × 8–12"}
  - {pattern: "trunk/anti-motion", example: "side plank / carry",             sets_reps: "2–3 × 20–40 s"}
progression: "add reps → then sets → then load, one variable per week, in that order"
equipment_agnostic: "bodyweight → bands → dumbbells → barbell; the pattern matters more than the tool"
```

## Dosing by goal

| Persona | Frequency | Placement | Notes |
|---|---|---|---|
| First 5K | 1–2 × 20 min | on non-running days | bodyweight and calf/foot only; it is a habit-building phase |
| 5K / 10K | 2 × 25–35 min | after easy runs or on off days | heavy-ish work 4–6 reps is fine if form is sound |
| Half / marathon | 2 × 25–35 min | never the day before the long run | reduce to 1 × /wk maintenance in the last 3 weeks |
| Finish-only | 1–2 × 20 min | wherever it actually happens | adherence is the only metric that matters |
| Trail/ultra | 2 × 30 min | year-round, plus step-down/landing work before a descent-heavy block | descents need eccentric tolerance |
| Masters 40+ | 2 × 30 min | separated from hard running days by ≥ 24 h | closest to mandatory for this persona |
| Time-poor 3-day | 2 × 20 min | **scheduled as sessions in the calendar** | unscheduled strength does not happen |
| Post-layoff | per clinician/physio | app schedules only | the returned program wins over this menu |
| Postpartum (all steps) | per physio | app schedules only | no prescription from this file |

## Intensity prescription

- Effort target: "2–3 reps left in the tank" for main movements in the general runner; a controlled
  7–8/10 difficulty. This is a coaching cue, not a prescription of load for a named person.
- Tempo: slow and controlled; no max-effort attempts, no AMRAPs to failure, no timed WOD-style
  finishers stacked onto a running week.
- Calf and foot work is the highest-value, least-doable block: isometric holds first, then slow
  heavy-ish heel raises; the Achilles needs the load, and removing it is how a runner loses the block.
- Soreness rule the plan can state: strength soreness that alters running form for > 24 h means the dose
  was too big; halve the sets, keep the frequency.

## Common errors

- Doing strength the day before the long run, then reporting "heavy legs" as a mystery — the review
  should read the strength log, not just the run log.
- Replacing a run with strength for a novice whose missing ingredient is running frequency, or replacing
  strength with easy runs for a time-poor persona whose missing ingredient is tolerance.
- High-fatigue conditioning classes (metcon, box-cross-style circuits) counted as "strength" — they are
  a hidden third hard day for a 3–4-day runner.
- Progressing load every week for both a new lift and new running volume. Two variables, one body.
  [PLAN-S7 pattern, extrapolated]
- Skipping calf/foot and single-leg work because the "real" lifts were done.
- Chasing a body-composition outcome with training: outside product scope entirely and never a stated
  goal in this app.

## Contraindications / substitute

- Do not prescribe from this file at all when: the user is postpartum or post-surgical, has a clinician-
  or physiotherapist-authored program, is managing a health condition or medication that changes exercise
  response (blood pressure, cardiac, insulin, pregnancy), or reports pain that changes movement. In all
  of these: schedule what their clinician gave them, and refer rather than substitute. [AGENTS rule 6]
- Substitute ladder when the gym is unavailable: banded work → bodyweight with slower tempo → loaded
  carries (groceries count) → stair work for the knee-dominant pattern → nothing (and say so honestly).
- Never substitute a "core workout" for a missed calf/foot block; they are different tissues.

## Progression ladder

1. **Weeks 1–3:** movement quality and habit — 1–2 × /wk, 2 sets, easy effort, all five patterns touched.
2. **Weeks 4–8:** 3 sets on the two main patterns; add load when the top reps feel controlled.
3. **Weeks 9–16:** heavier main work (5–8 reps), accessories stay moderate; single-leg work introduced.
4. **Race block (last 3 weeks):** 1 × /wk maintenance, 2 sets, same effort, no new movements, no new
   load. This mirrors the taper rule: frequency last, volume first. [PLAN-S5 analogy — a coaching
   transfer, not a measured finding]
5. **Post-race (weeks 1–2 back):** return to step 2 loads, not to the previous peak.

## Gaps to verify

- Concurrent strength-and-endurance training: effect on running performance and economy in recreational
  runners (candidates: Sabag et al. 2018 sports-medicine meta-analysis; Wilson et al. 2012 concurrent
  training meta-analysis) — both **unverified in this pass**; the physiology & metrics scope has a
  candidate registered as [PHYS-S42], also flagged unverified there. Until verified, the strength
  section of the plan is justified by practice and by tissue-tolerance reasoning, not by cited evidence.
- Tendinopathy-loading protocols and return-to-run progression: **out of scope** for the app; a
  clinician/physiotherapist question, not a plan knob.
