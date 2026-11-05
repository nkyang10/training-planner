# Training Planner — daily running plans with a daily feedback loop

A per-user web system that builds a runner's **daily** training program from their background and
goal, takes a **20-second feedback entry on the calendar every day**, replies with a **short coaching
comment**, and lets the runner (or the system) **trigger a review that rewrites the future plan**.

This repository is currently a **design + knowledge foundation**, not a running app. Code lands in
`apps/` and `packages/` after milestone M1 ([docs/roadmap/milestones.md](docs/roadmap/milestones.md)).

---

## The loop the product exists to close

```
        ┌────────────────────────────────────────────────────────────┐
        │  PLAN        generate dated sessions for the next horizon  │
        └───────────────┬────────────────────────────────────────────┘
                        │  today's session shown on a calendar
                        ▼
        ┌────────────────────────────────────────────────────────────┐
        │  DO          runner runs (device, or nothing at all)       │
        └───────────────┬────────────────────────────────────────────┘
                        ▼
        ┌────────────────────────────────────────────────────────────┐
        │  LOG         calendar day cell → 5-tap feedback entry      │
        └───────────────┬────────────────────────────────────────────┘
                        ▼
        ┌────────────────────────────────────────────────────────────┐
        │  COMMENT     system reply: what happened → what tomorrow   │
        │              does → micro-adjusts ONLY tomorrow            │
        └───────────────┬────────────────────────────────────────────┘
                        ▼
        ┌────────────────────────────────────────────────────────────┐
        │  REVIEW      triggered by accumulated signals or by user   │
        │              rewrites the FUTURE as a visible diff →       │
        │              runner accepts / rejects / picks an option    │
        └───────────────┬────────────────────────────────────────────┘
                        └──────────────► back to PLAN (new plan version)
```

Two levels of change, deliberately separated:

| | **Micro-adjust** | **Review** |
|---|---|---|
| Scope | tomorrow (≤ 2 days ahead) | everything after a horizon boundary |
| Trigger | every logged day | user request or a signal crossing a threshold |
| Cost | invisible, reversible | visible diff, explicit consent, logged |
| Who can block it | safety layer only | the runner always |

Conflating them is why adaptive apps feel either useless ("nothing changed") or unsafe
("it rewrote my season"). Everything below follows from keeping them apart.

---

## Where things live

| Path | Purpose | Read first |
|---|---|---|
| `README.md` | this map | — |
| `AGENTS.md` | rules for humans and AI agents working here | yes |
| `CONTRIBUTING.md` | how work is planned, branched and reviewed; what this repo refuses | [branching-and-github.md](docs/engineering/branching-and-github.md) |
| `docs/vision/` | what we are building, for whom, and what we refuse to do | [product-vision.md](docs/vision/product-vision.md) |
| `docs/architecture/` | components, tenancy/isolation, integrations, stack | [system-overview.md](docs/architecture/system-overview.md) |
| `docs/engine/` | the brain: planner, feedback loop, review policy, safety | [planner-engine.md](docs/engine/planner-engine.md) |
| `docs/data/` | data model, event catalog, metric contracts | [data-model.md](docs/data/data-model.md) |
| `docs/ux/` | screens, calendar interaction, comment microcopy | [screens.md](docs/ux/screens.md) |
| `docs/adr/` | decisions and why they were made (append-only) | [README](docs/adr/README.md) |
| `docs/roadmap/` | milestones and backlog | [milestones.md](docs/roadmap/milestones.md) |
| `docs/review/` | dated self-reviews of the whole design, written from the runner's seat | [2026-11-03 5W1H review](docs/review/2026-11-03-enduser-5w1h-review.md) |
| `docs/engineering/` | branch model, CI gates, contract vocabulary, per-branch briefs | [branches/README.md](docs/engineering/branches/README.md) · [contract-vocabulary.md](docs/engineering/contract-vocabulary.md) |
| `knowledge/` | **long-term domain memory** — physiology, periodization, signals, personas, workout library, machine-readable heuristics | [knowledge/INDEX.md](knowledge/INDEX.md) + [MAINTENANCE.md](knowledge/MAINTENANCE.md) |
| `research/` | dated, immutable research drops; never edited after the fact | `research/2026-11-03-foundation/` |
| `schemas/` | machine contracts: JSON Schema + SQL DDL | `schemas/json/` · when two files name the same thing differently, [contract-vocabulary.md](docs/engineering/contract-vocabulary.md) is the record |
| `eval/golden-plans/` | fixtures: profile in → assertions on the plan out | [eval/README.md](eval/README.md) |
| `apps/`, `packages/` | future implementation, one README each describing its intended shape | — |

### Knowledge flow (the long-term development part)

```
research/YYYY-MM-DD-<topic>/     raw drop, immutable, dated
        ↓ distil
knowledge/<topic>/*.md           curated prose, status + confidence + sources
        ↓ codify
knowledge/heuristics/*.yaml      machine-readable rules with provenance
        ↓ load (content-hashed at build time)
packages/planner-core            deterministic generation
        ↓ prove
eval/golden-plans/*.json         regression: a rule change must not silently break a plan shape
```

Knowledge is the product's moat and its safety record. A rule cannot reach the planner without a
prose file, a source grade, and a golden test — see
[knowledge/MAINTENANCE.md](knowledge/MAINTENANCE.md).

---

## Local testing stage

The product can be used locally on SQLite with a seeded runner: [docs/local-testing.md](docs/local-testing.md)
(`npx tsx tools/seed-local.ts`, then the web process on :8081). That page records what the seeded runner has, what to
look at, and the UI/UX gaps the first real pass found and fixed.

## Status

| Area | State |
|---|---|
| Domain knowledge base | seeding now (physiology, metrics, periodization, personas, feedback, safety, heuristics) |
| System design | written: engine, data model, tenancy, integrations, UI |
| Machine contracts | drafted: `schemas/` |
| Self-review | 2026-11-03: three personas walked the design end to end, 10 findings, 2 launch blockers (F1 prompt policy, F2 session duration) |
| Development setup | [github.com/nkyang10/training-planner](https://github.com/nkyang10/training-planner), public; `main` plus the open branches of [the tree](docs/engineering/branching-and-github.md) (merged ones are deleted on merge). Labels, milestones, merge styles and branch protection are read back **field by field, by value** from the API by `tools/github-setup.ps1`, which must print `SETUP VERIFIED`: `knowledge` **and `ddl`** required and strict, 1 approving review, codeowner review required (this one was silently off until 2026-11-03 — see [branching-and-github.md](docs/engineering/branching-and-github.md)) |
| Code | not started — M1 is a headless planner core with golden tests |
| Verified external constraints | Strava developer terms verified 2026-11-03; Garmin access **not verified** (see [integrations.md](docs/architecture/integrations.md)) |
