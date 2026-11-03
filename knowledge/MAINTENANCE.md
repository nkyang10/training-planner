# Knowledge Base Maintenance Contract

This folder is the project's long-term memory. It outlives any single feature, refactor, or
model. Everything here must stay **usable as input to the planner engine** and **auditable by a
human coach**.

## 1. What belongs where

| Folder | Contains | Consumed by |
|---|---|---|
| `physiology/` | How adaptation actually works; timelines; individual differences | Engine rationale, review docs |
| `training-principles/` | overload, specificity, reversibility, individuality, 80/20, progression | Engine rule justification |
| `periodization/` | Model families (linear, block, reverse, Daniels phases) | Plan generator |
| `plan-construction/` | Inputs→outputs of a plan: weekly templates, mileage growth, taper, race sequencing | Planner core |
| `workout-library/` | One file per workout type: purpose, structure, dosing, contraindications | Workout picker |
| `signals-and-metrics/` | Definitions + formulas + trust levels (HR zones, TSB, ACWR, HRV, drift, VDOT) | Metrics service |
| `feedback-and-autoregulation/` | Daily feedback vocabulary, interpretation windows, adjustment policy | Feedback loop + reviewer |
| `risk-and-safety/` | Red flags, RED-S, overreach vs OTS, injury, referral rules, guardrails | Safety layer (hard constraints) |
| `personas/` | Runner archetypes: constraints, typical errors, plan shape, messaging | Onboarding + personalisation |
| `heuristics/` | **Machine-readable** rules (`*.yaml`) the engine loads. No prose-only rules here | Planner core (runtime) |
| `case-studies/` | Anonymised plan→result narratives, including failures | Eval fixtures, regression |
| `sources/` | Bibliography, reading list, dataset/paper notes with reliability grade | Everything above |

`research/` (outside this folder) holds **dated, immutable research drops**. Never edit an old
drop; add a new one. `knowledge/` holds the **current curated truth** and is edited in place.

## 2. File format

Every markdown file starts with front matter:

```yaml
---
id: signals-and-metrics/hrv
title: Heart-rate variability for endurance athletes
status: draft            # draft | curated | contested | superseded
confidence: medium       # high (replicated/triangulated) | medium | low
evidence: [review, practitioner]   # meta-analysis | rct | cohort | review | practitioner | vendor | anecdote
applies_to: [all]        # personas or contexts this applies to
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [S12, S31]      # ids from sources/bibliography.md
---
```

Body rules:

1. **Key takeaways first** — 5 bullets max before any explanation.
2. Separate `## Facts` from `## Practice` from `## Controversies`. Never blur them.
3. Numbers carry units and populations (`recreational runners n≈…`), and a source id.
4. Anything that becomes an engine rule gets a backlink: `→ rule: heuristics/load-progression.yaml#max-step`.
5. Individual differences are stated explicitly ("if … then the opposite may hold").
6. Contradictions stay visible. Mark the file `status: contested` and write both camps.
7. No coaching advice that outruns a doctor: medical topics end with a `## Escalate to a clinician` section.

## 3. Lifecycle

```
research drop → knowledge draft (status: draft) → reviewed (curated) → codified (heuristics/*.yaml) → tested (eval/golden-plans)
```

* A rule may not enter `heuristics/` until its prose file exists and is `curated`.
* Every heuristic YAML has `provenance:` pointing at the prose file and source ids.
* Review cadence: `signals-and-metrics/` and `feedback-and-autoregulation/` every 6 months;
  the rest yearly. Update `last_reviewed` even when nothing changes.
* Deprecated knowledge is marked `status: superseded` with `superseded_by:` — not deleted,
  because old plans must remain explainable.

## 4. Source grading (in `sources/bibliography.md`)

| Grade | Meaning | Weight in a decision |
|---|---|---|
| A | Meta-analysis / systematic review / large cohort in runners | Can define a default |
| B | RCT or well-run cohort, small or non-runner population | Sets a range, not a constant |
| C | Consensus statement, coaching textbook, longitudinal coaching practice | Sets shape/heuristics |
| D | Vendor whitepaper, blog, single anecdote | Hypothesis only; must be labelled |

Product defaults need grade A/B evidence **or** an explicit `practitioner` label plus a safe,
reversible default. Vendor claims (Garmin "Training Effect", "Acute:Chronic Workload") are grade D
unless independently validated — they may be *displayed* but never silently drive plan surgery.

## 5. Adding knowledge from a running season

The product itself accumulates evidence per user (`docs/engine/feedback-loop.md`). At least
quarterly, promote patterns observed across users into `case-studies/` (anonymised), then into
`personas/` or `heuristics/`. Personal data never leaves the user's scope; only distilled
*policies* are promoted, and each promoted rule records the number of users/weeks behind it.
