# Contributing

Start with [AGENTS.md](AGENTS.md) (eight hard rules) and [knowledge/INDEX.md](knowledge/INDEX.md)
(what the corpus contains and what it admits it does not). Then
[docs/engineering/branching-and-github.md](docs/engineering/branching-and-github.md) for how a branch
is named, stacked, reviewed and merged. When two contracts spell the same thing differently — a tier,
a change kind, a day's status — the decision is already recorded in
[docs/engineering/contract-vocabulary.md](docs/engineering/contract-vocabulary.md); add to it before
inventing a third spelling.

## Pick up work

1. Find or file an issue; label it `area/*` + `type/*`, add `risk/safety` if it touches a stop rule.
2. `gh issue develop <n> --checkout` creates the branch off `main` (or off its spine).
3. Work small. A leaf branch that survives three days gets cut, not extended.

## Before you open a PR

```pwsh
& ./tools/audit-links.ps1        # must print six zeros and the backlink total
```

Run it **here**, not only in CI: `UNCOMMITTED CORPUS FILES` asks whether a document exists on your
disk but not in git, and a fresh clone -- where CI runs -- cannot ask that question.

Then, depending on what you touched:

- **`knowledge/heuristics/**`** -- one number, one home (a pointer or `extends:`, never a copy); new
  knob has `range` + `confidence` + `provenance.sources` that resolve in
  `knowledge/sources/bibliography.md`; `last_reviewed` bumped; prose updated in the same PR.
- **`packages/planner-core/**`** -- pure and deterministic: no clock, no randomness, no I/O, no LLM.
  Golden plans pass, plus **a new fixture that encodes why the change exists**. Re-baselining an
  expectation without a written decision in the PR is a reject.
- **Anything user-facing** -- both catalogues (`en`, `zh-Hant`), and the tone rules in
  `docs/ux/feedback-microcopy.md`: no shame, no diagnosis, no weight, no guarantees.
- **The narrator** -- its output must contain no number absent from `allowedNumbers`; banned-output
  tests run in both languages.

## Things this repository refuses

Real athlete data (`.gitignore` blocks it on purpose -- fixtures are synthetic), a number invented to
fill a gap (write the gap down instead: see the honesty ledger in `knowledge/INDEX.md`), an edit to an
accepted ADR, a safety rule that adds intensity, and any change to a completed training day.
