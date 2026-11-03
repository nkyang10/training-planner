---
id: sig-acwr
title: Acute:chronic workload ratio — what it can and cannot decide
status: contested
confidence: high
evidence: [meta-analysis, cohort, review]
applies_to: [all users]
last_reviewed: 2026-11-03
owner: knowledge
supersedes: []
sources: [PHYS-S12, PHYS-S13, PHYS-S14, PHYS-S15, PHYS-S16, PHYS-S17, PHYS-S49, PHYS-S50]
---

## Key takeaways

- The ACWR ("acute ÷ chronic load", usually 7-day ÷ 28-day) is the most widely used and most heavily criticised derived metric in load research. Both positions are documented here, and the app's stance is explicit: **display and corroboration only — never a plan trigger on its own.**
- The popular "sweet spot 0.8–1.3" comes from a *hypothesis-generating* line of work and appears as a *trend* in one systematic review; it has never been shown to be causal, and the ratio's own methodology changes which sessions it flags.
- Two runner-relevant facts matter more than the ratio debate: **(a) different ACWR variants disagree about almost a third of sessions** [PHYS-S15], and **(b) in a real cohort most ACWR analyses found no association with injury/illness at all** [PHYS-S14].
- The safest actionable translation for an amateur is the plain one: **bound the relative change in weekly load, and bound the ratio of hard days** — both computable without a ratio.

## Definitions and formulas

```
acute_load   = mean(daily_load over A days)      # A ≈ 7
chronic_load = mean(daily_load over C days)      # C ≈ 28
ACWR_coupled   = acute_load / chronic_load                       # chronic includes the acute window
ACWR_uncoupled = acute_load / mean(daily_load over C days shifted before the acute window)
RA  (rolling average)   : simple means over A and C
EWMA                    : exponentially weighted means; time constant ≈ window/2
sACWR (smoothed)        : EWMA(acute) / EWMA(long, e.g. 30-42 d)
Weekly change (simple)  : (week_n_load − week_n−1_load) / week_n−1_load
Monotony                : mean(daily load) / SD(daily load)     # an alternative "spike" signal
```

| Variant | Behaviour |
|---|---|
| Rolling 7/28, coupled | smoothest, least sensitive to a single spike; discontinuous at 28-day boundaries |
| Rolling 7/28, uncoupled | removes mathematical coupling of numerator and denominator; more sensitive |
| EWMA 7/28 | reacts fast to spikes and to layoffs; small denominators after a break can produce absurd values |
| sACWR | dampens noise; requires a longer continuous history |

**Interpretation convention** (what the numbers mean arithmetically): `1.0` = recent load equals the long-term average; `1.5` = last week at 150% of baseline; `<0.8` = detraining relative to baseline. A value `>2` typically means the user did something unusual *or* had a quiet baseline — the ratio cannot tell which.

## Trust level

| Claim | Grade | Basis |
|---|---|---|
| ACWR is an accepted monitoring convention in team-sport practice | **C** | Gabbett's "injury prevention paradox" line of work and reviews [PHYS-S16, PHYS-S17] — hypothesis-generating, largely non-running |
| A 0.8–1.3 zone is associated with lower injury risk | **A, as a trend only** | Maupin et al. 2020 systematic review, *Open Access J Sports Med* 11:51-75, PMID 32158285 [PHYS-S13]: results *tended* toward lowest risk in 0.80–1.30, EWMA more sensitive than rolling 28-day; the authors flag "issues with the ACWR method that must be addressed before it is confidently used" |
| ACWR use reduces injury risk (causal) | **A, and negative** | Impellizzeri, Tenan, Kempton, Novak & Coutts 2020, *IJSPP* 15(6):907-13, PMID 32502973 [PHYS-S12]: no study estimated the causal effect; the ratio is inaccurate (numerator not normalised by its denominator), ambiguous, and not consistently unidirectionally related to injury; "no evidence supporting the use of the ACWR in training-load-management systems"; derived ratios "add noise and create statistical artefacts" |
| ACWR associations are sparse and method-dependent in real cohorts | **B** | Dalen-Lorentsen et al. 2021 [PHYS-S14]: 86 elite youth footballers, 105 days, 6,250 athlete-days, 196 health problems — of 108 analyses, only **23 (21%)** showed a significant association |
| ACWR variants disagree with each other in runners | **B** | Cloosterman et al. 2024 [PHYS-S15]: 430 recreational runners, 22,839 GPS sessions. Share of sessions flagged as a significant load increase — weekly-load change method **33.4%** (95% CI 32.8–34.0), coupled RA **16.2%** (15.7–16.6), uncoupled RA **25.8%** (25.3–26.4), EWMA **18.9%** (18.4–19.4); **43%** of the weekly-change flags differed from the coupled-RA and EWMA classifications |
| ACWR has a specific injury-protective cut-off for runners | **D** | no runner-specific validated threshold; vendor "safe zone" graphics are marketing |
| ACWR is valid for a user with <4 weeks of continuous data | **D** | the denominator is undefined/unstable; every variant degenerates |

**Overall stance**: grade **C as a display**, grade **D as a decision input**. The strongest *positive* source (Maupin) explicitly withholds confidence; the strongest *critical* source (Impellizzeri) is a grade-A meta-level critique. The app therefore treats ACWR the way the critical literature says is legitimate: a description of recent-vs-usual load, useful when it *agrees* with an independent signal.

## Facts

