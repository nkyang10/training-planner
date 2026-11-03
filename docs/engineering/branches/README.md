---
status: draft
last_reviewed: 2026-11-03
kind: index
---

# Branch briefs

One file per branch that exists in the repository right now. Each branch carries exactly one of
these as its first commit, so `git log -1 --name-only` on any branch answers "what is this branch
for, what may it touch, and what has to be true before it merges" without opening a pull request.

The branch model itself -- layering, naming, stacking, protection -- lives in
[branching-and-github.md](../branching-and-github.md). This directory is only the instance: the
actual tree we intend to work in.

## The tree

| Branch | Base | Milestone | Comes from |
|---|---|---|---|
| `spine/m0-contracts` | `main` | M0 | contracts gap in [backlog.md](../../roadmap/backlog.md) |
| `feat/data-plan-version` | `spine/m0-contracts` | M0 | planner purity, [AGENTS.md](../../../AGENTS.md) rule 1 |
| `feat/data-rls-schema` | `spine/m0-contracts` | M0 | AGENTS.md rule 7, finding F9 |
| `spine/m1-planner` | `main` | M1 | [milestones.md](../../roadmap/milestones.md) -- highest value |
| `feat/planner-core-session-types` | `spine/m1-planner` | M1 | finding F8 (one session per day) |
| `feat/planner-core-hard-day-gap` | `feat/planner-core-session-types` | M1 | `recovery.yaml#hard_day_gap_hours` -- a stacked branch, 2 deep |
| `test/eval-golden-fixtures` | `spine/m1-planner` | M1 | backlog item 1 |
| `spine/m2-daily-loop` | `main` | M2 | the loop closing on a phone |
| `feat/client-today-takes` | `spine/m2-daily-loop` | M2 | **finding F2 -- launch blocker** |
| `feat/client-entry-flow` | `spine/m2-daily-loop` | M2 | **finding F7**, three-tap minimum |
| `knowledge/engagement-policy` | `main` | M2 | **finding F1 -- launch blocker** |
| `knowledge/club-reality` | `main` | M2 | finding F3 |
| `knowledge/heat-altitude-bands` | `main` | M5 | finding F5 |
| `chore/ci-and-protection` | `main` | M0 | making the rules into checks |

Findings are numbered as in
[2026-11-03-enduser-5w1h-review.md](../../review/2026-11-03-enduser-5w1h-review.md), and the same
numbers become `finding/F*` issue labels so a branch, an issue and a review row always point at each
other.

## Reading and reproducing the tree

```
git log --graph --oneline --decorate --all
git switch spine/m1-planner          # a workstream
git log --oneline -1 --name-only     # what this branch is for
```

`knowledge/*` branches branch off `main` and merge back to `main` on their own, never inside a
feature spine: a knob must be reviewable by the knowledge owner without a diff full of React.

## Lifecycle of a brief

A leaf brief is amended with `merged: #NNN` in its front matter when the leaf squash-merges into its
spine. When the spine lands on `main`, its briefs move to `done/` in that same merge commit. A
branch that dies without merging keeps its brief in `done/` too, with the decision that killed it --
a branch we never look at again is a branch whose reasoning we lost.
