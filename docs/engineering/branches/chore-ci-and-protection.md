---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# chore/ci-and-protection -- Repository settings that make the rules real

Base branch: main   |   Milestone: M0 Skeleton and contracts   |   Depends on: none - root chore branch

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Docs that nobody can enforce become folklore. This branch turns the review rules into checks and required reviewers.

The knowledge gate is required from day one; the app gates join at M1 so CI is never red for a reason nobody can fix.

## Write scope

- `.github/**`
- `tools/github-setup.ps1`
- `CONTRIBUTING.md`

## First pull requests, each one reviewable in an hour

1. Create the repository, labels and milestones; run tools/github-setup.ps1 -DryRun first
2. Make knowledge a required check and replace CODEOWNERS placeholders with real handles
3. Two-review paths for safety files, schemas and accepted ADRs

## Definition of done

- [ ] A PR that breaks an anchor cannot merge
- [ ] A safety-file edit cannot merge without the safety owner

- [ ] `tools/audit-links.ps1` prints four zeros
- [ ] PR body names the rule this protects (see the template)

