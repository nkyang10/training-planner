# `knowledge/heuristics/` — the machine-readable rule layer

This is the only knowledge the planner reads at runtime. Everything else in `knowledge/` is for
humans and for provenance. If a number is not here, it cannot change a plan.

## The contract

```yaml
schema_version: 1
id: load-progression                     # = filename without extension
status: draft                            # draft | curated | contested | superseded
owner: fb-agent                          # who is accountable for the numbers
last_reviewed: 2026-11-03
provenance:                              # mandatory: prose + sources
  docs: [knowledge/plan-construction/mileage-and-progression.md]
  sources: [PLAN-S4, PLAN-S5]
applies_to: [all]                        # personas/contexts; safety files use [all] always
knobs:
  weekly_increment_pct:                  # a tunable number
    value: 8
    range: [3, 12]                       # MANDATORY — the engine clamps to this
    unit: percent-per-week
    confidence: medium                   # high | medium | low
    rationale: "≤50 km/wk recreational; the ceiling tightens with age and injury history"
    persona_overridable: true            # false ⇒ a profile or review may not raise it
rules:                                   # named rule groups (kebab-case ids)
  - id: down-week-required
    when: "week_index % step_cycle == 0 and phase not in [taper, race]"
    then: "target_weekly_km := round(prev_peak_km * down_week_pct/100, 1)"
    severity: constraint                 # constraint | warn | advise
    explain: "down-week"
```

Hard rules (from [../../AGENTS.md](../../AGENTS.md)):

1. **Every knob has `range`.** The engine clamps, and a property test asserts that clamped output can
   never exceed the range — so a typo cannot generate a 40 km threshold session.
2. **Knob ids are `snake_case`; rule ids are `kebab-case`.** Prose backlinks use
   `→ rule: heuristics/<file>.yaml#<id>` and a test asserts every backlink resolves.
3. `provenance.docs` must exist and be `curated` before `status: curated`. Until then the file is
   `draft` and the planner may load it **only** into a bundle whose hash says so.
4. **Safety files are subtract-only.** In `safety-hard-stops.yaml` every `then:` must be a removal,
   downgrade, or freeze; a diff that adds intensity fails validation. `persona_overridable: false` and
   `confidence: high` are required for anything in the non-overridable set.
5. One number, one home. A file may `extends:` another and reference its knobs; it may not copy a
   value. Duplicated magic numbers are a review blocker.
6. `value` is a **default**, not a truth: profiles and personas select a value *inside* the range, and
   the selection is recorded in the plan's `explain`.

## What is here

Owner legend: **plan** = periodization/plan-construction research · **phys** = physiology/metrics
research · **fb** = feedback, safety, heuristics · `status` at 2026-11-03.

| File | Owner | Covers | status |
|---|---|---|---|
| `periodization-models.yaml` | plan | model family, macro length, block floors | draft |
| `intensity-distribution.yaml` | plan | zone-minute shares per 28 days, hard-day cap | draft |
| `phase-transitions.yaml` | plan | phase boundaries, re-check rules | draft |
| `weekly-templates.yaml` | plan | session-slot skeletons by persona | draft |
| `load-progression.yaml` | plan+fb | ramp, step cycles, down weeks, long-run share | draft |
| `workout-dosage.yaml` | plan | per-workout dose caps by class | draft |
| `session-substitution.yaml` | plan | legal substitutions and deletions | draft |
| `recovery.yaml` | plan | spacing, post-race, missing-day handling | draft |
| `taper.yaml` | plan | length, cut %, frequency floor, last hard day | draft |
| `pace-bands.yaml` | phys | band derivation from a single evidence anchor | draft |
| `pace-model.yaml` | phys | UI-facing band widths and staleness (extends `pace-bands`) | draft |
| `session-classes.yaml` | phys | what counts as a quality session, per-week class limits | draft |
| `zones.yaml` | phys | HR zone model, re-band floors, data gates | draft |
| `hrmax.yaml` | phys | HRmax source priority, observed-floor rule | draft |
| `individual-baselines.yaml` | phys | per-user baseline windows, confirmations | draft |
| `noise.yaml` | phys | minimum detectable change per metric | draft |
| `field-tests.yaml` | phys | test eligibility, retest spacing, no-test windows | draft |
| `metric-catalog.yaml` | phys | grade gates + staleness + min series, machine copy | draft |
| `readiness.yaml` | phys | HRV/RHR reading rules, vendor composite ban | draft |
| `wellness.yaml` | phys | subjective instrument rules, confirmations | draft |
| `performance-management.yaml` | phys | CTL/ATL/TSB windows, TSB may not prescribe | draft |
| `fitness-fatigue.yaml` | phys | the τ constants, kept as display defaults | draft |
| `acwr.yaml` | phys | `display_only: true`, variant, corroboration | draft |
| `progression.yaml` | phys | structural-tissue lag, adaptation-block floors | draft |
| `restart-after-layoff.yaml` | phys | layoff ladder, detraining confidence | draft |
| `context.yaml` | phys | heat/altitude/travel behaviour | draft |
| `strength.yaml` | phys | strength-session spacing and dose | draft |
| `medical-flags.yaml` | phys | flags that disable derived zones and lock phases | draft |
| `language-guardrails.yaml` | phys+fb | statements the narrator may never emit | draft |
| `daily-feedback-rules.yaml` | fb | minimum viable entry, comment contract, question triggers | draft |
| `missed-session-rules.yaml` | fb | what happens to a missed session — never a make-up | draft |
| `review-triggers.yaml` | fb | when to flag a review, dwell, cooldown, caps | draft |
| `safety-hard-stops.yaml` | fb | the subtract-only stop list, non-overridable set | draft |

Every `→ rule:` backlink in `knowledge/**` and `docs/**` is checked against this directory by
`pnpm vitest run eval/knowledge-links` (a broken or unresolvable rule id is a red test, not a TODO).

## Pending M1 work (deliberately visible)

* Curation pass: the research agents wrote prose at `status: draft`; each file above needs a human
  review before it may become `curated` ([../MAINTENANCE.md](../MAINTENANCE.md#3-lifecycle)).
  Nothing in the planner's default bundle is `curated` yet.
* [../sources/bibliography.md](../sources/bibliography.md) `[FB-S7]` and `[FB-S8]` are practitioner
  placeholders; no knob citing them may exceed `confidence: medium`.
* Knob **values** are starting points. `eval/golden-plans/` pins the bundle hash so a value change
  shows up as a diff in review rather than a silent behaviour change.
