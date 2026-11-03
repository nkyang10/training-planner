---
id: phys-demographics-context
title: Demographics and context — age, sex, pregnancy, heat, altitude, breaks
status: curated
confidence: medium
evidence: [meta-analysis, review, practitioner]
applies_to: [all users]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S3, PHYS-S22, PHYS-S27, PHYS-S33, PHYS-S40, PHYS-S41, PHYS-S48]
---

## Key takeaways

- Demographics change **ranges and caution levels**, not the structure of a plan. Except where a medical body says otherwise, the same session classes apply to a 25-year-old and a 62-year-old; the *rate of progression* and the *recovery allowance* change.
- The strongest verified demographic fact is modest: **menstrual-cycle phase has a trivial average effect on exercise performance** in eumenorrheic women — too small and too variable to drive scheduling [PHYS-S27].
- Context that the plan *can* see (heat, altitude, a training break, a new job, a baby) usually matters more than demographics it infers.
- Every rule here is **subtractive**: these factors may reduce a session, delay progression or trigger a referral message. None of them may add intensity.

## Facts

### Age

- After ~25–30 y, V̇O₂max declines on the order of **5–6% per decade** in the general population, with a steeper decline after ~50–60 y and additional decline from loss of muscle mass and activity; endurance-trained masters athletes decline more slowly (~5%/decade or less) and can hold performances into their 60s and 70s (`confidence: medium`; consensus from longitudinal/cross-sectional reviews, no single number re-derived here) [PHYS-S41].
- Masters-relevant trainable targets shift: power/economy and the ability to *absorb* hard sessions decay faster than aerobic capacity, so strength work and recovery days do proportionally more work than in a 25-year-old plan.
- Practical allowances (`confidence: low-medium`, coaching consensus, express as tunable knobs, not constants): +1 recovery day after hard sessions for users ≥50 y; slower volume ramp; more conservative race frequency.
- HRmax equations diverge most in older adults [PHYS-S1, PHYS-S4] — an age-predicted HRmax is the least reliable it ever is exactly where masters runners need it.

### Sex

- Measured peak HR in women is better described by **206 − 0.88·age** than by male-derived equations in the largest female cohort available (5,437 women; PMID 20585008) [PHYS-S3]; the same equation is protocol-limited (a symptom-limited clinical population, mean age 52) — **grade B, do not treat as a running constant**.
- Physiological differences that matter for scheduling: lower absolute haemoglobin and thus lower absolute V̇O₂max ceiling at the same body mass, faster fatigue in some high-intensity domains but better fatigue resistance in others, and higher heat-strain sensitivity in humid conditions when humidity (not temperature) is the driver. Direction is consistent across reviews; magnitudes are not pinned here (`confidence: low`).
- What the planner must **not** do: apply a sex-based pace or zone offset. Zones come from the user's own measured data.

### Menstrual cycle (verified)

McNulty et al., *Sports Med* 2020;50(10):1813-1827, PMID 32661839 [PHYS-S27] — systematic review + Bayesian network meta-analysis, **78 studies** (51 pairwise, 73 network):

- Trivial average effect of cycle phase on endurance **and** strength outcomes.
- Performance was **trivially lower in the early follicular phase**: pooled ES vs all other phases **−0.06** (95% CrI −0.16 to 0.04); largest contrast early- vs late-follicular **−0.14** (95% CrI −0.26 to −0.03).
- Rank probability (SUCRA) worst in early follicular (30%), all other phases 53–55%.
- Evidence quality rated **low** by the authors; explicit recommendation: **a personalised approach**, no general guidelines.

Consequence: cycle phase may be *offered* as a self-reported tag; it may never be inferred to shift a workout. Oral-contraceptive users and users with irregular cycles are not covered by this evidence at all.

### Pregnancy and postpartum

Consensus guidance (ACOG committee opinion [PHYS-S48]; IOC/consensus statements on pregnancy [PHYS-S33]) — `confidence: medium` on the wording, since retrieved through secondary descriptions:

