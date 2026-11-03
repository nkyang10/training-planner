---
status: draft
last_reviewed: 2026-11-03
owner: knowledge
---

# Knowledge index

The map of this corpus. Read this first, then `MAINTENANCE.md` (how to change anything), then
`AGENTS.md` (the eight rules nothing here may contradict).

Two layers live side by side and must not be confused:

| Layer | Where | Contains | May contain a number? |
| --- | --- | --- | --- |
| **Reasoning** | `knowledge/<topic>/*.md` | why a rule exists, what the evidence says, what is contested | only with a `→ rule:` backlink to its home |
| **Knobs** | `knowledge/heuristics/*.yaml` | the values the planner actually reads, each with `range` and `confidence` | yes — this is the only place they live |

## Reading order

1. `physiology/fatigue-fitness-recovery.md` — why training works and why rest is part of the dose.
2. `plan-construction/inputs-and-output.md` — what the planner is given and what it must produce.
3. `periodization/models-comparison.md` → `plan-construction/weekly-templates.md` — shape, then week.
4. `signals-and-metrics/metric-catalog.md` — which numbers are allowed to influence anything at all.
5. `feedback-and-autoregulation/*` — the daily loop: feedback → comment → micro-adjust → review.
6. `risk-and-safety/*` — what may never be optimised away. Read before writing any planner branch.

## Directory map

| Directory | Question it answers | Files |
| --- | --- | --- |
| `physiology/` | What is actually happening in the body, and what is individual? | 5 |
| `periodization/` | How is a season shaped, and how is intensity distributed inside it? | 3 |
| `plan-construction/` | Inputs, weekly shape, session dosage, testing, taper, output. | 6 |
| `workout-library/` | One file per session type: purpose, dose, common errors, substitutes. | 14 |
| `personas/` | Nine runner starting points; what changes in the plan and what does not. | 9 |
| `signals-and-metrics/` | Every candidate signal, graded A–D for whether it may drive the planner. | 8 |
| `feedback-and-autoregulation/` | The daily loop, interpretation windows, review policy, comment playbook. | 7 |
| `risk-and-safety/` | Pain triage, overreach, REDs, red flags, disclaimers. | 5 |
| `heuristics/` | The knobs. 34 YAML files, one `README.md` with the contract and manifest. | 35 |
| `sources/` | `bibliography.md` — every `PLAN-S`/`PHYS-S`/`FB-S` id, grade, and how it was verified. | 1 |
| `training-principles/` | *Placeholder.* Overloading, specificity, reversibility, individuality — prose pending. | 0 |
| `case-studies/` | *Placeholder.* Anonymised plan histories once real plans exist; nothing invented here. | 0 |

## The heuristics layer, in five rules

1. **One number, one home.** A knob is declared in exactly one file. Everywhere else is a pointer
   (`value: "recovery.yaml#hard_day_gap_hours"`) or an `extends:`. Copying a value is a review blocker.
2. **Every knob has `range`.** The engine clamps to it, so a typo cannot produce a 40 km threshold
   session (`AGENTS.md` Conventions).
3. **`confidence` is earned, not asserted.** `high` only where grade-A/B evidence or a well-quoted
   practice consensus; safety knobs are `subtract_only` and `non_overridable`; `persona_overridable:
   false` marks the safety and honesty knobs a user cannot trade away.
4. **Backlinks bind.** Prose says ``→ rule: heuristics/<file>.yaml#<knob>``; the YAML must declare that
   id. Where a doc uses a name the YAML never declared, the YAML carries a `contract_aliases:` block
   pointing at the `home` — the alias is a pointer, never a second copy.
5. **Safety only subtracts.** Nothing in `safety-hard-stops.yaml` or a safety flag may add intensity,
   and a good signal never buys extra work.

## Honesty ledger

- Grades: **A** meta/systematic review, **B** RCT or strong cohort, **C** practice text (books,
  coaching consensus), **D** vendor or blog. Grade C may justify *shape*, never a measured number;
  grade D may not reach a planner branch (`signals-and-metrics/metric-catalog.md`).
- 21 `PHYS-S` entries are author+year+journal with a real PubMed query URL and are marked **"primary
  record not abstract-verified on 2026-11-03"**. They are leads, not verified citations.
- `FB-S8` is a **knowingly-fake placeholder** kept visible so its dependent rules stay capped at
  `confidence: medium`; `FB-S9` is marked "citation to verify". `PLAN-S6` was never read.
  Any rule resting on these three is capped low — do not raise it without reading the source.
- Worked examples in `personas/` and `plan-construction/` are labelled illustrative. They are not
  validation data, and nothing in `eval/golden-plans/` may be derived from an unverified number.

## Integrity check

```
pwsh -File tools/audit-links.ps1
```

Reports missing backlink anchors, missing YAML files, unknown `sources:` ids, dead relative links, and
the total backlink count. It must print zeros before a commit; the numbers above are what it produced
on 2026-11-03 (133 backlinks, 0 missing anchors, 0 unknown source ids, 0 dead links).

## Deliberately absent from this corpus

Weight or calorie targets; diet protocols; any diagnosis or the naming of a condition the runner has
not been given; training-day answers derived from a device composite alone; "recovery percentage" and
"durability" scores; guarantees about race outcomes; demographic destiny (context changes the *shape*
of a plan, never the goal: `heuristics/context.yaml`).

## Pending

`knowledge/training-principles/*` and `knowledge/case-studies/*` (empty above), plus the artefacts
tracked in `../docs/roadmap/backlog.md` under *Now (pre-M2)*: the remaining JSON contracts for plan
versions and events; the Postgres DDL; `docs/engine/explanation-and-trust.md`;
`docs/vision/personas-and-journeys.md`; golden-plan fixtures.
