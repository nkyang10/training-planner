---
id: periodization/phase-transition-rules
title: "Phase transitions, race sequencing and reset blocks"
status: draft
confidence: medium
evidence: [review, meta-analysis, practitioner]
applies_to: [plan-generator, review-engine, calendar]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S5, PLAN-S7, PLAN-S8, PLAN-S10, PLAN-S11]
---

**Key takeaways**

1. Phase changes need **criteria, not dates**. Advance on evidence (sessions completed, key-session
   paces hit, no red-flag feedback), not because the calendar says week 7.
2. A phase may end early for a race; it may not be skipped when a user feels good. "Feeling good in
   week 3" is an argument for holding, not for jumping to race pace.
3. **Races are training** below A-priority: a B/C race replaces the hard session of that week and
   costs one easy day, not a week of the plan.
4. Every block boundary contains a **reset week** (down week) unless the user has explicitly opted
   into a cumulative-fatigue design; it is the cheapest insurance in the plan.
5. Multi-race sequencing is decided at plan-build time, in writing: one A race, the next race is a
   hard session or a tune-up, and the second A race gets its own taper only if ≥8 weeks separate them.

## Facts

- Taper is a phase transition with measured parameters: ~2 weeks, exponential volume reduction of
  41–60%, intensity and frequency preserved. Shorter/longer tapers and larger cuts performed worse on
  average in the meta-analysis. [PLAN-S5 grade A]
- Rapid rises in load are the most-studied modifiable risk factor in running-injury research, with
  inconsistent effect estimates across studies; there is no validated safe-increment constant.
  [PLAN-S7 grade A review / effect estimates inconsistent → confidence medium]
- The comparison literature that exists is about what happens **inside** a block (distribution), not
  about when to change blocks. Block-boundary rules below are coaching consensus. [PLAN-S2 gap →
  grade C]

## Practice

### Base → Build: entry criteria (all must hold)

- ≥4 weeks of ≥3 runs/week with ≥80% of prescribed sessions completed.
- Long run ≥ 90 min (half) or ≥ 100–110 min (full marathon) at easy effort, twice in the last 3
  weeks. → rule: heuristics/phase-transitions.yaml#base_long_run_min (range 60–150)
- Two consecutive easy weeks with **no** red-flag pain (pain that changes gait, or morning stiffness
  > 2 days in the same spot).
- If the user's stated goal is a time, at least one piece of fitness evidence ≤ 8 weeks old (race,
  time trial, or test workout) — otherwise Build paces are guesses; run a test first
  (`plan-construction/measurement-and-testing.md`).
- Failure path: hold Base and repeat the criteria check next week. Do not advance with a "partial"
  flag that the user cannot see.

### Build → Specific (race preparation)

- 8–12 weeks out from the A race for a marathon; 4–6 weeks for a half; 3–4 weeks for 10K.
  → rule: heuristics/phase-transitions.yaml#specific_block_weeks (range 3–14)
- Criteria: threshold/MP sessions completed at prescribed pace with RPE ≤ 7 in the last 2 weeks;
  weekly volume within ±10% of target for 2 consecutive weeks.
- Content shift: paces move to race-specific (MP segments inside the long run, race-pace reps), and
  one key session per week becomes "rehearsal" (shoes, fuel, warm-up, start time of day).

### Specific → Taper → Race

- Taper length by distance: 10K 5–7 days; half 10–14 days; marathon 14–21 days (default 14, extend
  toward 21 for heavy-volume marathoners or masters). [PLAN-S5 + practitioner; grade C for the
  distance gradient] → rule: heuristics/taper.yaml#taper_days (range 4–28)
- Volume cut 41–60% (default 50%), session **count** held to ~70–80% of peak, intensity and race pace
  retained in shortened doses. [PLAN-S5]
- Last hard session: 5–7 days out (marathon), 3–4 days out (≤10K) — a short race-pace tune-up, not a
  VO₂max session.
- No new shoes, no new food, no new course, nothing untested in the last 10 days.

### Post-race → Maintenance

