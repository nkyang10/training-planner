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

Some of these are already history on the remote: `spine/m0-contracts` and its two leaves merged into
`main` on 2026-11-03, and `delete_branch_on_merge=true` removed the refs when the merges landed. The
same will happen to each branch above as it lands. So the branch list on GitHub is *work in progress*,
never the plan -- the tree here is the plan, and each branch's brief in [`branches/`](./branches/) stays
on `main` as the record after the ref is gone.

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
7. **A prose link is a dependency; the owner of the target merges first.** Links are audited on every
   branch, not only on `main`, so a leaf whose prose cites a file that lives on a *sibling* leaf is
   correct on paper and red in CI until that sibling lands. This happened on `spine/m0-contracts`
   (2026-11-03): spine prose cited `schemas/json/plan-version.schema.json`, owned by the other leaf,
   so the RLS leaf printed `DEAD LINKS: 1` while having done nothing wrong. The fix was ordering, not
   editing — squash-merge the owning leaf, `git merge origin/spine/<...>` into the other, re-push,
   green. So when two leaves of one spine reference each other's files, **decide the merge order
   before opening the PRs and write it in both bodies**. A link implies a sequence; a stack without a
   stated sequence is a stack that discovers its order by failing.

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

**Status 2026-11-03, every field read back by value.** `tools/github-setup.ps1` now prints one line per
setting as `path  got  want`, and exits non-zero if any line disagrees: 26 labels, 7 milestones,
`required_status_checks` = `knowledge` + `ddl` with `strict`, 1 approving review, stale reviews
dismissed, codeowner review required, last-push approval required, no force push, no delete, linear
history off, conversation resolved, squash and merge commit on with rebase off, description, topics,
wiki off. `SETUP VERIFIED` means eleven named values were compared, not that the script asked politely.

**The `ddl` check joined `required_status_checks` only after its runner log was read as text**, not
because a tick was green (job `126011872875`): `Postgres 16.15`, `purge capability granted on 22 tenant
tables`, `rolled back clean: 0 relations, 0 roles`, `claims hold: forced rls, one named exempt table,
no bypass, purge visibility, anonymous analytics, append-only guards`. A required check whose first run
nobody opened is a required check that might be vacuous.

**Codeowner review was not enforced on this repository until 2026-11-03.** The script sent
`require_codeowner_reviews`; the API field is `require_code_owner_reviews`. GitHub answered 200, stored
`false`, and the verifier looked at three other fields — so it printed "branch protection: knowledge
required and up to date, 1 approving review", a sentence about settings it had never read. Same class
as the two above: `rebase_merge` was an invented field, and a verifier once tested whether
`enforce_admins` *existed*, which is always true because every toggle arrives as `{enabled: …}`. Three
invented names, two of them asserted on this page as fact. A protection claim is now only ever the
read-back value of a named path, and the tool prints a table instead of a sentence, because a sentence
cannot be audited.

A fifth instance happened while verifying that fix, and it is the sneakiest: `GET
/pulls/7/requested_reviewers` answers `{"users":[…],"teams":[…]}`, and the reading counted
`.requested_reviewers` -- a property that endpoint does not have. It returned `$null`, and in PowerShell
`@($null).Count` is **1**, so the report was "1 requested reviewer" from an empty list. Retracted within
the same minute, which is only possible because the raw text was printed right after. For a one-line
answer: read the raw text. An object model will happily answer a question you never asked.

**Code-owner review is now stored; its effect is not yet observable.** Flipping the flag is not the same
as having the gate, and PR #8 -- a `spike/*` that touched `/knowledge/`, an owned path, and was closed
without merging -- is the evidence that the difference cannot be seen from a one-maintainer repository:

| Read | PR #8, touches an owned path | PR #7, touches nothing owned |
| --- | --- | --- |
| `requested_reviewers` | `{"users":[],"teams":[]}` | `{"users":[],"teams":[]}` |
| `reviewDecision` | `REVIEW_REQUIRED` | `REVIEW_REQUIRED` |
| `gh pr merge --squash` | exit 1, *the base branch policy prohibits the merge* | the same |

GitHub never requests a review from the author, and the author is the only owner, so the seat can never
appear as a requested reviewer; and one required approval produces `REVIEW_REQUIRED` by itself. The test
that *would* separate the two is an approval from someone who is not the code owner, and that needs a
second account. So the claim this repository may make is "the setting is on and read back", not "a
safety-band PR cannot land without a separate reviewer". That second sentence becomes true the day a
second maintainer exists, and until then the controls actually enforcing the safety band are the CI
counters -- which is what they were before, and what they remain.

