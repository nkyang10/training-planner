---
id: sig-hrv-wellness
title: HRV, resting HR and wellness scores
status: curated
confidence: medium
evidence: [meta-analysis, cohort, review, vendor]
applies_to: [all users with overnight or morning measures]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S18, PHYS-S19, PHYS-S20, PHYS-S21]
---

## Key takeaways

- Nightly lnRMSSD is the best short-term readiness signal available to a consumer app, and it is **weak, slow and person-specific**: use it as a *downgrade* signal with corroboration, never as a green light to add intensity.
- Direction is not interpretation. In meta-analysis, **both training success and overreaching raise vagal HRV indices** — an increase cannot by itself mean "recovered" [PHYS-S19].
- Baselines must be **individual and longitudinally averaged** (weeks), because alcohol, illness, heat, sleep loss and menstrual cycle move nightly HRV more than one training day does [PHYS-S20].
- Wellness/RPE questionnaires carry independent information and cost nothing to collect. HRV and wellness agree with each other *poorly*; that is expected, and both should be kept.
- Device-derived HRV is a black box. Grade the *metric* B and the *device pipeline* D: the app stores which device produced each value.

## Definitions and formulas

| Term | Definition | Notes |
|---|---|---|
| RMSSD | root mean square of successive differences between normal R–R intervals (ms) | parasympathetic-vagal index; the field standard |
| **lnRMSSD** | `ln(RMSSD)` | log transform stabilises variance; analyses use the log value |
| rMSSD CV | `SD(lnRMSSD window) / mean(lnRMSSD window)` | the "stability" index used in coaching practice |
| SDNN | SD of all normal R–R intervals (ms) | mixed autonomic + respiratory; not comparable across breathing conditions |
| HF power | spectral power ~0.4–1.5 Hz (ms²) | respiration-dependent; lab-only in practice |
| HRrest | overnight minimum or 5th-percentile HR, or supine resting HR | the *overnight minimum* is the least behaviour-contaminated |
| 7-day rolling mean | `mean(ln value over 7 days)` | the shortest defensible window; 14/28-day for baselines |
| Z-score / deviation | `(today − baseline_mean) / baseline_SD` | needs ≥14–28 baseline days; a "day 1" z-score is meaningless |
| Wellness index | sum/mean of 4–6 self-rated items (fatigue, soreness, stress, sleep quality, mood) | e.g. Hooper-style index; arbitrary units |

**Measurement protocol matters more than the index.** Compare like with like: same body position, same time of day, ≥5 min rest, artefact-filtered. Supine-5-min, orthostatic and nightly values are different metrics that share a name.

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| HRV trends track training status longitudinally (↑ with adaptation, ↓ with loss of freshness) and need individual baselines | **B** | Plews, Laursen, Stanley, Buchheit 2013, *Sports Med* 43(9):773-81, PMID 23852425 [PHYS-S18] — training-camp, elite endurance athletes; proposes appropriate averaging windows and the individual "fingerprint" |
| Vagal HRV indices rise with performance gains | **A** | Bellenger et al. 2016, *Sports Med* 46(10):1461-86, PMID 26888648 [PHYS-S19] — 5,377 records screened, 27 studies / 24 meta-analysed: resting RMSSD SMD **0.58**, HF **0.55**, post-exercise RMSSD **0.60**, HRR **0.63** when performance increased |
| …and the same indices also rise with overreaching | **A** (the guardrail) | same meta-analysis [PHYS-S19]: with performance *decreases*, resting RMSSD still rose (SMD **0.26**, trivial; resting HF **0.04** ns, SD1 **0.04** ns), post-exercise RMSSD **0.64**, HRR **0.46**; authors conclude additional measures of training tolerance are required, and that HR acceleration (SMD **−0.48**) is the parameter that fell with overreaching |
| Large-scale free-living HRV/RHR responds to training, alcohol, illness, menstrual cycle | **B** | Altini & Plews 2021, *Sensors* 21(23):7932, PMID 34883936 [PHYS-S20] — **28,175 individuals, ~9 million overnight recordings** over 5 years (~320 ± 374 per person); observational, consumer devices |
| Consumer/portable devices measure HRV accurately | **A for the question, cautious for the answer** | Dobbs et al. 2019, *Sports Med* 49(3):417-435, PMID 30706234 [PHYS-S21] — meta-analysis of portable-device HRV criterion validity; accuracy is device- and condition-dependent (no single number re-derived here) |
| HRV-guided periodisation outperforms planned periodisation | **B, non-running-biased** | small RCTs/reviews; effects are inconsistent and protocols differ; the app does not implement HRV-guided *progression*, only HRV-informed *downgrades* (`confidence: medium`) |
| Nightly HRV alone can decide today's session | **D** | no validation; contradicted by the two-direction problem above [PHYS-S19] |
| A single night's HRV/RHR means anything | **D** | day-to-day noise is large; lnRMSSD day-to-day CV is commonly on the order of **10–30%** (`confidence: medium`, coaching literature) |
| "Readiness" composites (sleep + HRV + RHR + load) | **D** | vendor models, unpublished weights |

