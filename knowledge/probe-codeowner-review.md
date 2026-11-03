---
status: draft
last_reviewed: 2026-11-03
kind: spike
---

# Probe: does required code-owner review actually fire?

This file exists to be **closed, not merged**. `spike/*` never merges (rule 4 in
`docs/engineering/branching-and-github.md`).

On 2026-11-03 the repository turned on `require_code_owner_reviews` for the first time, after a month
of believing it was on. The value has been read back as `true`, but a value is not a behaviour: the
control is only real if a pull request that touches an owned path is actually gated by it. This branch
touches `/knowledge/`, which `.github/CODEOWNERS` assigns to the safety seat, so the expected answers
are: a code owner auto-requested as reviewer, `reviewDecision=REVIEW_REQUIRED`, and no merge without an
explicit `--admin`.

Whatever the API answers is recorded in `docs/engineering/branching-and-github.md`, and this branch is
closed.
