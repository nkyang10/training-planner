---
status: accepted
last_reviewed: 2026-11-04
---

# Contract vocabulary: one concept, one spelling

**Takeaway.** Four contracts — `knowledge/heuristics/*.yaml`, `schemas/json/*.json`,
`schemas/sql/schema.sql`, and the prose in `docs/` — describe the same runner, the same review, and
the same safety stop, in four different sets of words. This page is the reconciliation: every
measured disagreement, the decision, and the order to apply it. It exists because a runner does not
read four documents: they see one number, one label, and one reason, and any place where the four
disagree is a bug they will find before we do.

**Method.** Nothing below was remembered. Each item was measured today with
`Select-String` over the four namespaces, and where a runtime was reachable the executed artefact
wins (Postgres 16 in Docker, `tools/check-contracts.ps1`, `tools/audit-links.ps1`). Two of the items
started as "a typo in the doc" and turned out to be a contradiction that could only fail at runtime.

**Standing rule this page enforces.** A document that restates a column list rots: `data-model.md`
rotted within days of `schema.sql` existing. The executed artefact owns the *spelling*; prose owns
the *reason*. Where prose must name a field, it names it once and points at the artefact.

---

## The decisions

| # | Concept | Measured disagreement | Decision |
|---|---|---|---|
| 1 | Phase dates | DDL `phases.start_day / end_day` (schema.sql:402) vs doc `phases(start, end)` | DDL wins: `end` is a reserved word, and `start_day`/`end_day` match `plan_versions.first_day / last_day`. Doc fixed here. |
| 2 | Weekly volume unit | DDL `volume_km numeric(6,1) 0–500 / longest_run_km 0–100` (schema.sql:419) vs doc `volume_m / longest_run_m` | DDL wins: a runner plans in km, and the `0–500` bound is only sane in km. `activities.distance_m` stays **metres** — store in the unit the *source* speaks, present in the unit the *runner* speaks. Doc fixed here. |
| 3 | What opened a review | wire `review.openedBy` (5 kebab values, review.schema.json:15) **and** a required `review.trigger` *object* of evidence (review.schema.json:16-24) vs DDL `reviews.opened_by` vs doc `trigger (user_intent\|rule)` | Three different things wearing two names. `openedBy` ↔ `opened_by` is already exact. The wire's `trigger` object is not a trigger, it is the **evidence** the review was opened on → rename to `evidence`. DDL keeps `rule_id` + `evidence_snapshot` + `evidence_hash`. Doc fixed here; the rename is item R2. |
| 4 | Review decision vocabulary | DDL `('suggested','open','accepted','declined','deferred','expired')` (schema.sql:560) vs wire `["open","accepted","rejected","expired","superseded"]` (review.schema.json:47) | One set: `open / accepted / rejected / deferred / expired / superseded`. Drop `suggested` — no such moment exists, a review row is created when it opens. `declined` → `rejected`: the runner's own word, and it carries no judgement. Add `deferred` to the wire (snooze is a real answer: "ask me Friday" must be recorded, not lost) and `superseded` to the DDL (a new trigger merges into the open review, `heuristics/review-triggers.yaml#dwell_days`). |
| 5 | Safety tier spelling | knowledge `severity: hard-stop` **20 lines / 15 files** vs `severity: hard_stop` **5 lines / 1 file** (`safety-hard-stops.yaml:41,50,58,67,75`); DDL `tier in ('advisory','constraint','hard_stop')` (schema.sql:616) and `reviews.severity` (schema.sql:559); wire `["constraint","hard-stop","advisory"]` (plan-version.schema.json:92) | **Tiers are kebab: `advisory / constraint / hard-stop`.** Rule 7 (schemas/README.md) makes kebab the wire default without an exception flag, and 20 of the 25 knowledge values already comply — the minority is two places, not a migration. |
| 6 | `severity:` holds verbs, not tiers | knowledge `severity:` values today: `constraint` 72, `hard-stop` 20, `advise` 18, `warn` 6, `flag` 6, `hard_stop` 5, `constrain` 4 (= **131 lines, 7 vocabularies**). Neither the DDL's 3 tiers nor the wire's 3 tiers admits `advise`, `warn`, `flag`, or `constrain`. | `severity:` holds **tiers only**. The action already lives in `then:` — measured: `flagReview(...)` (review-triggers.yaml:103), `delete(missed)` / `swap(...)` (missed-session-rules.yaml:79,85), `constrain(next_7d: ...)` (safety-hard-stops.yaml:83), `hard_stop(today)`. Mapping: `advise / warn / flag → advisory`, `constrain → constraint`, `hard_stop → hard-stop`. Today **54 of the 131 values would be rejected by the DDL CHECK the first time a rule writes its row**, and the DDL's `advisory` appears in *no* knowledge file: the two contracts have never met. |
| 7 | Change kinds in a diff | DDL `plan_diff_changes.change_kind` = 12 dotted values (`session.removed`, `distance.reduced`, …, schema.sql:513) vs wire `plan-diff.schema.json:39 kind` = 7 kebab verbs (`drop-session`, `change-dose`, …). The DDL comment (schema.sql:522) claimed its list "is exactly the subtractive half of `change.kind` in `plan-diff.schema.json`" — **false: the two lists share no value names.** | The **12 dotted values become the single change-kind vocabulary**; the wire adopts them with `x-verbatim-enum-values` (rule 7's visible exception), and the wire's 7 verbs become narrative labels, not data. Reason is AGENTS rule 3, not tidiness: the wire's coarser `change-dose` can describe *raising* a distance, so a change flagged `isSafety` could increase load and still satisfy `changes_are_subtractive_or_not_safety` — the one constraint that encodes "safety only subtracts" would be decorative. The subtractive subset is then declared once (`x-subtractive-change-kinds`) and mirrored by the CHECK. |
| 8 | Day vocabulary | `session_occurrences.state` = `planned/adjusted/cancelled/done` (schema.sql:445) vs `day_entries.status` = `rest/completed/partial/skipped/missed` vs wire plan-day `status` = `planned/completed/missed/skipped` (plan-version.schema.json:49). The DDL comment (schema.sql:452) asked for **one** vocabulary "in four places". | The comment was wrong: these are **two axes**, and one vocabulary would lose either `adjusted` (what the plan did) or `partial` (what the runner reported). Keep two, name them apart: `state` = the plan side, unchanged; the reported axis is **outcome** = `rest / completed / partial / skipped / missed`, and the wire's plan-day `status` renames to `outcome` with `planned` added for a day that has not arrived. Comment rewritten here. |
| 9 | Knowledge-bundle identity | DDL `plan_versions.knowledge_hash` (no pattern CHECK) vs wire `signal.knowledgeHash` (`^sha256:[0-9a-f]{64}$`, signal.schema.json:8) vs wire `knowledgeBundleVersion` in plan-version.schema.json:22 and plan-diff.schema.json:31, described as "stored as `plan_versions.knowledge_hash`" | **`knowledgeHash` / `knowledge_hash`.** The value is a digest; a field called *version* invites `2026.11`, which the pattern rejects, and the same 32 bytes already have a name elsewhere. Separately: `inputs_hash` and `evidence_hash` both carry `^sha256:…` CHECKs and `knowledge_hash` — the column that makes a plan reproducible (AGENTS rule 1) — carried none. Fixed here. |
| 10 | Plan lineage | wire `supersedesVersionId`, described as "Stored as `plan_versions.parent_version_id`" (plan-version.schema.json:14 vs schema.sql:365) | **`parentVersionId` / `parent_version_id`.** One name, one direction; the tree is the truth and "replaces" is something prose says about it. Rule 7's camel↔snake mirror becomes mechanical again. |
| 11 | Cross-training | wire kind `cross-training` (plan-version.schema.json:48) vs knowledge session-class key `cross-train` (session-classes.yaml:31) vs prose that says "cross-training" and rule ids like `substitute-cross-train` (session-substitution.yaml:71) | Two namespaces, kept apart on purpose: a *wire kind* and a *knowledge session-class id* are not the same identifier, and `substitute-cross-train` is a live rule id that prose backlinks point at (133 of them, audited). Rename neither; record the mapping here until codegen owns it. |
| 12 | `events` | doc `actor (user\|system\|worker)` and "**partitioned monthly**" vs DDL `actor in ('runner','system','worker','import','support')` (schema.sql:207) and an explicit deferral of partitioning (schema.sql:231) | DDL wins on both. Five actors because *who wrote it* decides whether a row can be corrected (an `import` may be re-run; a runner's word may not). Partitioning is deferred to the storage ADR; the doc and the retention section stop promising a monthly partition that does not exist. |
| 13 | `day_entries` shape | doc `pain jsonb`, `revisions jsonb` vs DDL: neither column exists — pain is `pain_reports`, a revision is a **row** keyed `(user_id, day, revision)` with `superseded_by`, read through the view `day_entries_current` (schema.sql:297) | DDL wins; the doc's `jsonb` fields describe a design that was replaced by the supersede pattern. Doc fixed here. |
| 14 | Pace estimates | doc `expires_at`, and "cannot overlap for a `(user_id, distance)` with `valid_to` set" vs DDL `anchor_day / valid_from / valid_to` and `create unique index pace_estimates_no_overlap … where valid_to is null` (schema.sql:686) | DDL wins, and the doc said the **opposite** of the index: the partial unique index guarantees one *open* estimate per distance; closed ones may overlap freely, because a pace estimate is a claim about a window, not a row that expires. Doc fixed here. |
| 15 | The auditor's blind spot | `tools/audit-links.ps1` collects citations written as `heuristics/<file>.yaml#<anchor>`. Measured: **14** citations in the corpus name a heuristics file without that prefix, so the auditor never looks at them — and **2 of those 14 were dead**: `schemas/README.md:57` cited `#freeze_days` (the real knob is `freeze_window_days`) and `docs/ux/calendar-and-time.md:49` cited `#travel-*` | Cite with the prefix, because the prefix is what makes a citation *checked*: a rule nobody verifies is not a rule, it is a wish. Both dead citations are fixed here. The auditor itself is widened in item R5 to match `<known-heuristics-file>.yaml#<anchor>` with or without the prefix — the widening goes in its own commit because it is a gate change, and a gate change must arrive with proof that the new counter can fail. |
| 16 | A citation to a rule that was never written | `docs/ux/calendar-and-time.md:49` promised jet-lag-aware session placement "(`missed-session-rules.yaml#travel-*`)". Measured across `knowledge/heuristics/*.yaml`: there is **no travel rule in any file**; the nearest knobs (`#swap_window_days`, `#race_week_no_long_run_swap_days`) move a session inside a week and know nothing about time zones. | A backlink may only point at an anchor that exists. Unimplemented intent points at the backlog instead — the sentence now names the two real knobs, says plainly that the zone thresholds are design intent with no codified rule, and links item 11 of [roadmap/backlog.md](../roadmap/backlog.md). AGENTS rule "a rule cannot reach the planner without a prose file, a source grade, and a golden test" has a corollary this corpus had no check for: **prose must not cite a rule that has no yaml.** |
| 17 | A constraint claimed for four tables that only three have | `docs/data/data-model.md` claimed `events`, `day_entries`, `plan_versions`, `system_comments` "have no UPDATE/DELETE grants". Read back from a fresh load of `schema.sql` on 2026-11-04: three of them have no `UPDATE`/`DELETE` policy at all, but `plan_versions` has `plan_versions_update` and `plan_versions_delete` for `app_user,worker`; what protects it is the trigger `plan_versions_immutable` (`before update`, once the version is `active`), which is a *weaker and different* guarantee — a draft is editable on purpose | Say which mechanism enforces which table. The same sentence written as one flat list reads as "the database forbids editing plans", which is false in the exact case a runner cares about: the plan they are running now can still be edited if it has not been activated. Recorded here because the correction is worth more than the fix — a claim about enforcement should name the enforcement |

## Applying the decisions

Renames are listed separately because they change identifiers, and an identifier rename after the
first deploy is a migration with a replay fixture. Right now no payload exists, so each one is a
search-and-replace — which is exactly the argument for doing them in order rather than opportunistically.

| Order | Branch | Scope | Why it must be its own change |
|---|---|---|---|
| done here | `docs/contracts-vocabulary` | this file; `docs/data/data-model.md` items 1, 2, 3, 8, 12, 13, 14; `schema.sql` items 1, 2, 8, 9 (comments + the `knowledge_hash` CHECK) and the recorded decisions for items 6 and 7 written where the TODOs were; the two dead citations of items 15–16; links from `README.md` and `schemas/README.md` | prose and comments cannot disagree with the executed artefact after this commit |
| R2 | `chore/contracts-vocabulary` | `schemas/json/`: `knowledgeBundleVersion → knowledgeHash`, `supersedesVersionId → parentVersionId`, `review.trigger → review.evidence`, plan-day `status → outcome`, change-kind dotted + `x-verbatim-enum-values` + `x-subtractive-change-kinds` | contracts only, so the ratchet in `tools/check-contracts.ps1` moves in one reviewable step |
| R3 | `knowledge/tier-vocabulary` | the 39 knowledge `severity:` lines that are not tiers (items 5, 6) | read `knowledge/MAINTENANCE.md` first and bump `last_reviewed`; knowledge PRs stay separate from code and docs PRs (branch model rule), and this one touches 20 files of the corpus that the runner-facing voice is built from |
| R4 | `feat/data-tier-vocabulary` | DDL CHECKs to `advisory / constraint / hard-stop`, `reviews.status` to the item-4 set, `plan_diff_changes.change_kind` mirror of `x-subtractive-change-kinds`, plus a gate that the DDL's subtractive list **equals** the declared one (ruler outside `schemas/`, like `check-claims.sql`) | immediately after R3, same milestone, nothing interleaved: the knowledge values and the CHECK that accepts them must never land on `main` in an order where they disagree |
| R5 | `chore/audit-anchor-prefix` | widen the anchor regex in `tools/audit-links.ps1` to any `<heuristics-file>.yaml#<anchor>` and add the `BAD TIER VALUES` counter from item 6 | a gate change is judged by its ability to fail: the commit must show a planted bad citation and a planted bad tier turning the counters red, then remove them |

Items 4, 5, 6, 7, 8, 9, 10 are **not** cosmetic. Each is a place where a runner-facing value could
be written in one namespace and read in another, and the reader would either crash (item 6), accept
an illegal change (item 7), or silently store a string that no validator admits (items 9, 10).

## What keeps this true

* `tools/check-contracts.ps1` — wire keys camelCase, wire enum values kebab unless declared with
  `x-verbatim-enum-values`, undocumented-property ratchet. Exits 1.
* `tools/audit-links.ps1` — anchors, source ids, dead links, untracked targets. Prints counters and
  **always exits 0**; CI parses them (see branching-and-github.md). It only sees anchors written with
  the `heuristics/` prefix (item 15), so today a bare `load.yaml#monotony_flag` citation is unchecked.
* `tools/check-claims.sql` — isolation claims read out of the live catalog, deliberately outside
  `schemas/`: the thing that reports must not be the thing that believes.
* **Not yet gated:** the tier vocabulary across namespaces (R3+R5's counter), the claim that
  the DDL's subtractive list equals the declared one (R4), and citations of anchors written without
  their prefix (R5). All three are written above as work rather than described as controls that do not
  exist — the rule this repo keeps re-learning is that a control nobody can distinguish from no
  control is not yet a control.

## Two words that stay different on purpose

* `hard-stop` is a **tier** (a noun: how loud the system spoke). `hard_stop(...)` is a **verb**
  inside `then:` (what it does), and that mini-DSL is snake_case throughout (`no_training_suggestion`,
  `all_future_sessions_in_phase`). Only the tier crosses into the wire and the database.
  `ADR-0007` says a `hard_stop` comment must include the referral line — it is talking about the verb,
  and accepted ADRs are never edited (AGENTS.md conventions), so its spelling stands.
* `review-triggers.yaml`'s `flagReview(...)` and the note "this becomes a `constrain`, not a review"
  (review-triggers.yaml:118) read as verbs before and after item 6, so that sentence stays true.
