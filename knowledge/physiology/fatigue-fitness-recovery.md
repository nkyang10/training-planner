---
id: phys-fatigue-fitness
title: Fatigue, fitness, recovery windows and tapering
status: curated
confidence: medium
evidence: [meta-analysis, rct, review, practitioner]
applies_to: [adult recreational runner, competitive amateur runner, returning-after-break runner]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S5, PHYS-S6, PHYS-S10, PHYS-S11, PHYS-S20, PHYS-S22, PHYS-S27]
---

## Key takeaways

- The fitness–fatigue idea behind every dashboard metric traces to a real model [PHYS-S5, PHYS-S6]: a training impulse produces **fitness and fatigue in parallel**, both decaying exponentially, with fatigue decaying faster. That asymmetry is the whole justification for tapering — and the whole reason "you look fit in the app" proves nothing.
- The model's **time constants are individual and not well estimated** for a recreational runner. The planner should use them as *shapes* (fatigue clears in days, fitness in weeks), not as a performance forecast.
- Recovery is per-stimulus, not per-session: metabolic recovery is hours, muscle damage 2–5 days, connective tissue weeks. A plan that only counts "did the session happen" ignores the slowest clock.
- Session-to-session spacing matters more than session size for hard work: **48 h between high-intensity efforts** is the safe default and it comes from the damage/accumulation side, not from fitness theory.
- Fatigue is only partly physiological — perceived fatigue, sleep debt and life stress move the same day. The planner treats them as reasons to *subtract*, never as reasons to add.

## Facts

### The impulse–response frame

Banister's impulse–response model [PHYS-S5] and its running-specific validation by Morton, Fitz-Clarke and Banister (J Appl Physiol 1990;69(3):1171-1177, PMID 2246166) [PHYS-S6] express performance as:

```
P(t) = P0 + k·fitness(t) − k·fatigue(t)
fitness(t) = Σ_{i≤t} TL_i · exp(−(t−t_i)/τ_f)
fatigue(t) = Σ_{i≤t} TL_i · exp(−(t−t_i)/τ_s)
```

where `TL_i` is the quantified training load of session *i* (TRIMP in the original work) and `τ_f > τ_s`.

- **Verified**: the model structure, the dual-response assumption, and that predicted performance correlated with measured running performance during training and taper in the original report [PHYS-S6].
- **Not verified**: any specific numeric `τ_f`, `τ_s`, or `k`. Published values vary widely with the population, the load metric, and the fitting window; typical literature ranges put the short (fatigue) constant on the order of days and the long (fitness) constant on the order of weeks. **Confidence: low** for any specific pair of constants in a recreational runner. Treat fitted τ values as a per-user, slowly-re-estimated quantity if they are used at all.
- The practical corollary that *does* survive: after stopping, fatigue disappears before fitness, so performance improves into a taper even while the fitness term decays.

### Recovery clocks by stimulus (`confidence: medium`, textbook/consensus unless cited)

| Stimulus | Substrate/glycogen | Muscle damage soreness | Performance decrement | Structural tolerance |
|---|---|---|---|---|
| Easy aerobic 40–60 min | ~12–24 h | 0–24 h | usually none | tracks weekly volume |
| Threshold / tempo 20–40 min at effort | 24 h | 24–48 h | ~24–72 h | weeks |
| V̇O₂max intervals | 24–48 h | 24–72 h | **48–72 h** | weeks |
| downhill-heavy / long race-pace | 24–48 h | 48–96 h | 2–7 days | weeks–months |
| Race (10 k) | 24–48 h | 2–4 days | ~3–7 days | — |
| Half marathon | 1–2 days | 3–7 days | ~7–14 days | — |
| **Marathon** | 2–3 days | 3–10 days | **~2–4 weeks** before quality work is sensible | 4–8+ weeks |

Marathon recovery is the one number practitioners and cohort reports agree on directionally: several weeks before hard sessions are productive, and the user's own data (HR at fixed pace, perceived effort) should override the calendar [PHYS-S27 practice guidance; `confidence: medium`].

### What actually drives accumulated fatigue

- **Weekly load and its change.** The relative change in weekly load is a crude but usable signal; the acute:chronic machinery built on top of it is contested (see `signals/acute-chronic-workload.md`).
- **Monotony / strain.** Weekly monotony (mean daily session load ÷ SD of daily load) and strain (weekly load × monotony) capture the "hard days with no real easy days" pattern [PHYS-S10, PHYS-S11]. A monotony above roughly 1.5–2.0 is a common practitioner flag; `confidence: low` on the exact cut-point, and the concept is grade-B at best in runners.
- **Session-length distribution.** Two hard days back-to-back produce disproportionate soreness and a poor second session, independent of total load.
- **Non-training stressors.** Sleep restriction, alcohol, illness and life stress are the largest single-day movers of HR and HRV in free-living data (tens of thousands of users) [PHYS-S20]. They are invisible to the training log and they dominate short-term signals.

### Tapering (`confidence: medium`, textbook consensus)

- Reduce **volume** (commonly 30–50%), keep **frequency** and keep **some intensity** in short doses. Cutting intensity as well as volume loses the adaptation the block bought.
- A 1–3 week taper for a 5 k–half, 2–3 weeks for a marathon, with the last 7–10 days low volume and short race-pace touches.
- Expect a "feel-good" window in the final days that is fatigue clearance, not new fitness. Never let the planner read it as licence to add.

