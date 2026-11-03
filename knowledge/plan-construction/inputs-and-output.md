---
id: plan-construction/inputs-and-output
title: "The plan contract: inputs the planner reads, outputs it must emit"
status: draft
confidence: high
evidence: [review, meta-analysis, practitioner]
applies_to: [planner-core, onboarding, api, review-engine, eval]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S4, PLAN-S5, PLAN-S8]
---

**Key takeaways**

1. The planner is a pure function: `plan = f(inputs, knowledgeBundle, clock, seed)`. Everything below
   is an *input field* or an *output field*; anything the planner invents silently is a bug.
2. Three inputs are load-bearing and must be **required**: (a) a fitness evidence item ≤ 8 weeks old,
   (b) weekly availability as days + minutes + named OFF days, (c) the race calendar with one A
   priority. Without them the planner produces a template, not a plan, and must say so.
3. Every output session carries **purpose + structure + intensity target + fallback branch**. A
   session a user cannot explain is a session they will skip and misreport.
4. Outputs are dated with absolute ISO dates and are re-derivable: running the planner tomorrow with
   the same inputs and an unchanged history must produce the same past sessions.
5. The plan states its own assumptions ("paces from a 5K done 6 weeks ago; 10K evidence missing") so a
   later review can attack an assumption instead of guessing.

## Facts

- Paces derived from a race prediction carry the error of their input; a 5K-based prediction applied
  to a marathon extrapolates further than the evidence supports. Where the model was not validated,
  the engine must widen prescribed ranges rather than pretend precision. [PLAN-S4 note: even a
  12-runner trial reported improvement as a range ± SD, not a point value]
- Prescribed intensity only means something relative to a stated anchor. Report each session's target
  as a **range plus a feel cue plus the anchor date**, never a single number. [grade C]
- → rule: heuristics/pace-model.yaml#pace_band_s (range 3–20 s/km half-band)
- → rule: heuristics/pace-model.yaml#evidence_max_age_days (range 21–120, default 56)

## Practice

### Input contract

| Field | Type | Required | Notes for the planner |
|---|---|---|---|
| `racing_evidence[]` | `{type, distance_m, duration_s, date, surface, conditions}` | **yes (≥1)** | drives paces; `conditions` (heat, wind, terrain) adjusts confidence, not the number |
| `availability.days` | int 1–7 | **yes** | caps hard days and long-run placement |
| `availability.minutes_by_day` | map weekday → minutes | **yes** | a session longer than the slot does not exist; the planner must fit, then complain |
| `availability.off_days[]` | weekdays | **yes (may be empty)** | hard stops: never schedule on an OFF day, not even an easy run |
| `races[]` | `{date, distance_m, priority: A\|B\|C, known_course}` | **yes (≥1 A if goal-driven)** | sequencing, taper placement; sorted by date, ISO only |
| `goals.time_goal_s?` / `goals.finish_only` | union | yes (one) | determines whether paces are prescribed at all |
| `history.injury[]` | `{region, when, trigger, clinician_cleared}` | no | downgrades only; never upgrades |
| `history.weekly_volume_recent[]` | last 4–12 weeks km | no | anchors progression; missing ⇒ conservative ceiling |
| `equipment.surfaces[]`, `shoes[]`, `track_access`, `treadmill` | list | no | determines whether structured sessions are landable |
| `environment.temperature_season` | enum | no | heat/altitude degrades pace targets; only subtraction |
| `strengths_weaknesses.target` | enum (`speed`,`endurance`,`hill`,`consistency`) | no | chooses which optional session to add, never which to intensify |
| `persona` | id | yes | selects persona overrides, tone, and review sensitivity |
| `feedback.recent[]` | structured signals | yes at review time | see `review-engine` docs; the planner never parses prose |

Confidence rule: with 0 evidence items the plan is `exploratory: true`, all paces are feel-based, and
the plan schedules a test workout in week 2 rather than a quality session at invented paces.

### Output contract

```
Plan
  meta: {plan_id, generated_at, inputs_hash, knowledge_bundle_version, model, assumptions[], warnings[]}
  phases[]: {id, name, start_date, end_date, purpose, entry_criteria[], exit_criteria[]}
  weeks[]: {
    iso_week_start, phase_id, volume_km_target, hard_days, focus,
    reset: bool, milestone: {type, description}|null
  }
  sessions[]: {
    date (ISO), slot_start_local, day_index,
    type: enum(workout-library ids), purpose_zh, purpose_en,
    structure: {warmup, blocks[] {kind, duration_or_distance, pace_band|hr_band|rpe_band, recover}, cooldown},
    intensity: {anchor: {evidence_id, date}, band_s_per_km|null, feel, hr_band|null, rpe_band},
    estimated_minutes, landable_on_slot: bool,
    fallback: {trigger: missed|short_time|bad_weather|poor_sleep|pain, substitute_session},
    why: {rule_ids[], knobs{}}          # provenance for the comment generator
  }
  tests[]: {date, test_id, purpose, expected_range, rebaseline: bool}
```

- `fallback` is mandatory on every key session. Trigger `missed` must never mean "shift everything":
  the substitute is defined per session type (see `workout-library/*` → *Contraindications /
  substitute*). → rule: heuristics/session-substitution.yaml#missed_key_rule
