---
id: phys-aerobic-adaptation
title: Aerobic energy supply and the time course of adaptation
status: curated
confidence: medium
evidence: [meta-analysis, rct, review, practitioner]
applies_to: [adult recreational runner, competitive amateur runner, returning-after-break runner]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S5, PHYS-S6, PHYS-S22, PHYS-S23, PHYS-S24, PHYS-S25, PHYS-S26, PHYS-S31]
---

## Key takeaways

- Almost all training volume in a running plan is oxidatively fuelled; the engine should treat "aerobic base" as a schedule property (frequency + weekly aerobic minutes), not as a pace label.
- Adaptations arrive on a **clock that the planner can rely on**: plasma volume in days, enzyme activity in 1–3 weeks, capillarisation and stroke volume in 4–8 weeks, measurable performance in 4–12 weeks. Order matters more than any single session.
- Detraining is fast at the start and then plateaus: V̇O₂max effect size ≈ **−0.62** over short breaks and **−1.42** over long breaks, with **no extra loss between 30–90 days and >90 days** [PHYS-S22]. A 3-week layoff and a 3-month layoff need different restarts, but not linearly worse ones.
- Gains are dominated by *session class* (aerobic volume, threshold, high-intensity) and by **repeatability across weeks**; one heroic session is worth less than three modest ones that survive contact with life.
- Where the literature disagrees (80/20 as a universal, "fat-adapted" training, minimum effective dose of intervals) is marked in `## Controversies` and must not be encoded as a hard rule.

## Facts

### What actually fuels a running session

| Dominant window | System | Practical meaning for a plan |
|---|---|---|
| 0–10 s efforts (strides, hill sprints) | Phosphocreatine | Not an aerobic stimulus; near-zero metabolic load; useful as neuromuscular primer. Full recovery 3–5 min between reps. |
| ~30 s–2 min | Anaerobic glycolysis | The "hard" band that produces accumulation without much aerobic payoff; 400–800 m repeats live here. |
| >2–3 min sustained | Oxidative | Everything the plan calls easy, tempo, threshold, long. |
| Repeated high-intensity intervals | Oxidative + glycolytic | The stimulus for V̇O₂max and threshold; requires enough aerobic recovery between reps to keep the next rep aerobic-dominant. |

Fuel use moves along a continuum: at low intensity a large share of energy comes from fat, at high intensity almost all from carbohydrate. Fat-oxidation rate is highest at moderate intensity (commonly stated as ~55–65% V̇O₂max in untrained to trained adults; **confidence low-medium**, textbook consensus, no verified meta-analytic number pinned here). Practical consequence: session duration and carbohydrate availability interact, and neither is a training-quality signal by itself.

### Order and timing of chronic adaptation (textbook consensus, `confidence: medium`)

| Adaptation | Earliest detectable | Consolidation | What the user feels |
|---|---|---|---|
| Plasma volume / stroke-volume precursor | 3–7 days | 2–3 weeks | Easier early runs, lower HR at the same pace, faster heat dissipation |
| Resting HR / autonomic balance | ~1–2 weeks | 4–8 weeks | Lower morning HR (noisy — see `signals/hrv-and-wellness.md`) |
| Mitochondrial enzyme activity | 1–2 weeks | 4–8 weeks | Less "burning" at a given pace |
| Muscle capillarisation | 2–4 weeks | 6–8+ weeks | Better turnover at threshold |
| Maximal aerobic power (V̇O₂max) | 4 weeks | 8–12 weeks per "block" | Faster easy pace, faster intervals |
| Running economy / force | 4–6 weeks | 8–16 weeks | Same pace feels cheaper; hills |
| Tendon/bone remodeling | 6–12 weeks | months | Tolerance of volume and speed |

Consequences: (a) a plan that changes its mind every 7 days produces the first-row adaptations and none of the later ones; (b) the structural tissues lag 2–3× longer than the cardio-metabolic signal, so a plan that "works" on HR by week 3 can still be ahead of the musculoskeletal system.

### High-intensity dose–response

Meta-analyses of sprint interval training (SIT) report V̇O₂max improvements comparable to traditional high-intensity interval training (HIIT) and moderate-intensity continuous training in adults who are not elite distance runners [PHYS-S23, PHYS-S24, PHYS-S25, PHYS-S26]. Two things those reviews do *not* support are encoded as rules below: SIT does not replace the volume or the specific-speed work a distance race demands, and short protocols carry a real discomfort/injury cost when inserted into a runner's week.

### Detraining and re-training (verified)

Zheng et al. 2022 (systematic review/meta-analysis, 21 studies, 3,315 participants screened; **athletes, outcome V̇O₂max**) [PHYS-S22]:

- Short-term detraining: V̇O₂max SMD **−0.62** (95% CI −0.94 to −0.31).
- Long-term detraining: SMD **−1.42** (95% CI −1.99 to −0.84).
- Between 30–90 days and >90 days of no training: **no further significant difference** (Q = 0.54, p = 0.46) — the loss curve flattens.
- Losses are **larger in younger participants (<20 y) and in those with a higher pre-detaining training state**: fitness that was recently bought is the fitness that leaves first.
- Retaining *some* exercise during the break blunted the loss.

Retraining is faster than first-time training (memory of the adaptations), but the structural tissues do not honour that shortcut — see `physiology/fatigue-fitness-recovery.md`.

## Practice