## Facts

- The practical reading of Bellenger's meta-analysis [PHYS-S19]: HRV change is a **non-specific** marker of physiological adaptation. Resting HRV is largely unaffected by overreaching, so "my HRV is normal" does not exclude accumulated fatigue.
- Averaging window is part of the method, not a detail: short windows (3–7 d) capture fatigue/freshness, long windows (28 d+) capture adaptation. A 1-day value mixes both and separates neither [PHYS-S18].
- Elite/near-elite athletes show a **ceiling** in HRV adaptation — further fitness gains produce little further HRV change [PHYS-S18]. So an athlete whose HRV has "flatlined" is not necessarily stale.
- Non-training confounders dominate single nights in the largest dataset available [PHYS-S20]: alcohol produces some of the largest HRV depressions and RHR elevations seen in free-living data; illness, heat, sleep restriction and (for some users) menstrual cycle phase do the same.
- Consumer overnight devices have systematic error and coverage gaps (strap/wrist contact, night-to-night wear time). Require a minimum valid-data fraction per night before a value enters a baseline.
- Wellness ratings correlate **weakly** with HRV at the individual level; a user reporting high fatigue with normal HRV is not "wrong", and vice versa [PHYS-S18 practice discussion; `confidence: medium`].
- Wellness questionnaires are the only channel that sees life stress, and life stress is one of the strongest predictors of a bad session.

## Practice

- Collect nightly HRV/RHR passively; ask the 4-item wellness check (sleep quality, fatigue, soreness, life stress) once per day at a fixed time, ≤20 seconds.
- Build baselines over **≥14 days** (prefer 28) and compare with z-scores or % deviation against *that* baseline; label the baseline window in the UI.
- Reading rule of thumb: **one bad night = weather; three bad nights in a rolling 7 = signal; a rising 7-day mean with declining performance = re-evaluate the plan.**
- When HRV and the user's own reported feeling disagree, trust the reported feeling for today's session and the trend for the plan.
- Never convert HRV into a diagnosis, a recovery percentage, or a calorie/energy statement.

## Controversies

- **HRV-guided training** — some trials show better performance outcomes than pre-planned training; effect sizes are small, trials are short, mostly non-running, and they used *supervised* protocols with expert interpretation. Stance: HRV may justify **subtraction**; it never justifies addition.
- **Which index** (lnRMSSD vs SDNN vs HF vs vendor composites) — for nightly short recordings lnRMSSD is the pragmatic field standard; longer/controlled recordings change the ranking. Stance: pin lnRMSSD, ignore the rest unless the device only offers a composite (then grade D).
- **Supine vs nocturnal** — nocturnal has better ecological validity and less behavioural contamination; supine has better comparability with the literature. Stance: use nocturnal by default, do not mix.
- **Is a readiness score worth shipping?** Display yes, decision no; and the composite must be decomposable so the comment can say *which* input moved.

## Escalate to a clinician

