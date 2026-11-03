# ADR-0004: Immutable plan versions with stored diffs

Status: accepted
Date: 2026-11-03

## Context

A plan is edited repeatedly: rolling refinement, missed sessions, reviews, safety cancellations, the
runner changing their availability. If we mutate one mutable calendar, three things break: we cannot
explain a past decision, we cannot tell the runner what changed (trust depends on seeing it), and a
planner bug silently rewrites history. Editing a past session also destroys every derived metric —
adherence, load, monotony — because those are comparisons of *prescription* against *actual*.

## Decision

`plan_versions` are **immutable once active**. Any change creates a child version
(`parent_version_id`, `reason`, `created_from_review_id`) plus a **stored diff** (`plan_diffs`) whose
`from_day` is always ≥ the first not-yet-executed day. `session_occurrences` on past days belong to
the version that was active then and are never rewritten; micro-adjustments to a *future* day are
`session_overrides` layered on top, so "what was prescribed" and "what we ended up advising" are both
answerable. See [data-model](../data/data-model.md#planning) and
[feedback-loop](../engine/feedback-loop.md).

## Consequences

**Buys:** "why did October look like this?" is a query, not an archaeology project; the review screen
can show a real, inspectable diff (which is what makes adaptation feel safe rather than spooky);
planner upgrades are replayable — regenerate old inputs with the new bundle and compare, which is how
rule changes get validated; per-version `plannerVersion` + `knowledgeHash` make bug reports
reproducible.

**Costs:** version count grows (mitigated: only user-visible or materially different generations
create versions; day-level refinement is an override, not a version); the "effective plan" is a join
(`base + overrides`), so it needs a materialised view and tests; storage is append-heavy (fine at
this volume); a small learning curve for developers tempted to `UPDATE`.

**Forecloses:** any feature that edits the past; silent adaptation.

**Revisit when** we offer multi-sport or multi-goal plans where versions branch rather than chain —
then the DAG is real and needs an explicit merge story for shared days.
