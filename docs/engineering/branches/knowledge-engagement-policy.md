---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# knowledge/engagement-policy -- When we speak, and when we do not (finding F1)

Base branch: main   |   Milestone: M2 The daily loop, manual-first   |   Depends on: none - knowledge root branch

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Nudge, daily reminder, push at: zero hits in 122 files. The rarer event (a review) is exhaustively specified; the daily one is absent.

Silence is load-bearing in both directions: three quiet days after a hard block is information, and today it is neither feedback nor a miss.

## Write scope

- `knowledge/heuristics/engagement.yaml`
- `docs/ux/feedback-microcopy.md`
- `knowledge/INDEX.md`

## First pull requests, each one reviewable in an hour

1. Nudge time anchored to the runner own observed run hour, never a default 09:00; quiet hours from their own entry times
2. Silence ladder: 3 days means just checking, 7 days offers a pause, never guilt
3. One shared prompt budget across nudges and reviews so the one-per-week ceiling is real

## Definition of done

- [ ] Every knob has range, confidence and bibliography ids; audit prints four zeros
- [ ] The ladder changes no session: it is a question, not a plan change

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

