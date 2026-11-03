---
status: draft
last_reviewed: 2026-11-03
---

# Branching and GitHub workflow

How work moves from an issue to `main` without anyone stepping on the knowledge base. Read
[../../AGENTS.md](../../AGENTS.md) first: the eight hard rules outrank everything here.

## The shape

Three layers, and only three:

| Layer | Name | Lifetime | Merge style |
| --- | --- | --- | --- |
| Trunk | `main` | forever | protected, always releasable |
| Spine | `spine/<milestone>-<area>` | one workstream, deleted at milestone close | merge commit into `main` |
| Leaf | `<type>/<area>-<slug>` | **<= 3 days** | squash into its parent |

A **spine** exists only when a workstream cannot fit in three days. If it lingers past a milestone,
it is unfinished, not important: cut it.

Types: `feat` `fix` `test` `knowledge` `chore` `spike` `release`. Areas: `client` `api` `worker`
`planner-core` `domain` `data` `knowledge` `eval` `infra` `docs`.

```
main
├─ spine/m0-contracts             plan-version + events schemas, DDL + RLS
│  ├─ feat/data-plan-version
│  └─ feat/data-rls-schema
├─ spine/m1-planner               planner-core + golden plans (highest-value milestone)
│  ├─ feat/planner-core-session-types
│  │  └─ feat/planner-core-hard-day-gap      (stacked, 2 deep)
│  └─ test/eval-golden-fixtures
├─ spine/m2-daily-loop            calendar, 3-tap entry, system comment
│  ├─ feat/client-today-takes                (finding F2)
│  └─ feat/client-entry-flow
├─ knowledge/engagement-policy               (finding F1)
├─ knowledge/club-reality                    (finding F3)
├─ knowledge/heat-altitude-bands             (finding F5)
└─ chore/ci-and-protection
```

## Rules that keep the tree readable

1. **One issue per leaf.** Start it with `gh issue develop <n> --checkout` so the link exists from
   birth, and the branch name carries the number when it helps: `feat/client-34-today-takes`.
2. **Stack at most three deep.** A stacked PR states `stacked on #NNN -- do not merge before it` in
   its body and has the parent branch as `base`. If a stack gets a fourth level, the work is being
   avoided, not sequenced.
3. **Never rebase a branch someone else has checked out.** Personal leaf, `--force-with-lease` only.
   Shared branch, merge `main` into it.
4. **`spike/*` never merges.** It ends with a decision note committed to `main`
   (`docs/adr/` if the decision is expensive to reverse), then the branch dies.
5. **A branch that touches two areas is two branches.** `knowledge/` and `packages/` land separately:
   the knob first, the code second, so a rollback of code does not silently roll back reasoning.
6. **No `--no-verify`, no merging your own PR in `knowledge/heuristics/`.**

## Branch protection on `main`

Applied by `tools/github-setup.ps1`, so the repository matches this page instead of drifting from it.
The script finishes by reading the repository back and exits non-zero unless what GitHub *has*
matches what the script asked for. An earlier version printed 35 `OK` lines and created nothing:
`@Args` splatted the automatic (empty) `$args` rather than the parameter of the same name, so every
"call" was a bare `gh` printing its own help and exiting 0. A setup script that reports intentions
as results is worse than none, because it removes the reason to look. Claims are not evidence.

Two more untruths the read-back had to be taught to survive. `rebase_merge` is not a field of
`PATCH /repos`: GitHub answered 200 and ignored it, while the real name is `allow_rebase_merge`. And
repository settings are eventually consistent -- immediately after a successful PATCH the read still
said `rebase=True`, and three seconds later it said `False`. So the verification polls until GitHub
agrees or 60 seconds pass, and creation is preceded by a GET, because a duplicate `POST` reports
only `Validation Failed (HTTP 422)` with the reason -- *already exists* -- buried in the body.
A single read produces false alarms, and a tool that cries wolf gets ignored.

**Status 2026-11-03, read back from the API:** labels (26), milestones (7), branch protection
(`knowledge` required and strict, 1 approving review, stale reviews dismissed), merge styles
(squash and merge commit on, rebase off, delete branch on merge), description, topics, wiki off.
`tools/github-setup.ps1` prints `SETUP VERIFIED` for all of it; re-run it any time this page changes.

`enforce_admins` is **off** (next section), so this constrains every actor except the repository
owner's own token, which can still merge anything. The `knowledge` CI gate is therefore the guarantee
that applies to the owner as well -- which is why it has been green and required since day one, and
why no branch is treated as configured until the setup script says so.