## Practice

- Default spacing rule: hard day → 48 h of aerobic-only → next hard day. Compress only when the block demands it and never twice in one week.
- After any race, schedule 5–7 easy days before the first structured session; after a marathon, 14–21 days.
- When a session is missed, **do not stack the replacement onto the next hard day**. Skip or shift the block; the sequence matters more than the individual workout.
- When two hard days are unavoidable (race weekend + a work-trip week), make the second one shorter at the same effort, not the same length at lower effort — shorter is easier to absorb.

## Controversies

- **Is the fitness–fatigue model predictive for amateurs?** Original validation was in small samples of motivated subjects; independent replications in recreational cohorts are weak, and the parameters are unstable. Stance: keep the model for explanation and taper logic, ban it from setting paces.
- **48 h rule vs "fat days" training** — trained athletes deliberately train on residual fatigue; for a 40–60 km/wk recreational runner the evidence for doing so is absent. Stance: conservative spacing, and let the *user* opt into compressed blocks with a recorded acknowledgement.
- **Domed vs decaying performance function** — the original papers' assumption that a big single session yields a decaying performance curve is not testable in the wild. Not encoded.
- **"Recovery runs" flush fatigue** — no strong evidence they accelerate recovery beyond very light activity; they are harmless and useful as volume, which is the only reason the planner keeps them.

## Escalate to a clinician

- Soreness that is localised, sharp, worsens during a run, or changes gait: stop loading that pattern and refer; the planner may not "train through" focal pain.
- Fatigue with unintended weight change, persistent elevated resting HR, insomnia, or mood change lasting >2 weeks: refer (overtraining is a diagnosis of exclusion, and differential includes medical causes).
- Dark urine with severe muscle pain after a hard or hot session: urgent referral (rhabdomyolysis is a medical emergency, not a training variable).

## Worked examples — spacing and taper arithmetic

| Session just completed | Earliest next hard day | Default next hard day | Why the default is later |
|---|---|---|---|
| 5 × 4 min at ~95% HRmax | +48 h | +72 h | neural and muscle-soreness recovery precedes the aerobic benefit |
| 3 × 10 min threshold | +48 h | +48 h | lower damage, high metabolic load; 48 h usually sufficient |
| Long run 100 min with 20 min at race pace | +48 h | +72 h | focal tissue load; the long run itself stays weekly |
| Race (half marathon) | +10 d | 10 easy days, then easy-to-moderate | `post_race_easy_days`; the calendar week after a race carries no quality session |
| Easy 40 min | +24 h | any day | never a limiting factor; easy days do not consume the hard-day budget |

Taper arithmetic from the volume-cut knob (30–50%): a runner at 500 load units/week in week −4 runs
roughly 450 / 375 / 300 across weeks −3 to −1 with **one short race-pace touch kept in each of the
last two weeks**. Cutting volume while also cutting intensity produces a flat race-day feeling;
cutting intensity while holding volume produces no freshness at all.

## Missed-session decision tree

1. Was the missed session **quality** (intervals, threshold, race pace)?
   - Yes: is there room in the week that preserves ≥48 h on both sides? → shift it there.
     Otherwise → skip it, keep the long run, and note the skip.
   - No (easy day) → skip; do not extend another day to "make up" minutes.
2. Would the shift create two hard days within 48 h, or a third quality session this week? → skip instead.
3. Is this the **second** missed quality session in a rolling 14 days? → do not reschedule either.
   Subtraction only: consider reducing the following week's increase, and say so in the comment.
4. Never append. Adding minutes to completed or planned days to "recover" a session is the single most
   common way an amateur plan turns into a spike.

## Engine implications

Recovery is the constraint the plan schedules around, not a score to chase.

- `→ rule: heuristics/recovery.yaml#hard_day_gap_hours` — default 48, `range 24–96`; a plan that violates it must be blocked, not merely warned.
- `→ rule: heuristics/recovery.yaml#post_race_easy_days` — {5k:5, 10k:7, half:10, marathon:18} in days, `range 3–35`; scaled by the user's own recovery evidence if available.
- `→ rule: heuristics/recovery.yaml#missed_session_policy` — `shift_or_skip`, never `append`; two unscheduled sessions in one week is a hard stop (repo rule: never change the past, ≤2 changes per review).
- `→ rule: heuristics/taper.yaml#volume_cut_pct` — 30–50% during the taper, `range 20–60`; `→ rule: heuristics/taper.yaml#keep_intensity` — at least one short race-pace touch per week in the last 2 weeks.
- `→ rule: heuristics/load.yaml#weekly_load_change_max_pct` — cap week-to-week total-load change (default ~10%, `range 5–15`) as a *subtractive* guard; where the weekly change is large, downgrade rather than move.
- `→ rule: heuristics/load.yaml#monotony_flag` — flag (display + suggestion only) weekly monotony > 1.8; never auto-restructure on monotony alone, because the cut-point is `confidence: low`.
- `→ rule: heuristics/fitness-fatigue.yaml#enabled` — off by default for pace setting; if enabled for display only, τ constants are per-user with `range 5–25 d` (fatigue) and `range 20–80 d` (fitness) and must be re-estimated no more than monthly.