**`block_creations` is not set and is no longer asked for.** It was sent as `true`, answered 200, and
stayed `false` through 30 seconds of polling: a field this API will not store here. The new verifier
made that a permanent red — the correct reaction, and the reason the claim was deleted rather than
polled harder. Deleting `main` to escape the rule is already blocked by `allow_deletions=false`, which
does read back.

**What `enforce_admins = false` buys is smaller than this page claimed.** It used to say that
protection constrains everyone except the owner's token, "which can still merge anything". PR #6 was
used as the experiment on 2026-11-03:

| Attempt on PR #6, as the repository owner | Result |
| --- | --- |
| `gh pr review --approve` | refused: *Can not approve your own pull request* |
| read the state back | `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED`, `reviewDecision=REVIEW_REQUIRED` |
| `gh pr merge --merge` | exit 1: *the base branch policy prohibits the merge* |
| `gh pr merge --merge --admin` | merged, `c38b8e6` |

The review requirement **does** bind the owner. What `enforce_admins = false` leaves is the option of an
explicit, attributable `--admin` merge — recorded against the token that used it — instead of a silent
bypass: nothing lands unless someone names the flag. Keep it off while one person holds every seat
(with it on, the solo owner still merges by hand and gets *less* record of it), flip it the day a second
maintainer appears. Until then every `spine/* -> main` merge is an `--admin` merge, and the log says so.

- Pull request required, 1 approving review, `knowledge` and `ddl` green and up to date (`strict`), no
  force push, no delete, conversation resolved. Squash for leaves; merge commit allowed for
  `spine/* -> main`, so a milestone stays bisectable.
