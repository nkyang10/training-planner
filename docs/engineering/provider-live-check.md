# Live provider check — 2026-11-04

This records what a **real** provider actually returned, not what the tests expect. The endpoint is the owner's
OpenAI-compatible server (`http://192.168.1.202:8102/v1`); the key is supplied at run time through
`TRAINING_PLANNER_MODEL_API_KEY` and is **never** written to this repository or to this document.

The check is `eval/live/provider-live-check.ts`, run manually:

```
$env:TRAINING_PLANNER_MODEL_BASE_URL = "http://192.168.1.202:8102/v1"
$env:TRAINING_PLANNER_MODEL_API_KEY  = "…"        # supplied at run time, never committed
$env:TRAINING_PLANNER_MODEL_NAME     = "dgx/general"
npx tsx eval/live/provider-live-check.ts
```

It builds the advisor request for two **simulated** runners, calls the port, and runs the deterministic gates on the
answer:

| Case | Simulated runner |
|---|---|
| `fresh` | no entries: the honest answer is no-change |
| `struggling` | skipped two planned sessions (`2026-11-03` work, `2026-11-05` sleep), one completed session at RPE 8 |

## Observed

### `llm-main-default` (serving DeepSeek-V4.1-Flash-TF), first attempt

The provider answered prose-shaped JSON that added keys the contract does not read:

```json
{ "decision": "no-change", "reasonCode": "no-action-needed", "changes": [], "explanation": "…" }
```

The gates **rejected** it:

```
proposal does not satisfy the advisor contract: facts: Required; proposedChanges: Required;
confidence: Required; needsHuman: Required; proposal: Unrecognized key(s) in object: 'changes', 'explanation'
```

Fallback: `deterministic-replan`. This is the validator doing its job: a model that adds an `explanation` field is a
model whose output nobody can audit, and the product does not silently accept it.

### `dgx/general`, after the system prompt was tightened to the exact contract

The prompt now names the exact keys (`decision`, `reasonCode`, `facts`, `proposedChanges`, `confidence`,
`needsHuman`) and the vocabularies. Both simulated runners then produced **contract-valid** answers:

| Case | decision | needsHuman | gates | elapsed |
|---|---|---|---|---|
| `fresh` | `no-change` | `false` | **accepted** (0 violations) | 2.1 s |
| `struggling` | `no-change` | `true` | **accepted** (0 violations) | 3.0 s |

The `struggling` case's `needsHuman: true` is the model's own claim; the gates accepted a no-change decision with that
flag, which is allowed. The check records behaviour, not correctness: it does **not** establish that the model's
judgement is good, only that the claim path works end to end and that the gates judge what the model says.

Both runs wrote the same guideline hash (`sha256:f787…3029d`) and knowledge hash (`sha256:99cd…acf3`); the prompt hash
differed between the two cases (`sha256:5bbe…9189` vs `sha256:02c7…91ce`), as it should: the two runners' contexts
differ.

### `llm-main-default`, after the prompt change

Re-run with the same two simulated runners: both answers were contract-valid and the gates accepted both.

| Case | decision | needsHuman | gates | elapsed |
|---|---|---|---|---|
| `fresh` | `no-change` | `false` | **accepted** (0 violations) | 1.6 s |
| `struggling` | `no-change` | `true` | **accepted** (0 violations) | 2.5 s |

So the first `llm-main-default` rejection was a **prompt/contract mismatch**, not an endpoint problem: the same model
answers the same way once the system prompt names the exact keys. Both models are usable; neither was asked to decide
anything the gates had not first bounded.

## The scenario harness (`eval/live/scenario-live-check.ts`)

A second manual harness sends the **context** of all 10 `eval/advisor-scenarios` to the real model (the fixture's
expected proposal is not sent) and runs the deterministic gates on whatever comes back. One run on 2026-11-04 with
`dgx/general`:

### Before the grounding fix

| Result | Count | Cause |
|---|---|---|
| accepted | 1 / 10 | only the safety scenario's `no-change` |
| rejected | 9 / 10 | 8 × `fact maxChanges carries 2, which the request did not contain`; 1 × `proposedChanges.0.costSlots: Expected object, received array` |

The first rejection was a **gate bug, not a model hallucination**: `vocabulary.maxChanges: 2` *is* in the request, but
`contextNumbers` only collected planned kilometres, entry numbers and signal values. The gate said "the request did not
contain" a number the request contained.

### The fix

- `packages/advisor/src/validate.ts`: `contextNumbers` now collects **every number anywhere in the request** (the
  request is what the model was shown). The rule is unchanged; its implementation is now true.
- The provider's system prompt now says facts must describe the runner or the plan and must not cite vocabulary limits,
  and that `costSlots` is always an object (`{"days": 2}`), never an array.
- Two new advisor tests pin both directions: a fact citing `vocabulary.maxChanges` is **accepted**; a number that appears
  nowhere in the request is still **rejected**.

### After the fix

| Result | Count |
|---|---|
| accepted | **10 / 10** |
| rejected | 0 / 10 |
| errors | 0 / 10 |

Nine answers were `no-change`; the high-pain scenario produced `propose-change`, and the gates accepted it. "Accepted"
means **contract-valid and gate-clean**, not "the model made the right call": a `no-change` answer is a legitimate
decision, and the fixtures' expected proposals describe the fixture proposals, not the model's judgement.

## What this does and does not establish

| Established | Not established |
|---|---|
| The real endpoint answers, and the port's base-URL → `/chat/completions` mapping works | That the model's decisions are clinically right |
| The deterministic gates reject a contract-violating real answer and accept a contract-valid one | That a production deployment is configured (the key is supplied per run, not deployed) |
| The whole claim path works with a real provider: request → call → parse → gates → verdict | Anything about a real runner (the runners here are simulated) |
| The live script is not part of CI and cannot leak the key | The five M2 criteria (they need real runners) |