- Frequency before intensity: three aerobic sessions per week beat one, independent of pace labels.
- A defensible week for a recreational runner is **2 aerobic sessions + 1 quality session + 1 long aerobic session**, with the quality session repeated weekly at a fixed effort, not a fixed pace.
- Change one variable per week (duration, then frequency, then intensity, in that order). Intensity is the last lever, not the first.
- After a break: rebuild on the detraining curve (see `## Engine implications`) rather than on the last completed plan.
- Judge a block by what survived: 8–12 weeks of near-continuous aerobic volume is the unit of progress, not the individual best session.

## Controversies

- **80/20 intensity distribution** — robust in elite/very trained cohorts and in periodisation reviews as a *descriptive* pattern [PHYS-S31]; contested as a *prescription* for time-limited recreational runners, where higher-intensity shares still produce improvements. Stance: encode a ceiling on hard days per week and a floor on aerobic share, never an exact 80/20 target.
- **"Fat-adapted" / low-carb training** — shifts substrate use, does not clearly improve performance for race-pace efforts, and increases perceived effort. Out of scope for this planner (no nutrition prescription is allowed by repo rules) and never a scheduling signal.
- **Minimum effective dose of intervals** — some protocols (short SIT) deliver cardio-metabolic benefit in minutes; whether that transfers to a runner's race goal is unproven. Stance: allow "minimum effective dose" plans only when they are honest about the goal they serve (health, not a 10 k PB).

## Escalate to a clinician

- Chest pain, exertional syncope or near-syncope, unexplained dyspnoea, or a hard/wired pulse with dizziness.
- A resting HR that rises >15% above the user's own 30-day baseline together with illness symptoms, or fever: stop training and refer rather than schedule through it.
- Suspected relative energy deficiency in sport (see `physiology/demographics-and-context.md`): the planner does not diagnose and never prescribes intake.

## Worked examples — three blocks, same physiology

| Situation | Weeks 1–4 | Weeks 5–8 | Weeks 9–12+ | Binding constraint |
|---|---|---|---|---|
| Restart after 3 weeks off (healthy) | 60–70% of pre-layoff volume, easy–moderate only, no intervals | back to 85–90%, one quality session | full load if symptoms quiet | tendon/bone lag sets the pace of the **volume** ramp, not the intensity |
| 12-week 10-k block, 5 sessions/week | aerobic base + strides | 1 threshold + 1 VO₂max-class session, volume +5–8% | race-specific reps, then taper | ≥48 h between quality days; interval effect appears after 4–6 weeks |
| 16-week first marathon | easy volume plus one long run | long run grows first; MP inside it, ≤25–30% of the run | at most 2 quality sessions, then a 2–3-week taper | recovery cost of the long run caps everything else; strength stays 1×/week |

The rows differ in goal, not in mechanism: aerobic capacity responds in weeks, structural tissue in
months, and the plan is bounded by the slower clock.

## Minimum effective structure of an adaptation block

- **Progressive, not step-wise:** the weekly change guard (≈10%, `range 5–15`) is the operative
  control, not an absolute mileage cap.
- **One purpose per block.** Aerobic emphasis, threshold emphasis, or race-specific emphasis. A block
  chasing all three produces no interpretable signal and no testable plan.
- **Placement before volume.** With 3–4 sessions/week, one quality session is enough; a second is
  earned by ≥8 weeks at the current structure [PHYS-S31].
- **A test or race-shaped session at the end**, otherwise the block's effect cannot be read and the
  next block has no input.
- **Deload embedded, not improvised:** every third or fourth week holds volume and drops the second
  quality session — a subtraction, therefore always allowed.

## Common planner mistakes this folder exists to prevent

- Deriving interval intensity from a **predicted** V̇O₂max or a stale HR number: intensity comes from a
  performance source, with effort as the anchor on bad-data days.
- Reading a good week as an adaptation that needs 4–12 weeks to appear, or a bad week as detraining,
  which takes far longer than a week [PHYS-S22].
- Compensating for a missed session by adding "a bit of everything" later in the week; the correct
  response is shift or skip, never append (see `fatigue-fitness-recovery.md`).
- Importing elite session shapes (two-a-ways, 8 sessions/week, 20 km at marathon pace) into a
  4-session schedule: the 80/20 distribution describes trained populations, whereas in beginners
  absolute volume and consistency dominate [PHYS-S31].

## Engine implications

- `→ rule: heuristics/progression.yaml#adaptation_block_weeks` — keep any focus block ≥4 weeks and ≥8 weeks when the goal is race performance; block swaps are the planner's most expensive action, cap them.
- `→ rule: heuristics/progression.yaml#hard_days_per_week_max` — 2 for plans with ≥5 running days, 1 otherwise; hard days must be separated by ≥48 h of non-hard work.
- `→ rule: heuristics/progression.yaml#structural_tissue_lag_factor` — when volume rises, the allowed *intensity* rise is the previous week's volume, not this week's (delay the speed lever ~2 weeks behind the duration lever).
- `→ rule: heuristics/restart-after-layoff.yaml#layoff_bucket_days` — buckets 0–6 / 7–13 / 14–29 / 30–90 / >90 days; restart volume uses the 30–90 and >90 buckets with roughly equal depth, because loss plateaus after ~30 days [PHYS-S22].
- `→ rule: heuristics/restart-after-layoff.yaml#quality_session_delay_days` — no race-pace or VO₂max session until the user has completed ≥2 weeks of continuous aerobic volume; strides and hills are allowed earlier.
- `→ rule: heuristics/session-classes.yaml#quality_session_share_max` — cap quality-session minutes at ~20–25% of weekly session minutes; this is a clamp on a typo, not a prescription.
