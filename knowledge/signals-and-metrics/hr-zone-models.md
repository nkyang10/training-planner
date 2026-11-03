---
id: sig-hr-zones
title: Heart-rate zone models
status: curated
confidence: high
evidence: [meta-analysis, cohort, review, vendor]
applies_to: [all users with usable heart-rate data]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S1, PHYS-S2, PHYS-S3, PHYS-S4, PHYS-S30]
---

## Key takeaways

- HR zones are **the most-used and most-mis-specified** signal in consumer running. Their entire validity rests on one number — HRmax — whose individual error is **9–11 bpm** in the largest runner-specific validation [PHYS-S4].
- Two structurally different zone families exist and are **not interchangeable**: %HRmax zones and heart-rate-reserve (Karvonen) zones. The same percentage means a different intensity in each.
- The safe operating mode for this app: zones are **display and classification**, they may justify a *downgrade*, and they must be re-derived from the user's own data before they justify anything else.
- Wrist optical HR at a standstill or during a steady run is broadly usable; during intervals and in cold/dark conditions it produces dropouts and artefacts large enough to corrupt any zone statistic. Treat the *device* as grade D even when the *model* is grade A.

## Definitions and formulas

| Term | Formula | Notes |
|---|---|---|
| HRmax | highest recorded HR (gold standard: supervised maximal or CPET test) | Age predictions: **208 − 0.7·age** [PHYS-S1]; **211 − 0.64·age** [PHYS-S2]; **206 − 0.88·age** in women [PHYS-S3] |
| HRR (heart-rate reserve) | `HRR = HRmax − HRrest` | Used by Karvonen |
| Karvonen target HR | `HRrest + %HRR · (HRmax − HRrest)` | A 70% HRR target is **not** 70% HRmax |
| %HRmax zone | `HR = % · HRmax` | Simple, and shifts if HRrest changes |
| Zone width | `width = (upper% − lower%) · HRR` | Zone width in bpm is the practical resolution limit |
| Zone drift | HR rise at fixed effort within a session | see `signals/decoupling-and-field-tests.md` |

### Common zone architectures (shapes, not constants)

| Model | Bands | Anchor convention |
|---|---|---|
| 5-zone %HRmax | Z1 <60 · Z2 60–70 · Z3 70–80 · Z4 80–90 · Z5 >90 | consumer default |
| 5-zone Karvonen | Z1 50–60 · Z2 60–70 · Z3 70–80 · Z4 80–90 · Z5 90–100 %HRR | coaching default |
| 3-zone (severe domain) | below LT₁ / LT₁–LT₂ / above LT₂ | matches physiology best; needs a threshold, not an age |
| 7-zone | splits Z1 and Z2 for recovery vs aerobic | marketing-driven; boundaries unvalidated |

A 5-zone model with 10-percentage-point bands and HRR ≈ 100 bpm gives **≈10 bpm per zone** — the same magnitude as the error in HRmax itself [PHYS-S2, PHYS-S4]. That single arithmetic fact is why zone boundaries must never be treated as precise.

### Lactate-anchored zones (reference shape)

The physiologically anchored version places zone boundaries at LT₁ and LT₂, so "zone 2 = below LT₁" and "zone 4 = LT₂ to just above". This is what the 3-zone model approximates. Without a lab, field tests (`signals/decoupling-and-field-tests.md`) are the only honest way to place these boundaries — an age-based estimate cannot.

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| Age-predicted HRmax is a *population* trend | **A** | Tanaka meta-analysis, 351 studies / 18,712 subjects [PHYS-S1] |
| Age-predicted HRmax is accurate for an individual runner | **B, and negative** | Nes SEE **10.8 bpm** [PHYS-S2]; Kasiak **RMSE 9.1–10.5 bpm**, 9/13 equations biased [PHYS-S4] |
| Female-specific equation improves population fit | **B** | Gulati, 5,437 women, protocol-limited clinical sample [PHYS-S3] |
| %HRR and %HRmax zones are interchangeable | **D** | vendor/consumer conflation; arithmetically false |
| 5-zone boundaries match metabolic boundaries | **C** | consensus shape only; boundary values not validated in free-living runners |
| Optical wrist HR is accurate | **C→D** | device-dependent; validated mainly for steady-state, chest-strap comparisons [PHYS-S30] |
| A device's "zone minutes" are a training dose | **D** | depends on the device's HRmax setting; a wrong setting silently redistributes minutes between zones |

**Standing caveat**: HR-derived metrics are invalid for users on rate-modifying medication, for many arrhythmias, and for chest-strap failures/wrist artefacts. Invalidity must be a *state*, not a warning banner (`physiology/demographics-and-context.md`).

## Facts

- Measured HRmax in the runner cohort: **184.6 ± 9.8 bpm** (n = 4,043) [PHYS-S4] — the spread across people is roughly as large as the average error of the equations.
- 8 of 13 equations in that validation **overestimated** HRmax [PHYS-S4]. An overestimated HRmax makes zones too permissive: easy runs drift into zone 3–4, and the user accumulates "aerobic" volume that is not aerobic.
- 220 − age additionally **underestimates** HRmax in older adults relative to the Tanaka fit [PHYS-S1]; it should not be the default in 2026.
- Resting HR enters Karvonen zones, so an ill or heat-stressed user's zones move without any change in fitness.
- Evidence-based usage is longitudinal: HR-at-fixed-pace trends over weeks are informative; a single session's zone pie is not.

