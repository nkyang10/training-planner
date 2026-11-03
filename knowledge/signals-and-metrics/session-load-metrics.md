---
id: sig-session-load
title: Session-load metrics — TRIMP, sRPE and friends
status: contested
confidence: medium
evidence: [meta-analysis, rct, cohort, review, vendor]
applies_to: [all users]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S5, PHYS-S6, PHYS-S7, PHYS-S8, PHYS-S9, PHYS-S10, PHYS-S11, PHYS-S29]
---

## Key takeaways

- There is **one honest fact** about session load: it is an *arbitrary-unit score chosen by convention*, not a physiological quantity. TRIMP, sRPE load, zone-minute load and "training load" are different scales that are not comparable to each other, across users, or across devices.
- Session load has a **noise floor around 10–12%** (typical error of TRIMP test–retest ≈ **12.2%** [PHYS-S9]) — a 10% week-to-week change in load is partly arithmetic.
- Interval sessions are systematically **under-scored** by HR-derived load, because the HR-based weighting is calibrated on continuous exercise [PHYS-S8]. Any rule keyed to "load" mis-scores the week that contains intervals.
- sRPE load is the most robust metric for a recreational user (needs no device, tracks the *experienced* dose) and the least comparable between users.
- Cross-metric divergence is real and measurable: in runners, perceptual, physiological and biomechanical load measures disagree within the same session [PHYS-S29]. Do not average them into one number.

## Definitions and formulas

| Metric | Formula | Inputs | Units |
|---|---|---|---|
| **TRIMP (linear, Banister)** [PHYS-S5] | `Σ over bands (band_duration_min · ΔHR_ratio · weighting)` where `ΔHR_ratio = (HR_band − HRrest)/(HRmax − HRrest)` | HR stream, HRrest, HRmax | AU |
| **TRIMP (exponential / "modified", Stagno)** [PHYS-S7] | `TRIMP_MOD = t · ΔHR · 0.64 · e^{b·ΔHR}` with `b = 1.92` (men) / `1.67` (women) as commonly reproduced | mean HR, HRrest, HRmax, duration | AU |
| **Zone-minute load (Edwards-style)** | `Σ (minutes in band × band_weight)`; classic weights 1–5 by %HRmax band (e.g. <70 = 1, 70–80 = 2, 80–90 = 3, ≥90 = 4/5) | HR stream | AU |
| **Banded load (Muñoz-type)** | weight 1/2/3 for <65/65–75/75–85% HRmax, 4 for 85–88%, 5 for >88% | HR stream | AU |
| **sRPE load (session-RPE)** [PHYS-S10] | `load_AU = sRPE (Borg CR-10) × duration_min` | 10-min-delayed user rating | AU |
| **Monotony** [PHYS-S11] | `mean(daily session load) / SD(daily session load)` | weekly loads | ratio |
| **Strain** [PHYS-S11] | `Σ weekly load × monotony` | weekly loads | AU |
| **Weekly load** | `Σ session load` over ISO week | sessions | AU |
| **Running "TSS-style"** | vendor normalised-gradient-speed formulation, typically `100 · (IF² · hours)` | power/speed stream | AU (vendor) |

**Reproducibility caveat on the exponential constants**: the `0.64` and `1.67/1.92` coefficients are widely reproduced in the literature and are attributed to Banister's group, but the primary record was not abstract-verified in this pass (`confidence: medium`). Verify before hard-coding; wrap them in knobs with a `range`.

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| Quantified training impulse predicts performance change in running | **B** | Morton, Fitz-Clarke & Banister 1990, J Appl Physiol 69(3):1171-7, PMID 2246166 [PHYS-S6] — small, motivated sample |
| Exponential (modified) TRIMP tracks season adaptation | **B** | Stagno, Thatcher & van Someren 2007, J Sports Sci 25(6):629-34, PMID 17454529, n = 8 field hockey [PHYS-S7] |
| HR-derived TRIMP **under-weights** intermittent sessions | **B** | Akubat & Abt 2011, J Sci Med Sport 14(3):249-53, PMID 21237707 [PHYS-S8] — lactate and ΔHR relations differ between continuous and intermittent protocols |
| Session-load test–retest typical error ≈ **12.2%** | **B** | Ulmer et al. 2019, Biol Sport 36(2):191-4, PMID 31223197 (ice hockey) [PHYS-S9]; treat as the generic noise floor, non-running |
| sRPE load is a valid whole-body session dose | **B** | Foster et al. 1996, Wis Med J 95(6):370-4, PMID 8693756 [PHYS-S10] — origin study, small; replicated widely in team sports, weakly in running |
| sRPE load ≈ physiological load in runners | **B, and negative** | runner study of perceptual vs physiological vs biomechanical load divergence (2026, open access) [PHYS-S29] |
| Monotony/strain predict illness or injury | **C** | Foster et al. [PHYS-S11]; the cut-points (~1.5–2.0) are practitioner conventions |
| Device "Training Load / Effect" numbers are a dose scale | **D** | vendor black box (EPOC/TE models); no external validation at the individual level |
| Load numbers are comparable between users or devices | **D** | false by construction (different HRmax settings, different constants) |

**Overall stance**: session load is a *bookkeeping* layer. Grade B for structure, grade D for any absolute number. It is legitimate for describing what happened and for relative within-user week-to-week comparison (same device, same HRmax setting, same metric).

## Facts

