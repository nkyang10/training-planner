---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# feat/client-entry-flow -- Three taps, and the pain question asked early (finding F7)

Base branch: spine/m2-daily-loop   |   Milestone: M2 The daily loop, manual-first   |   Depends on: spine/m2-daily-loop

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Real-time in-run coaching is a declared non-goal, so the entry flow is where the pain story gets captured.

nextMorningWorse exists in the schema but hides inside the tier-2 pain object; it is the single most useful signal a runner gives us.

## Write scope

- `apps/web/src/entry/**`
- `docs/ux/feedback-microcopy.md`

## First pull requests, each one reviewable in an hour

1. Tier 1 at three taps, with next-morning-worse promoted into it
2. Tier 2 expansion for pain location, quality, and intent with-others (F3 dependency)
3. Client-side prompt budget: the one-per-week counter is shared with review prompts, not separate

## Definition of done

- [ ] Tier 1 works offline and survives the 72h backfill window
- [ ] No shame copy in either language; silence is never framed as failure

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