## Practice

- Derive HRmax in this order: supervised field test (with warm-up and a finishing 2–3 min surge) → highest HR seen in a hard race/session (raises the floor) → age equation (labelled as an estimate in the UI).
- After setting zones, check them against behaviour: a "zone 2" run the user cannot hold a conversation through means the boundary is wrong, not the user.
- For users with no reliable HR (medication, artefacts): switch to 3-zone effort/RPE bands; do not silently keep using stale zones.
- Recompute zones no more than **monthly** unless new evidence of HRmax arrives (a higher observed HR), to avoid a plan that re-bands every week on noise.

## Controversies

- **Nasal-breathing / "zone 2 only" coaching** — the underlying discipline (keep aerobic work aerobic) is sound; the claim that most amateurs should do almost nothing else is not supported for performance goals. Stance: enforce a floor on aerobic share, not a ban on intensity.
- **The MAF / 180−age formula** (grade D) — no external validation at the individual level; treat exactly like an HRmax equation, and note its error is compounded because it prescribes a single ceiling.
- **7-zone and "colour-coded" proprietary zone systems** — vendor constructs, grade D: display only.
- **Should zones come from lactate or ventilatory thresholds?** Correct in principle; the practical answer is field proxies with stated uncertainty.

## Worked examples — why the two models are not interchangeable

Same runner: HRmax 190 (measured), HRrest 45, so heart-rate reserve = 145. "85%" means two different
numbers, and the gap grows with resting HR.

| Zone | Karvonen (%HRR 55/65/75/85/95) | Plain %HRmax (60/70/80/90) | Gap at the boundary |
|---|---|---|---|
| Z1 | 125–139 | 114–133 | ~11 bpm |
| Z2 | 139–154 | 133–152 | ~6 bpm |
| Z3 | 154–168 | 152–171 | ~2–3 bpm, different width |
| Z4 | 168–183 | 171–190 | ~3–7 bpm |
| "85% HRmax" as a target | 168 (that is 85% **HRR**) | 162 | **6 bpm**, and 8.5 bpm if HRrest is 60 |

Consequences the engine must respect: a session imported from a platform that bands by %HRR cannot be
re-labelled with %HRmax zones; a user who changes devices often has two zone histories that look like
a sudden fitness change and are actually a model change.

## Rebanding protocol

1. Ask for the **source**: measured HRmax (race peak, supervised test) or an equation. Record which.
2. If the source is an equation, keep the ±7–11 bpm uncertainty in the zone description and require a
   change of >5 bpm before touching any zone boundary.
3. A session peak HR may raise the HRmax floor, but only from a session that is maximal in structure
   (a finish sprint, a race) and has <10% dropped samples — artefact spikes are not evidence.
4. Write the change to history with `old_value`, `new_value`, `source`, `date`. Zones derived from
   the old value stay as they were recorded; never re-colour past sessions.
5. If HRrest changes by ≥5 bpm persistently, re-derive Karvonen boundaries — but check illness,
   heat, alcohol and sleep first, because those move HRrest more often than fitness does.

## Sensor reality and the data-quality gate

- Optical wrist readings lag by seconds and smear interval peaks: acceptable for steady aerobic
  sessions, not for 3-minute intervals. A session's zone classification is only as good as this.
- Cadence lock (the HR trace latching onto step rate) inflates zone-4/5 minutes on easy days. The
  symptom is a near-perfectly periodic HR series at an implausible value; such sessions fail the
  quality gate.
- Gate arithmetic: with >25% of samples missing or implausible (HR <30 or >230 bpm), exclude the
  session from every HR-derived series — load, decoupling, zone distribution, readiness — but keep
  the activity itself, its duration and its perceived effort.
- Where a strap and a watch disagree by >8 bpm on the same steady run, trust the strap, log the
  discrepancy, and prefer the **lower** intensity interpretation if a session upgrade is on the table.

## Engine implications

Zones are a display convention with an error bar, not a physiological boundary.

- `→ rule: heuristics/hrmax.yaml#prediction_default` — Tanaka 208−0.7·age as fallback only; store `hrmax_source` and `hrmax_confidence` with every value.
- `→ rule: heuristics/zones.yaml#model` — one of `pct_hrmax | karvonen | three_zone_effort`; never mix in one user's history. A model switch requires an explicit migration note (it changes the meaning of past zone minutes).
- `→ rule: heuristics/zones.yaml#min_reband_bpm` — 5, `range 2–10`; below that, keep the old boundaries.
- `→ rule: heuristics/zones.yaml#hard_session_zone_floor` — a session labelled "easy" whose median HR exceeds 85% HRmax for ≥10 min is flagged (illness/heat/overreaching signal) → **downgrade only**.
- `→ rule: heuristics/zones.yaml#data_quality_gate` — if >25% of a session's samples are missing or implausible (HR > 220, HR < 30, or physiologically impossible jumps), exclude that session from every derived metric and mark it, rather than imputing.
- `→ rule: heuristics/language-guardrails.yaml#zone_uncertainty_disclosure` — when zones come from an age equation, the comment must say they are estimated and may be off by ~10 bpm.