- `why.rule_ids` is how the daily comment stays honest: the LLM narrates existing ids, it does not
  invent reasons.

### Worked example (compact)

Inputs: 4 days available (Tue 45 min, Thu 60 min, Sat 100 min, Sun 40 min), OFF Mon/Wed/Fri, one A
race **2027-02-28 marathon**, goal 3:45:00 (finish-only is the fallback goal), recent volume 28 km/wk
stable 8 weeks, evidence = 10K 52:10 on 2026-10-18 (flat, cool), no injuries, road only, mild winter.

Derived: evidence age 3 weeks → paces usable, band ±8 s/km; marathon prediction stated as a band
(3:44–3:52) with "goal 3:45 is at the top of the predicted band" as a written assumption. 4 days ⇒
max 2 hard days; Sat is the long-run slot; Sun cannot be a hard day (40 min) and follows the long run.

Phases (16 weeks from 2026-11-09): Base 2026-11-09→2026-12-20 (wk 1–6) · Build 2026-12-21→2027-01-24
(wk 7–11) · Specific 2027-01-25→2027-02-14 (wk 12–14) · Taper 2027-02-15→2027-02-28 (wk 15–16).
Reset weeks: 2026-12-07 (wk 5), 2027-01-11 (wk 10), plus the taper.

| Week | Date (Mon) | Vol km | Tue | Thu | Sat | Sun |
|---|---|---|---|---|---|---|
| 1 | 2026-11-09 | 30 | easy 40 | test: 5K time trial (re-baseline) | long easy 90 (16 km) | easy 40 |
| 3 | 2026-11-23 | 34 | easy 45 + 6×20 s strides | tempo 20 min @ T | long 100 (18 km) | easy 40 |
| 5 | 2026-12-07 | 27 | **reset**: easy 40 + strides | — (reset) | long 75 easy | easy 30 |
| 8 | 2026-12-28 | 40 | intervals 5×4 min @ I | easy 50 | progression long 105: 20 km, last 6 km @ MP | easy 40 |
| 12 | 2027-01-25 | 46 | cruise intervals 3×8 min @ T+ | easy 50 | MP long 115: 24 km w/ 12 km @ MP | easy 40 |
| 14 | 2027-02-08 | 48 | MP rehearsal 3×15 min @ MP | easy 50 | MP long 120: 26 km w/ 14 km @ MP | easy 40 |
| 15 | 2027-02-15 | 31 (−35%) | intervals 4×3 min @ I (last true hard session, 12 d out) | easy 45 | long 80 w/ 3 km @ MP (8 d out) | easy 30 |
| 16 | 2027-02-22 | 18 (−62%) | strides only | Thu 2027-02-25 strides + 2 km @ MP (3 d out) | Sat 2027-02-27 easy 25 + strides | **RACE 2027-02-28** |

Session detail (week 12, Saturday):

```yaml
date: 2027-02-06
type: progression-long-run
purpose_en: "Teach the legs to hold marathon pace on tired legs"
structure:
  warmup: {kind: easy, duration_min: 15, pace_band: "6:30–7:00 /km"}
  blocks:
    - {kind: middle, duration_km: 12, pace_band: "easy 6:20–6:50"}
    - {kind: mp, duration_km: 12, pace_band: "5:18–5:28 /km", rpe_band: "5–6"}
  cooldown: {kind: easy, duration_min: 10}
intensity: {anchor: {evidence_id: "E-2026-10-18-10K", date: 2026-10-18}, band: "5:18–5:28 /km", feel: "can speak in sentences, hands busy"}
estimated_minutes: 115
landable_on_slot: true   # slot 100 min ⇒ engine trims MP block to 10 km and logs the trim
fallback:
  missed: "easy 60 + 4×20 s strides same day; do NOT move to Sunday (only 40 min)"
  short_time: "90 min: MP block 8 km"
  pain: "stop, log location; easy 30 tomorrow, review triggers on 2 pain reports"
why: {rule_ids: ["specific_block", "mp_volume_cap_25pct"], knobs: {mp_km_pct: 25}}
```

Note the honest contradiction the plan must show rather than hide: `estimated_minutes: 115` exceeds
the 100-minute Saturday slot. The engine trims and records `trim_reason`, and the review surfaces
"your Saturday slot cannot hold the sessions this phase needs" as a scheduling problem, not a fitness
problem. [grade C; the volume/pace content is anchored to PLAN-S4/PLAN-S8 practice]

## Controversies

- **Should the planner accept goal times at all?** Yes for planning, never as a promise. Wording rule:
  "paces that would produce X", not "you will run X". No guarantees (AGENTS rule 6). status: policy
- **How much history to require.** Requiring 12 weeks of history excludes exactly the users we want.
  Default: 4 weeks requested, plan buildable with 0 at reduced ambition. status: contested
- **Weather adjustments.** Some products auto-slow paces in heat; others leave paces and warn.
  Engine default: keep the pace band, add a note and permit "effort, not pace" — because silently
  changing paces destroys comparability across the block. status: contested

## Individual differences

- `finish_only` users get no pace bands at all: purpose + time + feel only. Numbers cause more harm
  than help in that persona.
- Injury-history users get the same plan structure with substitution rules biased to lower impact and
  one fewer hard day for the first 6 weeks.
- Users with <40 available minutes in any slot: the planner must choose between a shorter key session
  and no key session and must say which it chose.
