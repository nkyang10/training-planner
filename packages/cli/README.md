# packages/cli

The headless entry point: generate a plan, diff two versions, explain a block, and run the nightly sweep once.

```bash
npx tsx packages/cli/src/index.ts gen --fixture eval/golden-plans/novice-5k.json --out plan.json
npx tsx packages/cli/src/index.ts diff --from plan.json --to plan-v2.json --created 2026-11-05 --reason "review"
npx tsx packages/cli/src/index.ts explain --version plan.json --weeks --locale zh-Hant
npx tsx packages/cli/src/index.ts sweep --fixture eval/golden-plans/novice-5k.json --today 2026-11-12
```

Knowledge is always read from `knowledge/heuristics` and never from a flag: a plan that could name a knowledge
version this repository does not have would be unexplainable by construction.

## The four commands

| Command | What it is for |
|---|---|
| `gen` | generate a plan from a golden fixture and write the contract-valid version; `--canonical` prints the canonical JSON so two runs can be compared byte for byte |
| `diff` | the stored parent→child diff of two plan files, with the freeze rule and the two-change limit applied |
| `explain` | the plan in the runner's language: `--weeks` prints the explanation (`3.9 km over 4 days, which is 6.8 km at a full week's rate`), `--locale zh-Hant` switches language |
| `sweep` | `packages/worker`'s nightly sweep once, read-only: what would close, what is pending, and the cache key of the signal bundle |

## Why the CLI is part of the product, not a dev toy

- **It is how a plan is explained months later.** The same `explainWeekLines` the web page uses is reachable from a
  shell, against a stored version file, with the same guardrails.
- **It is how a knowledge change is checked.** `gen --canonical` is the byte-comparison that proves a rule change
  moved only the plans it should have.
- **`sweep` submits its `--entries` drafts through the real entry pipeline**, so the demo cannot diverge from the
  product: a draft the pipeline would refuse is printed as a refusal, not silently skipped.