- In an **uncomplicated** pregnancy, regular moderate aerobic activity is recommended (~150 min/week of moderate activity is the public-health anchor), and continuing a pre-pregnancy running habit is usually appropriate with adjustment.
- Intensity should be set by **talk test / perceived effort**, not by HR zones: resting HR and HR-at-load rise during pregnancy, making HR zones misleading.
- Red flags that stop exercise and require care: vaginal bleeding, dizziness, chest pain, calf pain/swelling, contractions, fluid leak, fetal growth restriction. Progressive resistance/diaphragm/pelvic-floor work becomes relevant as pregnancy advances.
- Postpartum: return is staged (typically ~6 weeks after uncomplicated vaginal birth, ~8 weeks or per clinician after caesarean), with attention to pelvic-floor symptoms, diastasis and — for breastfeeding users — timing/comfort rather than performance. Return to pre-pregnancy volume is a **months-long** re-build, and the first trimesters' "I ran 8 k easily" is not the baseline.
- The planner never sets intensity targets from pregnancy-related physiology, and it must not schedule a race goal inside a window the user has flagged as pregnancy/postpartum without a clinician-clearance acknowledgement.

### Heat, altitude, terrain

- Heat/humidity raises HR and perceived effort at a fixed pace (cardiovascular drift), slows pace, and requires 1–2 weeks of acclimatisation for most of the benefit. Practitioner consensus places meaningful marathon-performance decrement in warm/humid conditions and expects **pace, not effort, to give way** [PHYS-S40]. Magnitude claims of "seconds per km per °C" circulate widely; **do not encode a coefficient** (`confidence: low`).
- Altitude: acute exposure above ~1,500–2,000 m reduces V̇O₂max and therefore every pace-equivalent zone; acclimatisation takes weeks and never fully restores sea-level performance. Rule of thumb that survives: **at altitude, effort governs, pace is discarded**.
- Trail/technical terrain: same effort costs more; the correct substitution is time-on-feet, not distance.

### Breaks, layoffs and return

- Verified detraining magnitudes (Zheng et al. 2022 meta-analysis [PHYS-S22]): V̇O₂max SMD **−0.62** short-term, **−1.42** long-term, **no additional loss 30–90 d vs >90 d**; larger loss in younger and higher-trained users; retaining *some* activity blunts the loss.
- Retraining is faster than first training (adaptations recur), but tendon/bone tolerance is not — the classic return-injury pattern is a user whose aerobic system returns in 2 weeks and whose calves fail in 3.
- Return-from-break structure: 2 weeks of continuous easy volume → reintroduce strides/hills → then threshold → then V̇O₂max, with the *first* hard session at a reduced dose of the last completed session, not the last planned one.

### Adolescents, masters with comorbidity, medications

- Youth training emphasises volume of movement, enjoyment and multi-sport variety over structured interval loading; growth-plate pain and persistent pain in a child/adolescent are referral events, not training variables.
- Beta-blockers and some calcium-channel blockers blunt HRmax and invalidate HR zones outright; stimulants and some thyroid medications raise HR. Users on rate-modifying medication must be offered **pace-by-effort or RPE-only** plans. The planner records "HR zones invalid" as a state, not a warning.

## Practice

- Ask for context at onboarding and at each review: available days, usual environment (heat/altitude/trail), recent breaks, pregnancy/postpartum status, and medications that affect HR. Store as facts the engine can subtract with.
- Progression rate is the demographic-sensitive knob; session *type* is not.
- Never infer a demographic from data (pace, HR, name). Ask; and allow "prefer not to say", which falls back to the most conservative generic handling.

## Controversies

- **Cycle-based periodisation of training** (schedule hard days in the late follicular phase) is sold in coaching media; the meta-analytic effect is trivial and individual responses vary in *direction* [PHYS-S27]. Stance: no cycle-driven scheduling.
- **"Training fasted" / body-composition-driven features** — out of scope by repo rule (no nutrition or weight targets) and not evidence-supported as a performance lever for amateurs.
- **Higher hard-session tolerance in women's high-intensity work** — interesting, inconsistent across domains; never a default scheduling rule.
- **Heat coefficients per °C** — vendor and coaching folklore; the underlying physiology is real, the coefficients are not transferable.

