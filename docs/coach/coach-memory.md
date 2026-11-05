# Coach memory: references for AI review comments and advice

The coach's "memory" is a small, curated corpus of **reference passages** drawn from this repository's own research and
rules, plus the runner's recent facts. It is not a vector database, not embeddings, and not a network call: selection is a
pure function, so two identical contexts select the same passages and an audited review can prove what the model saw.

## What it is

| Piece | Where | What it does |
|---|---|---|
| Corpus | `packages/coach/src/corpus.ts` | 9 passages, each with a **real** `sourcePath` + `sourceHeading` in this repo, tags, tier (`safety` / `training` / `tone`) |
| Selection | `packages/coach/src/select.ts` | deterministic, at most **4** passages; pain pulls safety/pain, missed sessions pull review/load, a high RPE pulls load, comments always carry tone; safety sorts first |
| Hash | `packages/coach/src/hash.ts` | `sha256:` of the canonical reference list, carried as `hashes.referenceHash` |
| Advisor request | `packages/advisor/src/types.ts` | `system.references[]` + `hashes.referenceHash`; the model sees guidance, the validator still owns every gate |

The API's advisor route selects references from the runner's recent facts and passes them into `buildAdvisorRequest`, so
the model's review comment/advice is grounded in the same documents a human reviewer would read.

## What it is not

- **Not authority.** A reference cannot justify a new number: the validator's grounding check only accepts numbers from
  the request's facts, and references are not added to `contextNumbers`.
- **Not safety policy.** Safety references outrank training ones in selection and in the prompt rule, but the
  subtract-only hard stops remain the enforcement; a passage is never an override.
- **Not a second knowledge base.** The corpus cites repository files; the external literature map is
  [review-evidence.md](review-evidence.md) and is not a corpus.

## Prompt rule

The request's rules gain one sentence: references are guidance for language, never permission to change a number, and a
safety reference outranks a training reference. A review that cites a reference to justify an invented distance still
fails `validateProposal`.