- Codeowner review required **as of 2026-11-03** (`.github/CODEOWNERS`,
  `require_code_owner_reviews` read back `true`). The safety band --
  `knowledge/heuristics/safety-hard-stops.yaml`, `docs/engine/safety-layer.md`,
  `docs/engine/review-trigger-policy.md`, `schemas/**`, `docs/adr/**`,
  `packages/planner-core/src/safety/**` -- is now *addressed* to the safety seat, and when that seat is
  held by someone other than the author the PR cannot land without them. Today it is the same person, so
  nothing about a safety PR looks different yet (PR #8 above). Before that date the settings holding that
  line were the CI counters, the SQL leak test and `tools/check-claims.sql`; they are still the first
  controls I would cite, because they run whether or not anyone is watching.
- **The second review on the safety band is not something branch protection can express**: an
  approval count is per branch, not per path. Enforceable today is the codeowner requirement above --
  which means "the right seat must approve" the moment a second person holds a seat; enforceable with one
  small CI step is counting approvals through the API on PRs that touch those paths. Until that step
  exists the second review is a human rule, stated in the PR template, and we call it that instead of
  pretending the setting does it.
- `enforce_admins` is **off** by choice and measured (table above): it removes the flag requirement for
  an admin, it does not let anyone merge quietly.
- Accepted ADRs are **never edited** -- supersede with `docs/adr/NNNN-*.md`
  (`AGENTS.md` Conventions), and the CI step for `docs/adr/` fails on a modified non-draft ADR.
- Merge commit is allowed only for `spine/* -> main`, so a milestone remains bisectable.

## What CI must prove (and why each one exists)

| Gate | Failure it prevents |
| --- | --- |
| `tools/audit-links.ps1` prints zeros | a doc, contract or SQL comment that cites a knob nobody declared; a source id that does not exist. Since R5 it reads `knowledge/**/*.yaml`, `schemas/**/*.json` and `schemas/**/*.sql` as well as Markdown, and matches a citation with or without the `heuristics/` prefix (2026-11-04) |
| YAML/JSON parse | the corpus is a build input; a stray quote breaks every consumer |
| `tools/check-contracts.ps1` counters + the undocumented-property ratchet | a contract folder advertising a file nobody wrote (`PENDING CONTRACT FILES` reads the names out of `schemas/README.md` and looks for them on disk); a new field arriving with no description (ratchet 110/279, down-only) |
| `tools/check-vocabulary.ps1` compares every declaration of the two shared vocabularies | two namespaces spelling one concept differently, which nothing noticed for weeks: the DDL's change-kind CHECK and the contract's `kind` enum shared **no** value names, and `hard_stop` stood in two CHECKs while 25 knowledge lines said `hard-stop`. It compares change kinds and tiers pairwise, exits 1 on a mismatch, and fails loudly if a constraint is renamed — and it was red on the real disagreement before it was green (2026-11-04) |
| `tools/validate-contracts.py` validates one instance per contract and requires every contract to reject at least one deliberately invalid instance | a contract that no machine ever ran: `schemas/json/*.json` was parsed and compared but never used, so a required field could be misspelled, an enum value unreachable, or an `if/then` rule vacuous and every other check here would still pass. Its first run was red on a bad fixture, and the coverage check fails when a contract has no fixtures or a directory has no negative case (2026-11-04) |
| `ddl`: apply `schemas/sql/schema.sql` on Postgres 16 inside a transaction that is rolled back, prove nothing persisted, apply for real, then read the security claims out of the catalog (`tools/check-claims.sql`) | "the schema loads" was being reported as "the schema isolates". Both purge defects this file carried were *silent successes*: a `SECURITY DEFINER` purge ran as the table owner, matched no policy, deleted nothing and reported success; and a missing `for select` policy gave the `DELETE` an always-false filter, so it removed zero rows and returned zero. Neither is visible to a linter (both 2026-11-03) |
| No personal absolute path in `tools/` | the audit that hardcoded the machine it was written on: green on a laptop, red on the runner (happened 2026-11-03) |
| Every link target is **committed**, with the right case | an unanchored `data/` in `.gitignore` hid `docs/data/` from git; seven documents cited it and the local audit still said zero (happened 2026-11-03) |
| Every claim a setup tool makes is **read back by value, and polled** | five separate untruths in two days: 35 printed successes that created nothing (`@Args` splatted the empty automatic `$args`); a `PATCH` containing the invented field `rebase_merge`, answered 200 with no change; a single read that returned the pre-patch value because settings are eventually consistent; a verifier asking whether `enforce_admins` *existed* -- toggles arrive as `{enabled: …}`, so existence is always true, and it printed "on" for `false`; and `require_codeowner_reviews`, an invented name that left code-owner review off for a month while the tool reported protection "up to date" (all 2026-11-03) |
| A setting the API will not store is **deleted from the claim, not polled harder** | `block_creations`: sent `true`, answered 200, still `false` after 30 s of polling. The per-field verifier turned that into a permanent red, which is the only honest outcome -- the repository either has the control or the page stops listing it (2026-11-03) |
| A one-line API answer is read as **raw text**, not through a property chain | `GET /pulls/7/requested_reviewers` answers `{"users":[…],"teams":[…]}`; the code counted `.requested_reviewers`, which does not exist, got `$null`, and `@($null).Count` is 1 in PowerShell -- "1 requested reviewer" reported from an empty list. Wrong field plus truthy absence is the quietest way to invent a fact (2026-11-03) |
| A control is claimed only as far as it is **distinguishable from no control** | `require_code_owner_reviews=true` and a plain 1-approval rule produce identical observable output when the only code owner is the author; PR #8 tried to see the difference and could not. The page therefore says "stored and read back", not "gated", until a second maintainer makes it mean something (2026-11-03) |
| Every gate counter has been **forced to fail once**, by breaking the thing it measures | `tools/check-claims.sql` first shipped with its queries scoped to schemas that hold no tenant tables: it printed a clean bill of health for a database it had never looked at. `PENDING CONTRACT FILES` was exercised with a fake contract name in `schemas/README.md` before anyone believed its zero. A counter nobody can move is a counter nobody should trust (both 2026-11-03) |
| `last_reviewed` age + `status` values | knowledge rotting invisibly while code ships |
| Golden plans (`eval/golden-plans/`) | a "small tweak" that quietly rewrites 40 km of someone's week |
| `en` vs `zh-Hant` key parity | half the users getting fallback strings in their system comment |
| Narrator banned-output suite | diagnosis, weight/calorie language, guarantees, shame -- in prose, in both languages |

Two of these rows deserve a footnote about how they fail. `tools/audit-links.ps1` is a *reporter*: it
exits zero whatever it finds and prints six counters, because it is meant to be run by hand in the
middle of an edit without punishing the run. The `knowledge` job parses those numbers and fails the
build. `tools/check-contracts.ps1` does the opposite and exits 1 on a red counter. That inconsistency
is real, and it survives only because CI parses both outputs rather than trusting either status --
which is itself a reason to read counters, not exit codes, when a build goes red.

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
