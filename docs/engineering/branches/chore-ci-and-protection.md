---
status: draft
last_reviewed: 2026-11-03
kind: branch-brief
---

# chore/ci-and-protection -- Repository settings that make the rules real

Base branch: main   |   Milestone: M0 Skeleton and contracts   |   Depends on: none - root chore branch

Landed on `main` as `ac424dd` (PR #7, squash-merged with `--admin`) on 2026-11-03. The branch ref is
gone -- `delete_branch_on_merge` was switched on deliberately -- and this page stays as the record.

Read [branching-and-github.md](../branching-and-github.md) and [AGENTS.md](../../../AGENTS.md) first.

## Why this branch exists

Docs that nobody can enforce become folklore. This branch turns the review rules into checks and
required reviewers, and then refuses to believe its own settings until it has read them back by value:
every one of the four protection faults found here was reported as a success by the tool that caused it.

## Write scope

- `.github/**`
- `tools/github-setup.ps1`
- `CONTRIBUTING.md`
- The sentences in `README.md` and `docs/engineering/branching-and-github.md` that state what the
  repository settings *are*. A page describing a control the API will not store is part of the bug, so
  the correction belongs on the branch that fixes it, in the same PR, or the fix ships with a lie.

## First pull requests, each one reviewable in an hour

1. done - repository, 26 labels, 7 milestones; `tools/github-setup.ps1 -DryRun` before every real run
2. done - `knowledge` required from day one; `ddl` joined 2026-11-03, only after its first runner log
   had been read as text rather than as a green tick. CODEOWNERS names *seats*: today every seat is the
   same handle, and that is stated in the file rather than hidden
3. open - a second review on the safety band. Branch protection cannot express it: an approval count is
   per branch, not per path. It needs one CI step counting approvals through the API on PRs that touch
   those paths, and until that step exists it is a human rule in the PR template, called that out loud
4. done, as a negative result - PR #8, a `spike/*` touching `/knowledge/`, was opened to *see* whether
   required code-owner review does anything beyond its stored value. It cannot be told apart from the
   plain one-approval rule while the only owner is the author: same empty `requested_reviewers`, same
   `REVIEW_REQUIRED`, same refusal of a non-admin merge. Closed unmerged; the claim on the page was
   weakened to match

## Definition of done

- [x] A PR that breaks an anchor cannot merge. Proven the hard way, not by reading settings: PR #4
      printed `DEAD LINKS: 1` on a leaf that had done nothing wrong and stayed red until the sibling
      owning the target merged first
- [x] `ddl` is a required check, and its runner log was opened before that sentence was written
- [x] Codeowner review reads back `true` (2026-11-03). Before that read-back it had never once been on
- [x] Every protection field is compared by value and printed as `field | got | want`; an invented
      field name reads `<absent>` and turns the run red. That was provoked on purpose with a
      deliberately misspelled path before the line was believed
- [x] PR body names the rule this protects
- [x] An admin's plain merge is refused on a safety-band path. Measured twice, on PR #7 (no owned path)
      and PR #8 (owned path): `gh pr merge` exits 1 with *the base branch policy prohibits the merge*, and
      only `--admin` lands anything
- [ ] A safety-band edit cannot merge without a *second* reviewer. The codeowner seat is one person
      wearing the same hat twice, so this is not satisfied by item 3 above
- [x] `tools/audit-links.ps1` prints six zeros - four was the count before `UNTRACKED TARGETS` and
      `UNCOMMITTED CORPUS FILES` existed, and the page kept saying four afterwards. `UNTRACKED TARGETS`
      exists because `docs/data/` was ignored by git while seven documents cited it and the audit said
      zero; `UNCOMMITTED CORPUS FILES` has been watched moving since - it read `1` on the spike branch
      while its own new file was unstaged, and `0` one commit later

## The lesson this branch is for

Four protection claims were asserted on a page and none of them were true as written: `rebase_merge`
(an invented field, answered 200), the `enforce_admins` check (asking whether an object exists, which
is always true, and printing "on" for `false`), `require_codeowner_reviews` (a missing underscore that
left code-owner review off for a month), and `block_creations` (a documented field this repository does
not store, caught only once the verifier compared values instead of sentences). The last one was
*deleted from the page* rather than polled harder. Whatever gets built here next, the instrument is the
same as `tools/check-claims.sql`: never let the thing that reports be the thing that believes.

Two more arrived while proving the fix, and they are the ones worth keeping. Reading
`.requested_reviewers` from an endpoint whose field is `users` yields `$null`, and `@($null).Count` is 1,
so an empty reviewer list reported as one reviewer: a wrong field name plus a truthy absence is enough to
invent a fact, which is why one-line API answers are now read as raw text. And the strongest lesson is
about a control that is genuinely configured and still protects nothing yet -- code-owner review cannot
look different from a plain approval rule while one person is both author and only owner. A setting earns
a sentence on a page only as far as something observable depends on it.

