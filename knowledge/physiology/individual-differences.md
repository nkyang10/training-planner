---
id: phys-individual-differences
title: Individual differences, responders and the noise floor
status: contested
confidence: medium
evidence: [meta-analysis, rct, cohort, review]
applies_to: [all users]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S1, PHYS-S2, PHYS-S3, PHYS-S4, PHYS-S9, PHYS-S20, PHYS-S35, PHYS-S36, PHYS-S37]
---

## Key takeaways

- Two positions are live in the literature and the planner must not pretend one is settled: **(a) people differ in how much adaptation a stimulus produces**, and **(b) a large share of apparent "non-response" is measurement noise and regression to the mean** [PHYS-S35, PHYS-S36, PHYS-S37]. Stance taken: assume the *user* is an outlier until their own data says otherwise, and require repeated evidence before calling anything a non-response.
- The biggest documented individual difference in running practice is **maximal heart rate at a given age**. Predicted HRmax carries an error of the same size as an entire training zone.
- The second biggest is **what a given session does to a given person**: same workout, different autonomic, muscular and motivational response. Any rule that fires on a single day's signal will misfire on a predictable subset of users.
- **Error propagation beats physiology** at recreational scale: if the plan change is smaller than the noise in the metric that triggered it, the change is not justified, regardless of how good the physiology story is.

## Facts

### Maximal heart rate: the measured spread (verified)

| Source | Population | Equation / finding | Residual error |
|---|---|---|---|
| Tanaka et al. 2001, *J Am Coll Cardiol* 37(1):153-6, PMID 11153730 [PHYS-S1] | meta of 351 studies / 492 groups / 18,712 subjects, 8–90 y | HRmax = **208 − 0.7·age** | ≈ ±7–11 bpm (`confidence: medium`, as reported in the source); correlation with age r ≈ −0.90; **no sex or fitness-level difference** |
| Nes et al. 2013, *Scand J Med Sci Sports* 23(6):697-704, PMID 22376273 [PHYS-S2] | HUNT cohort, n = 3,320 healthy adults | HRmax = **211 − 0.64·age** | **SEE 10.8 bpm**; no interaction with sex, BMI, activity level or V̇O₂max |
| Gulati et al. 2010, *Circulation* 122(2):130-7, PMID 20585008 [PHYS-S3] | 5,437 asymptomatic women (mean 52 ± 11 y), protocol-limited | peak HR = **206 − 0.88·age** | male-derived equations **overestimate** HRmax in women |
| Kasiak et al. 2023, *J Clin Med* 12(8):2884, PMID 37109218 [PHYS-S4] | **4,043 runners** (33.6 ± 8.1 y, 83.5% male) + 1,026 cyclists, CPET-measured | 13 published equations externally validated: **9 of 13 significantly biased**, 8 overestimating, bias up to ±4.9 bpm | **RMSE 9.1–10.5 bpm**, MAPE ≤4.7%; measured HRmax 184.6 ± 9.8 (runners) |

Consequence of a ±10 bpm error (planner arithmetic, not a study finding): with a 5-zone model whose zone-4 floor is 88% HRmax, an 180 vs 190 bpm true HRmax puts that boundary at 158 vs 167 bpm — the same run lands in different zones, and a user can be pushed into threshold work while believing they are aerobically building.

### Training response really does vary — and so does the noise