- **The denominators are fragile.** After a layoff, chronic load collapses, and the ratio spikes without any unusual absolute load. This is the most common false positive in practice and it is arithmetic, not physiology.
- **Sparsity** [PHYS-S14]: in a well-instrumented cohort the majority of tested ACWR–health associations were null. Users should not be told a spike "caused" anything.
- **Method disagreement is large** [PHYS-S15]: the same runner's history produces a materially different set of flagged sessions depending on the variant, so any dashboard claim must state the variant (and the app must pin it, like a counter version).
- **The confound is fundamental**: people who tolerate high load are both fitter and differently exposed; load and injury are jointly driven by competition exposure, contact, surface, sleep and history. Ratio arithmetic cannot separate these [PHYS-S12].
- For amateurs specifically: most injury-relevant information is already in **session class, spacing, and duration of the longest session**, and it is more actionable than a ratio.

## Practice

- Show the ACWR with its variant name and the absolute numbers beside it (acute and chronic load). A ratio without its numerator and denominator is uninterpretable — by design of the display, not by oversight.
- Treat a spike as **one** corroborating signal: an ACWR spike *plus* a hard-day-spacing violation *plus* a self-reported fatigue rise is a downgrade candidate. Alone, it is a caption.
- Suppress ACWR entirely (do not show a broken number) when: <28 days of continuous data, ≥3 missing days in the chronic window, or a load-counter change inside the window.
- Prefer these plain rules for amateurs: weekly load change bounded; ≥48 h between high-intensity days; longest session bounded relative to the 4-week maximum; hard days per week bounded.

## Controversies

- **ACWR as a management tool vs statistical artefact** — the two camps above, unresolved [PHYS-S49, PHYS-S50]. Stance: implement display + subtractive corroboration, and document the choice in an ADR because it is a product-defining, expensive-to-reverse decision.
- **EWMA vs rolling averages** — one review says EWMA is more sensitive [PHYS-S13]; the runner study shows the variants classify very differently [PHYS-S15]; and in the cohort where methodology was varied systematically the EWMA variant produced the **largest share of "significant" findings (44% of 108 analyses)** [PHYS-S14] — sensitivity and false-positive risk move together. Stance: pin `EWMA(7/28)` if shown, note the choice in the UI, and never mix variants inside a trend.
- **"The sweet spot"** — a genuinely useful communication device (progress gradually) that has hardened into a false precision. Stance: the app may say "your recent load is above your recent average"; it may not say "you are in the danger zone".
- **Is monotony a better spike metric?** Cheap and less fragile after layoffs; evidence weaker. Stance: display alongside, no rule.

## Worked examples — the same week, four variants

Illustrative arithmetic (load units as in `session-load-metrics.md`), built to show disagreement
rather than to claim a risk value. Chronic baseline in all rows: a stable 4-week pattern.

| Week pattern | Weekly-change rule (±10%) | Coupled RA 7/28 | Uncoupled RA 7/28 | EWMA 7/28 | Consensus? |
|---|---|---|---|---|---|
| Stable 40 / 41 / 39 / 40 | no flag | ~1.00 | ~1.00 | ~1.00 | yes — nothing to say |
| Planned step up 40 → 46 (+15%) | **flag** | ~1.10 | ~1.15 | ~1.13 | only the change rule fires |
| Two hard days added, total +8% | no flag | ~1.12 | ~1.16 | ~1.15 | the ratio "sees" what the change rule misses |
| Post-race deload 40 → 24 (−40%) | **flag** | ~0.72 | ~0.68 | ~0.80 | flag fires, but as a *recovery* week — a planned reduction is not a risk signal |
| Illness week: 3 easy days, then resume | no flag | ~0.65 | ~0.62 | ~0.72 | no flag on load, yet the highest-need week for a downgrade |

Read as evidence for the guardrail, not as a rule: the variants disagree on which weeks matter, and
the week with the lowest ratio is arguably the one where a plan should be most conservative.

## Display copy: permitted and forbidden

- Permitted: "your load this week was 15% above the last four weeks", "the ratio shown here is a
  description, not a prediction", "one signal is not enough to change your plan".
- Forbidden: "you are in the injury zone", "this spike caused your knee pain", "keep the ratio under
  1.3 or you will get hurt", any colour coding that reads as a traffic light without a corroborating
  signal.
- When a corroboration exists, the comment names both signals and the action's **subtraction** nature:
  "because the interval session was missed twice and load jumped 15%, the extra strides this week are
  dropped". Nothing is ever added.

## Series versioning

- The ACWR number is a **derived** value: changing the variant, the window, the missing-day policy or
  the load counter changes the entire historical curve, so every series carries `series_version`.
- On migration, recompute from the stored session facts, keep the previous version's values for a
  year for audit, and never display a pre/post comparison across versions in the same chart.
- Because recomputation must be exact, the ratio is produced by the same pure function as the plan
  (no third-party charting maths in the pipeline); a chart may only visualise the stored value.

## Engine implications

The ratio is a description; the weekly change is the guard.

- `→ rule: heuristics/acwr.yaml#display_only` — default `true`; the ACWR value may appear in the fact object given to the comment generator but **must not be an input to any planner branch**.
- `→ rule: heuristics/acwr.yaml#variant` — `ewma_7_28`, one of `[ewma_7_28, ra_7_28_coupled, ra_7_28_uncoupled]`, pinned per user with a `series_version`.
- `→ rule: heuristics/acwr.yaml#min_history_days` — 28, `range 14–56`; below it, return `null` (not a default) and hide the widget.
- `→ rule: heuristics/acwr.yaml#corroboration_required` — a load-related downgrade needs ≥1 independent signal (spacing violation, RPE rise, session failure, missed-day streak) in addition to the ratio; `range 1–3`.
- `→ rule: heuristics/load.yaml#weekly_change_max_pct` — the primary guard: default 10%, `range 5–15`; this replaces ACWR as the actionable quantity.
- `→ rule: heuristics/safety-hard-stops.yaml#no_ratio_only_edits` — build-time check: any planner rule whose only trigger is a derived ratio (ACWR, form, readiness composite) is rejected.
