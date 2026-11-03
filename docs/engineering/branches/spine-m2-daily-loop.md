---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# spine/m2-daily-loop -- The daily loop, manual-first

Base branch: main   |   Milestone: M2 The daily loop, manual-first   |   Depends on: spine/m1-planner for the plan contract

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

If the loop does not close on a phone at 22:40, the product is a PDF generator.

Both launch blockers from docs/review/2026-11-03-enduser-5w1h-review.md land in this spine: F1 and F2.

## Write scope

- `apps/web/**`
- `apps/api/**`
- `packages/i18n/**`

## First pull requests, each one reviewable in an hour

1. Calendar home plus day drawer; entry-first quick log at three taps
2. System comment rendered from the structured fact object, allowedNumbers enforced at build
3. en and zh-Hant catalogues with key parity checked in CI

## Definition of done

- [ ] A runner logs a day in three taps with one hand, offline
- [ ] No number on screen that the engine did not choose

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