## Escalate to a clinician

- Pregnancy: any red flag listed above, plus any new exercise plan in the presence of hypertension, cardiac disease, type 1 diabetes, placenta praevia after 28 weeks, or intrauterine growth restriction — the app defers to the clinician rather than planning.
- Postpartum: pain, bleeding, incontinence or pelvic pressure with running → stop and refer.
- Users ≥40 y starting high-intensity training with cardiovascular risk factors, or any user with exertional chest symptoms: clearance before interval sessions.
- Suspected RED-s (low energy availability): persistent fatigue + missed periods + performance decline + stress fractures — the planner does not diagnose, does not discuss intake or weight, and refers.
- Medication questions (beta-blockers, asthma inhalers, stimulants) → clinician/pharmacist, never an app-side adjustment rule.

## Worked examples — context overriding the numbers

| Context | What the plan keeps | What the plan discards | Duration of the override |
|---|---|---|---|
| Race-day temperature 28 °C, humid | effort bands, fueling and pacing *strategy* by feel | the target finish time as a pacer | that session only; the goal itself is re-discussed after the race |
| Training camp at 1 800 m | session structure and duration | all pace targets; PB language | arrival +7–10 days, then re-test before pace returns |
| Returning 8 weeks postpartum with clearance | easy continuous running, strength re-introduction | intervals, race scheduling, any intensity increase in a review | until the user records clearance; the app still never prescribes |
| Beta-blocker recorded | calendar structure, RPE, pace-on-flat | every HR-derived metric and zone | indefinite; `hr_zones_invalid` stays set |
| Night shift, 3 sleep-deprived nights | one easy session, shortened | the week's quality session | until sleep pattern is restored, using the wellness windows |

## Screen-before-plan checklist

- Are there cardiac red flags (chest pain, syncope, unexplained breathlessness)? → no plan until a
  clinician has cleared exercise, and the app says so in plain language.
- Are any medications or conditions recorded that invalidate HR data? → set `hr_zones_invalid` and
  switch the plan to effort and pace-on-flat anchors.
- Is there a pregnancy or postpartum flag? → subtractive-only edits, no race-goal scheduling, and no
  intensity-raising review action without a recorded clearance acknowledgement.
- Has the user been continuously active for the last 4 weeks? → if not, the ramp starts from the
  layoff bucket, not from the last plan.
- Is the environment extreme (heat, altitude, pollution, cold)? → context mode first; the plan shape
  is decided after the environment is known, never corrected afterwards with pace.

## Engine implications

- `→ rule: heuristics/context.yaml#heat_handling` — when the user's environment flag is hot/humid or forecast heat is present, quality sessions convert to **effort-capped** and pace targets are suppressed; `range` on the heat flag thresholds is environment-specific and left unset in v1.
- `→ rule: heuristics/context.yaml#altitude_mode` — above the user's recorded altitude, replace pace targets with effort bands and disable PB-oriented language.
- `→ rule: heuristics/progression.yaml#progression_rate_by_age` — a single multiplier applied to volume ramp, `range 0.5–1.0` (1.0 default; ≤50 y default 0.75–1.0 based on the user's own tolerance evidence). This is the *only* age-based adjustment in v1.
- `→ rule: heuristics/medical-flags.yaml#hr_zones_invalid` — set by medication/condition flags; when true, all HR-derived auto-adjustments are switched off and RPE/pace-by-effort is used.
- `→ rule: heuristics/medical-flags.yaml#pregnancy_postpartum_lock` — no race-goal scheduling, no interval loading, and no intensity-increasing review action without a recorded clearance acknowledgement; only subtractive edits allowed.
- `→ rule: heuristics/restart-after-layoff.yaml#detraining_bucket_es` — encode loss as buckets using [PHYS-S22]'s plateau (do not scale loss linearly past ~90 days), and gate hard sessions behind ≥2 weeks of continuous aerobic volume.
- `→ rule: heuristics/language-guardrails.yaml#no_demographic_stereotypes` — comments must not attribute performance to sex, age or cycle; refer to observed data and the user's context instead.