- Pull request required, 1 approving review, the `knowledge` check green and up to date, no force
  push, no delete, conversation resolved. Squash for leaves; merge commit allowed for
  `spine/* -> main`, so a milestone stays bisectable.
- Codeowner review required (`.github/CODEOWNERS`). The safety band --
  `knowledge/heuristics/safety-hard-stops.yaml`, `docs/engine/safety-layer.md`,
  `docs/engine/review-trigger-policy.md`, `schemas/**`, `docs/adr/**`,
  `packages/planner-core/src/safety/**` -- cannot merge without the safety seat.
- **The second review on the safety band is not something branch protection can express**: an
  approval count is per branch, not per path. Enforceable today is the codeowner requirement above;
  enforceable with one small CI step is counting approvals through the API on PRs that touch those
  paths. Until that step exists the second review is a human rule, stated in the PR template, and we
  call it that instead of pretending the setting does it.
- `enforce_admins` is **off** while one person holds every seat. With it on, a solo owner cannot
  approve their own PR and begins bypassing protections by hand -- which is worse than the setting
  never existing. Flip it on the day a second maintainer appears: that is when it stops being
  theatre.
- Accepted ADRs are **never edited** -- supersede with `docs/adr/NNNN-*.md`
  (`AGENTS.md` Conventions), and the CI step for `docs/adr/` fails on a modified non-draft ADR.
- Merge commit is allowed only for `spine/* -> main`, so a milestone remains bisectable.

## What CI must prove (and why each one exists)

| Gate | Failure it prevents |
| --- | --- |
| `tools/audit-links.ps1` prints zeros | a doc that cites a knob nobody declared; a source id that does not exist |
| YAML/JSON parse | the corpus is a build input; a stray quote breaks every consumer |
| No personal absolute path in `tools/` | the audit that hardcoded the machine it was written on: green on a laptop, red on the runner (happened 2026-11-03) |
| Every link target is **committed**, with the right case | an unanchored `data/` in `.gitignore` hid `docs/data/` from git; seven documents cited it and the local audit still said zero (happened 2026-11-03) |
| Every claim a setup tool makes is **read back by value, and polled** | three separate lies in one afternoon: 35 printed successes that created nothing (`@Args` splatted the empty automatic `$args`); a `PATCH` containing the invented field `rebase_merge`, answered 200 with no change; and a single read that returned the pre-patch value because settings are eventually consistent (all 2026-11-03) |
| `last_reviewed` age + `status` values | knowledge rotting invisibly while code ships |
| Golden plans (`eval/golden-plans/`) | a "small tweak" that quietly rewrites 40 km of someone's week |
| `en` vs `zh-Hant` key parity | half the users getting fallback strings in their system comment |
| Narrator banned-output suite | diagnosis, weight/calorie language, guarantees, shame -- in prose, in both languages |

A gate that is red from day one teaches people to ignore it, so the app-level gates are guarded steps
that skip until the code exists (see `.github/workflows/ci.yml`). They become required at M1, not
before.

## Knowledge PRs are a different animal

- **One number, one home.** A reviewer must find the pointer or the `extends:`, not a second copy.
  (Copying a value is a blocker; `contract_aliases:` exists so a doc name can point instead.)
- New knob needs `range`, `confidence`, `provenance.sources` ids that resolve in
  `knowledge/sources/bibliography.md`, and `persona_overridable: false` if safety or honesty depends on it.
- Grade C may justify shape, never a measured number; grade D never reaches a planner branch.
- Prose updated in the same PR, `last_reviewed` bumped, `knowledge/INDEX.md` touched if a file appeared.

## Labels, milestones, issues

Milestones mirror `docs/roadmap/milestones.md` (`M0`..`M6`; M1 -- headless planner -- is the
highest-value one). Labels: `area/*`, `type/*`,
`risk/safety`, `needs-research`, `blocked-on-knowledge`, and `finding/F1`..`finding/F10` from
[../review/2026-11-03-enduser-5w1h-review.md](../review/2026-11-03-enduser-5w1h-review.md) so the
end-user review cannot decay into folklore. `tools/github-setup.ps1` creates all of it idempotently
(`-DryRun` to preview); you still create the repository and `git remote add origin` yourself.

## Releases

`release/<date>` branches cut from `main`, tag `v0.Y.Z`, hotfixes branch from the tag back onto both
`main` and the release branch. Every plan version a user ever saw records the **knowledge bundle
version** and the planner version, so a plan can be re-derived and explained months later -- which is
the entire point of `AGENTS.md` rule 1.
