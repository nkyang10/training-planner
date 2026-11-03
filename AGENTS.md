# Working rules for this repository

Read `knowledge/MAINTENANCE.md` before touching `knowledge/`.

## What this project is
A per-user web app: daily running plan → daily calendar feedback → system comment → reviewable
rewrites of the future plan. Correctness of the **planner** and honesty of the **comment** are the
two things that must never regress.

## Hard rules

1. **The planner is a pure, deterministic function.** No wall clock, no `Math.random()`, no I/O,
   no network, no LLM inside `packages/planner-core`. Time, randomness, and knowledge come in as
   arguments (`clock`, `seed`, `knowledgeBundle`). Same inputs ⇒ byte-identical plan. Tests rely on
   this; so does explaining a past plan to a user months later.
2. **The LLM only produces language.** It may phrase a comment or a review narrative from a
   structured fact object. It never chooses a distance, a pace, a rest day, or a threshold. If a
   number is in an LLM output, the build is wrong.
3. **Safety rules can only subtract.** `knowledge/heuristics/safety-hard-stops.yaml` may remove or
   downgrade a session. Nothing in the safety layer may add intensity. Hard stops are not
   user-overridable by a tap; override requires an explicit recorded acknowledgement.
4. **Never change the past.** Completed days are append-only facts. A review may rewrite *future*
   sessions only. (Editing history destroys the meaning of every derived metric.)
5. **Two changes per review, maximum.** Prefer one. Every change is recorded with its reason, the
   signal that triggered it, and its expected cost.
6. **Health-data humility.** No weight targets, no calorie or diet prescriptions, no diagnosis, no
   guarantees. Medical topics end with a clinician-referral section.
7. **Per-user isolation is a design input, not a later patch.** Every table carries `user_id`;
   Postgres row-level security is on by default; cross-user reads are only possible through
   explicitly aggregate, opt-in analytics.
8. **i18n from day one**: English and Traditional Chinese. Every user-facing string lives in a
   message catalogue with the coaching-tone rules in `docs/ux/feedback-microcopy.md`.

## Conventions

- Markdown: one idea per paragraph, takeaways first, `Facts` vs `Practice` vs `Controversies`
  separated (mirrors the knowledge format).
- Dates in docs are absolute ISO (`2026-11-03`), never "next week".
- Decisions that are expensive to reverse get an ADR in `docs/adr/NNNN-*.md`. Never edit an
  accepted ADR — supersede it with a new one.
- `research/` drops are immutable. Wrong research stays visible; the correction goes in a newer
  drop and is linked forward.
- Numbers in `knowledge/heuristics/*.yaml` are tuning knobs. Each knob needs `range` (sane bounds
  the engine clamps to) so a typo cannot generate a 40 km threshold session.

## Definition of done for a planner change

Golden plans in `eval/golden-plans/` still pass, plus at least one new fixture encoding the reason
for the change, plus the prose rule file updated and `last_reviewed` bumped.
