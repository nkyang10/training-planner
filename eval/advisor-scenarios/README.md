# `eval/advisor-scenarios` — the AI reviewer's evaluation harness (ADR-0009, P4)

The advisor's gates are the product's answer to "a fluent model can be confidently wrong". This directory holds the
evidence that the gates do something: each scenario is a model answer a fluent model could plausibly produce, and
`expect` says what the deterministic validator must say about it.

| Rule | Why it is a fixture |
|---|---|
| A gate that accepts everything fails the `accepted: false` scenarios | the harness measures rejection, not only acceptance |
| A gate that rejects everything fails the two `accepted: true` scenarios | a proposal the runner should see must reach them |
| `violationContains` names the rule, not just the failure | a rejection nobody can explain is a rejection nobody can fix |
| `prompt-injection-in-a-fact-is-still-a-fact` | runner notes are untrusted text; an instruction echoed as evidence is still not a fact the request contained |

## The acceptance harness (P4b)

`apps/api/test/advisor-acceptance.test.ts` sends every scenario through the **whole route**: a real HTTP provider port
calls a local stub `http.Server`, the route parses the answer, the gates judge it, the audit row records it, and the
response says what happened. It catches what the unit harness cannot: a route that forgot to pass the runner id, a port
that mangled the answer, an audit row that was never written.

## The harness

`packages/advisor/test/scenarios.test.ts` loads `scenarios.json`, builds the request with
`buildAdvisorRequest` over a fixed plan (the same days the unit tests use), and runs `validateProposal`. It asserts the
verdict and, for a rejection, that the named rule appears in the violations.

## What this does not cover

- The model itself: no provider is called (ADR-0009 P3 needs deployment credentials). The scenarios are the *contract*
  the provider will be measured against.
- Real runner language: adversarial notes are represented by the *claim* they would produce, not by a corpus of notes.
- The plan-side safety rules: those are covered by `packages/planner-core`'s invariants and golden plans.

Adding a scenario is cheap and should follow a failure: when a proposal reaches a runner and the advice is wrong, the
first question is which gate should have caught it, and the answer becomes a fixture here.