- The three families answer different questions: HR-based ≈ "how stressed was the cardiovascular system", sRPE ≈ "how hard was it for this person", speed/biomechanical ≈ "how much mechanical work was done". A plan needs all three *descriptions*, but only one *counter*.
- sRPE must be collected **≥10 minutes after the session**, otherwise warm-up/cool-down contamination biases it [PHYS-S10 practice convention]. The app's feedback form should enforce this delay in its design (or ask at the next natural interaction).
- HR-based load inherits every HRmax error documented in `signals/hr-zone-models.md`: an overestimated HRmax shifts minutes into lower bands and **deflates load**. Two users can log identical runs with a 30% load difference purely from HRmax settings.
- sRPE load correlates with duration more than with intensity for recreational users, because amateurs are poor at rating intensity and good at remembering long runs.
- Monotony/strain are cheap, device-free and useful: a week with three hard days and no genuine easy day has high monotony regardless of the load scale used.

## Practice

- Pick **one** primary counter per user (sRPE load when ratings exist; otherwise zone-minute or exponential TRIMP) and never mix counters inside one trend. Record which counter generated a stored value.
- Freeze the counter's inputs: changing HRmax or switching device changes the counter's scale, and history becomes non-comparable — annotate, don't silently rescale.
- Use weekly load change (relative %) as the actionable summary, and treat absolute AU values as unprintable to the user except as a bar chart.
- For interval sessions, prefer sRPE load or add a per-session-class multiplier rather than trusting HR-based load.

## Controversies

- **Is any single-number load justified?** The impulse–response tradition requires one [PHYS-S5, PHYS-S6]; the critique literature (e.g. Impellizzeri et al. 2020 — see `signals/acute-chronic-workload.md`) argues the derived ratios add noise and artefacts. Stance: keep a single counter for bookkeeping, refuse to derive injury risk from it.
- **Training Effect (EPOC-based) as a dose** — physiologically interesting, individually unvalidated, and dependent on device-fitted V̇O₂max estimates: grade D.
- **Should easy days score ~0?** In exponential-load models easy days score very low, which inflates monotony for plan-healthy weeks. Stance: use linear-style weighting for monotony, exponential for dose, and never mix.

## Worked examples — one week, three counters

Illustrative arithmetic from the formulas above (not measured data), built to show why a series never
mixes counters. User: HRmax 180 (measured), HRR 60.

| Session | Content | Edwards-style band minutes | TRIMP (exp, male b = 1.92) | sRPE (CR-10 × min) | Comment |
|---|---|---|---|---|---|
| Tuesday | 40 min easy, HR ~68% HRmax | ~20 (zone 1–2) | ~15 | 3 × 40 = **120** | all three agree "small" |
| Wednesday | 6 × 3 min at ~92% HRmax, 90 s float | ~28 (zone 4–5) | ~85 | 7 × 33 = **231** | banding saturates: the exp-TRIMP separates it from Tuesday by ~5×, Edwards by ~1.4× |
| Saturday | 90 min long run, HR 74% | ~62 (zone 2–3) | ~55 | 4 × 90 = **360** | sRPE ranks this the biggest day; HR counters rank it below intervals |
| Sunday | 55 min easy + 8 × 20 s strides | ~35 | ~22 | 3 × 55 = **165** | strides contribute little to any HR counter but are a real neuromuscular stimulus |

The point is structural, not numerical: **the ranking of "hardest day" changes with the counter.**
A weekly total is therefore a statement about one measurement model, and a change in the model is a
series break, not a trend.

## Aggregation and missing-data rules

- A rest day is a **zero**, not a gap: dropping it inflates monotony and strain; leaving it null
  breaks the 7-day window definition. Choose zero and document it.
- A partial session (watch died at 12 of 40 min) is scored on recorded duration and flagged
  `partial`; if the missing portion exceeds half the planned duration, exclude the session from
  weekly counters and keep the plan fact intact.
- Cross-training enters the series only if the same counter can be computed honestly (HR available,
  modality artefacts understood). Otherwise log it as an activity without load.
- Double sessions are summed into one day for weekly totals but kept as separate sessions for
  session-level rules (hard-day gaps, decoupling eligibility).
- Weekly totals need ≥4 days of data to be compared with another week; below that, compare planned
  load, and say which one the number came from.

## Rounding, display, and change detection

- Display load as an integer with no units decoration; the unit ("arbitrary units") must appear once
  in the tooltip, because a load number that looks like a physical quantity invites over-reading.
- Only changes above the stored minimum detectable weekly change (default 15%, `range 10–25`) get
  comparative language ("more than last week"); anything smaller is displayed without comparison.
- Never show two counters as a ratio of each other, and never sum counters from different models into
  one "total load" figure — that is the mixing the counter-selection knob exists to prevent.

## Engine implications

One counter per user per series: the counter is part of the metric's identity.

- `→ rule: heuristics/load.yaml#primary_counter` — one of `[srpe, trimp_exp, zone_minutes]`; default `srpe` with fallback `zone_minutes`; store `counter_version` with each value.
- `→ rule: heuristics/load.yaml#trimp_coefficients` — `base 0.64 range 0.4–0.9`; `b_male 1.92 range 1.5–2.3`; `b_female 1.67 range 1.3–2.0` (**unverified primary source** — clamp to range and re-validate before any user-visible number depends on them).
- `→ rule: heuristics/load.yaml#min_detectable_weekly_change_pct` — 15 (≈1.5× the ~12% typical error [PHYS-S9]), `range 10–25`; smaller changes may not trigger any rule.
- `→ rule: heuristics/load.yaml#interval_correction` — sessions classified `interval` or `fartlek` use the sRPE counter if available [PHYS-S8]; otherwise mark the session `load_low_confidence`.
- `→ rule: heuristics/load.yaml#monotony_flag_range` — flag at >1.8, `range 1.4–2.5`; display + suggestion only.
- `→ rule: heuristics/load.yaml#cross_counter_mixing` — hard stop at build time: a trend or ratio whose inputs carry different `counter_version` values is rejected rather than averaged.