- Persistently elevated resting HR (e.g. >15% above the user's own 28-day baseline for >7 days) with fever, chest symptoms, or unexplained illness → clinician.
- Detected irregular rhythm / atrial-fibrillation notification from a consumer device → clinician; the app pauses HR-based rules for that user and never interprets the rhythm itself.
- HRV/RHR patterns alongside unintended weight loss, prolonged fatigue or mood change → clinician; the app does not diagnose overtraining syndrome, which is a diagnosis of exclusion.

## Worked examples — baselines, validity and triggers

| Night / week | Data | Engine handling |
|---|---|---|
| Single night lnRMSSD 62 → 48 (z −1.4) | valid-night share 91% | **No action.** One night inside a signal with 10–30% weekly CV; log and move on [PHYS-S20] |
| 3 of the last 7 nights at z ≤ −0.5, no confounds entered | valid nights ≥60% | Trigger: offer to move one quality session later in the week. Never add intensity |
| 4 of 7 nights low, user flags "cold" | confound set | Downgrade the week's intensity ceiling and say why; no recovery claims |
| Night with 45% valid samples | below the 60% default | Excluded from the baseline window; shown as "not enough data", not as a low score |
| 28-night window with a 10-day gap (travel) | 18 valid nights | Window still usable but flagged; short-window (7 d) comparison suppressed |
| Wellness scores 2/5 sleep, 4/5 legs, 4/5 mood, 1/5 motivation | single day | Below `min_confirmations` → no plan effect; reflected only in tone |
| Same scores 3 days running | 3 confirmations | Session **placement** may shift; intensity stays as planned unless a hard stop applies |

## Confound inventory

| Confound | Typical direction on HRV/RHR | Action |
|---|---|---|
| Alcohol | lowers lnRMSSD, raises RHR, worst in the first night | suppress readiness interpretation for that night |
| Febrile illness / infection | large sustained drop, elevated RHR | hard-stop class: no intensity; clinician referral if fever persists |
| Heat and humidity | lower lnRMSSD, higher RHR during sleep | context flag; do not interpret as deconditioning |
| Sleep restriction | variable, often modest at one night | note only, unless repeated |
| Menstrual cycle phase | luteal: lower lnRMSSD, higher RHR on average | population-level caveat, never an individual judgement |
| Altitude | lower lnRMSSD early, RHR up | context mode overrides readiness interpretation |
| Over-reaching block | sustained suppression across a hard block | expected — which is why a lone low value cannot justify a change |

## Morning card: permitted language

- "Your readings are below your usual range" (observed, dated, reversible) — never "your recovery is
  42%", never a percentage of anything.
- If data are missing or invalid, the card says so in plain words and does not fill the gap with a
  model estimate.
- When a trigger fires, the card offers **one** concrete, subtractive option and states the reason;
  it never lists symptoms, guesses a cause, or mentions weight, appetite or calorie intake.

## Engine implications

Readiness signals may move a session; they never change its intensity and never name a cause.

- `→ rule: heuristics/readiness.yaml#primary_index` — `lnRMSSD_nocturnal`; store `device_id` and `valid_fraction` per night; discard nights with `valid_fraction` below a threshold (`→ rule: heuristics/readiness.yaml#min_valid_night_pct` — 60, `range 40–80`).
- `→ rule: heuristics/readiness.yaml#baseline_window_days` — 28, `range 14–60`; `→ rule: heuristics/readiness.yaml#short_window_days` — 7, `range 3–14`.
- `→ rule: heuristics/readiness.yaml#trigger_consecutive_days` — 3 abnormal nights within 7 before any downgrade, `range 1–5`; abnormal = deviation beyond `range`-clamped z of **−0.5** for lnRMSSD (a decrease) or +0.5 for RHR.
- `→ rule: heuristics/readiness.yaml#direction_policy` — a *rising* HRV never unlocks additional intensity [PHYS-S19]; only decreases (with corroboration) may downgrade. Encode as `can_add_intensity: false`.
- `→ rule: heuristics/readiness.yaml#confound_flags` — `alcohol`, `illness`, `poor_sleep`, `heat`, `travel`, `menstrual` (user-supplied, never inferred) suppress the downgrade for that day and annotate the series rather than deleting points.
- `→ rule: heuristics/wellness.yaml#instrument` — 4 fixed items, 1–5 scale, `sum` or `mean`; wellness-only downgrades allowed (no device needed) with `→ rule: heuristics/wellness.yaml#min_confirmations` = 2 days, `range 1–3`.
- `→ rule: heuristics/language-guardrails.yaml#no_recovery_percentage` — the app never outputs "recovery 43%", a readiness diagnosis, or any statement implying HRV measures tissue healing.