- Days 0–3 after a race at or above half distance: no structured session; walking and easy spinning
  are fine. Days 4–10: easy runs only, ≤ 60% of peak weekly volume, no strides until gait is
  symmetric. Re-entry to Build requires: 2 easy weeks with 0 pain reports and a self-rated "normal
  legs" day. [grade C practitioner]
- A race used as a **fitness test** still consumes recovery; the engine bills it against the week it
  happens in, not the week the user reports it.

### Races as training (B/C priority)

- A B-priority race within 12 weeks of the A race: keep it, put it on a weekend, treat it as the
  week's hard session, reduce the rest of that week to easy, and take the following week to ≤ 80%
  volume. Two races inside 10 days → the second one is off-plan unless it is the A race.
- A C-priority race (fun, non-goal): allowed at most 1 per 6 weeks during Build; the engine inserts
  the down week around it.
- Never allow a B race in the 10 days before the A race, even if the user asks: instead offer the
  same course as a "rehearsal" long run at easy-plus effort.

### Concurrent goals

- Two goal races 6–12 weeks apart: one build, taper #1, then 2–3 easy weeks, then a second shorter
  build + taper. Expect the second performance to be equal or slightly worse; say so in the plan
  notes. [grade C]
- Two goal races < 6 weeks apart: pick one A. Encode the other as a controlled hard session with a
  "go fast if it feels free, otherwise easy" note.
- Winter base + spring races cluster: build once, sequence 3 races as hard / tune-up / A.

### Multi-race season sequencing (marathon + autumn half example)

| Weeks | Block | Notes |
|---|---|---|
| 1–8 | Base (aerobic) | volume grows ≤ 10%/wk, strides weekly |
| 9–14 | Build | threshold + first MP long run at week 12 |
| 15–18 | Specific | MP long runs, B race at week 17 as a hard session |
| 19–20 | Reset | 60–70% volume, 1 short quality session |
| 21–26 | Specific #2 | race-pace work, A race rehearsal at week 24 |
| 27–28 | Taper | −50% volume, intensity kept, A race week 28 |

[shape: grade C practice; boundaries derived from PLAN-S5 taper parameters]

### What a reset block contains

- Volume 60–75% of the preceding week for 1 week inside a block; 50–60% for a 1-week inter-block
  reset. → rule: heuristics/load-progression.yaml#reset_volume_pct (range 50–80)
- Session count roughly preserved (shorter, not fewer), 1 quality session at reduced length only.
- Zero strides-free weeks: keep 4–6 strides once for neuromuscular maintenance; the point is to shed
  load, not movement quality.
- Mandatory after: any week with ≥2 missed hard sessions (fatigue is often the reason, not laziness);
  any week containing a B race; any week with a pain report; every 4th week by default.

## Controversies

- **Cumulative fatigue vs down-weeks.** Hansons omits recovery weeks deliberately; Pfitzinger uses
  3:1/2:1 step cycles. Default = down-week every 4th week; opt-out exists only for personas
  `competitive-amateur-marathon` and only with a recorded acknowledgement. [PLAN-S10, PLAN-S11]
  status: contested
- **"Races as training" for time-goal seekers.** Some coaches will not race below A priority inside a
  marathon build; others use 5K/10K tune-ups deliberately at 3–4 weeks out. Engine defaults to "tune-
  up allowed, 1 only, ≥10 days before the A race". status: contested
- **Double-taper seasons** (two marathons 8 weeks apart) are common and unstudied. Allowed, with
  explicit "second race will not be a peak" language. status: contested

## Individual differences

- Masters: add 3–7 days to every block boundary; the reset week becomes two weeks if any session felt
  "heavy" for >48 h.
- Novices: transitions are calendar-driven but *conditional* on attendance; a novice who missed 3 of
  4 weeks repeats the week rather than advancing (repeat, don't delete).
- Returning-after-layoff users have no Build phase until tissue tolerance is rebuilt, regardless of
  how fit the easy runs feel.

## Escalate to a clinician

Pain that alters gait, swelling, or pain persisting > 72 h after a session is a stop-and-ask-a-
clinician event, not a phase-transition decision. See `risk-and-safety/red-flags-for-escalation.md`.