- Standardised training studies (notably the HERITAGE Family Study cohort work [PHYS-S35]) report **large inter-individual spread in V̇O₂max response to the same protocol**, with a small tail of very low responders and familial aggregation of both high and low response; heritability estimates for the V̇O₂max response are typically in the tens of percent (`confidence: medium` — narrative figures, not re-derived here).
- The counter-position [PHYS-S36, PHYS-S37]: once regression to the mean, day-to-day measurement error and repeated-testing effects are modelled properly, **most "non-responders" are not statistically special**. Reviews in this line argue that response classification requires control-group-based or randomisation-based methods (e.g. crossed-randomised designs) that most training studies lack.
- Both camps agree on the operational rule: a single pre/post comparison cannot distinguish "did not respond" from "was measured twice".
- Measurement noise floors that the planner must respect (typical error, `confidence: medium`, from field-test reliability literature — see `signals/decoupling-and-field-tests.md`): 5-k time trial **1–3%**; running threshold/speed estimates **2–5%**; overnight resting HR **±3–5 bpm** night-to-night; lnRMSSD night-to-night CV commonly **10–30%**; weekly training-load estimates **≈10–12%** typical error [PHYS-S9; see `signals/session-load-metrics.md`].
- Alcohol, illness, sleep loss, menstrual-cycle phase and heat produce single-day HR/HRV shifts that exceed the effect of one week of training in free-living data covering ~28,000 people and ~9 million overnight recordings [PHYS-S20].

### Other documented, planner-relevant differences

- **Fibre-type and economy** differ substantially between people with the same V̇O₂max; economy is the trainable part but responds to different stimuli in different people.
- **Absorbed-load asymmetry**: two users with identical sessions accumulate different fatigue because of body mass, sleep, work and history. No load metric fixes this; only per-user baselines do.
- **Age and sex** shift *ranges* of normal for HRmax and thermoregulation, but do not license "different training rules by default" (see `physiology/demographics-and-context.md`).
- **History is a strong predictor**: prior years of continuous training predict both current capacity and how quickly a plan can progress.

## Practice

- **Measure, then default, then verify.** Prefer one submaximal field protocol (see `signals/decoupling-and-field-tests.md`) over any age equation; if a field estimate is impossible, use Tanaka's equation as a starting default and label it in the UI as an estimate.
- Set per-user baselines over ≥14 days (resting HR, HRV, easy-run HR-at-pace, wellness) before any signal is allowed to influence the plan.
- Require **2–3 independent confirmations across ≥7 days** before concluding "this plan isn't working" or "this user responded".
- Keep a per-user audit of which signals were trusted that week; this is what makes a plan explainable months later.

## Controversies

- **Non-responders exist / are an artefact.** Both camps cited. Stance: the planner may say "your data so far shows little change", never "you are a non-responder"; and no plan mutation on a single pre/post pair.
- **Genetic/zone-type personalisation products** (grade D) claim to prescribe training from a few markers or a genotype panel. No support; never a plan input.
- **Should HR zones be built on ventilatory/lactate testing?** Correct in principle, unavailable in practice; field proxies inherit their error. Stance: expose the field estimate and its uncertainty instead of pretending precision.
- **Zone model choice (5-zone HR vs 3-zone vs power/speed zones)** changes what a session is *called* more than what it *does*; the contested part is the boundary placement, which is exactly where user-specific HRmax error lands.

## Worked examples — comparing a change against its own noise

The table is the operative rule: a change smaller than the row's floor is **not evidence**, and the
engine must behave accordingly (no reband, no pace change, no comment claiming improvement).

| Observed change | Noise floor for that metric | Correct engine read |
|---|---|---|
| 5-k time trial 24:10 → 23:40 (**−1.4%**) | 1–3% retest CV | Within noise. Retest only after ≥4–6 weeks, conditions matched [PHYS-S9] |
| Threshold pace 4:45 → 4:38 /km (**−2.5%**) | 2–5% field-test error | Plausible but unconfirmed: one more independent test ≥7 d later before rebanding |
| 7-day lnRMSSD −0.6 ln-ms | weekly CV 10–30% of the value | Borderline; needs 3 qualifying days within 7 and a confound check [PHYS-S20] |
| Resting HR 52 → 56 bpm (**+4**) | ±3–5 bpm night-to-night | Ambiguous. Default to "unknown", not "less recovered" |
| Weekly load 40 → 46 km (**+15%**) | ~12% typical error of the weekly sum | This clears the floor: treat as a real increase in exposure |
| Predicted HRmax 190 → 185 after a new equation | equation RMSE 9–10.5 bpm [PHYS-S2] | Do not shift zone borders; one measured session beats any equation |

## Individualisation the engine can actually run today

| Signal | What it personalises | Minimum data | Fallback when absent |
|---|---|---|---|
| Measured HRmax (test or race peak) | zone borders, TRIMP ΔHR | 1 maximal-effort session with plausible peak | predicted equation + explicit "predicted" label and wider bands |
| Resting HR baseline (28 d) | Karvonen reserve, readiness context | 14 valid nights | use population default and hide readiness entirely |
| Two similar-session HR–pace pairs | pace/HR band centre | 2 sessions ≥30 min, matched conditions | no band claim; keep prescribed pace from the race/test source |
| Wellness trend (4 items, 28 d) | session *placement*, never session intensity | 12 responses in 28 d | placement by calendar rules only |
| Race result ≤12 months old | current pace ladder | 1 finished race, known course | test-derived pace, else conservative effort-based sessions |
| Missed-day pattern | recovery-day insertion | 8 weeks of calendar | insert recovery day after every quality session |

Everything above is a **prior**, not a diagnosis: the engine personalises defaults, it never
attributes a cause to the person.

## Practice — responder-safe phrasing and audit

- Never write "you are a non-responder", "your body doesn't respond", or the inverse. Write about
  the **measurement**: "the change is smaller than the test can reliably detect".
- Every personalisation must record: `signal`, `value`, `baseline_window`, `n_observations`,
  `min_confirmations_met`, `noise_floor`. A plan should be replayable from that record alone
  (AGENTS.md rule 1).
- When two signals conflict (HR says hard, pace says easy), the engine reports the conflict in the
  comment and applies the **more conservative** session rule.
- Population defaults are allowed only as *starting* values, and the UI should label them once, at
  setup ("we start everyone from population averages and adjust to you").

## Boundary conditions

- The noise floors above come mostly from **group-level** laboratory studies, often not in
  recreational runners; they are order-of-magnitude guards, not certified values [PHYS-S9].
- New device, new strap, new watch firmware → treat as a **series break**: baselines do not carry
  over unexamined; re-establish windows before any signal drives a session change.
- Adolescents, pregnancy, and medication that alters heart rate (beta-blockers, some
  antidepressants) make HR-derived individualisation unusable — fall back to RPE/pace-on-flat and
  flag `hr_zones_invalid`.

## Engine implications

The planner must never treat a group mean as this user's constant.

- `→ rule: heuristics/individual-baselines.yaml#baseline_window_days` — 14–28, `range 7–60`; signals derived from shorter windows are display-only.
- `→ rule: heuristics/individual-baselines.yaml#min_confirmations` — 2 (hard-stop downgrades may use 1 when the trigger is a red-flag symptom), `range 1–4`, evaluated over ≥7 days.
- `→ rule: heuristics/hrmax.yaml#prediction_default` — `tanaka_208_0p7` as fallback only; `hrmax_source` priority = measured CPET > supervised field test > rolling session maximum > age equation; store the source with the value.
- `→ rule: heuristics/hrmax.yaml#session_max_observed_floor` — every observed session HR raises the user's HRmax floor (an observed 187 bpm is hard evidence against a 178 bpm estimate); `→ rule: heuristics/hrmax.yaml#min_change_bpm` — re-band zones only when the estimate moves by **>5 bpm**.
- `→ rule: heuristics/noise.yaml#min_effect_pct` — a metric change must exceed the stored noise floor for that metric before it may trigger a plan change; noise floors live in `signals/metric-catalog.md` and each has a `range`.
- `→ rule: heuristics/language-guardrails.yaml#no_responder_language` — the comment generator may not output deterministic-response claims ("you didn't respond", "your body doesn't adapt to X"); only observed-change statements with their window.
