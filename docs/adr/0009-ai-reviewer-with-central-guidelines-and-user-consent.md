# ADR-0009: AI reviewer with central guidelines, a user console, and consent-gated changes

Status: accepted
Date: 2026-11-04
Supersedes: ADR-0001 (review path only), ADR-0007 (review path only)
Superseded by: —
Involved: product owner (direction D), build agent (design and evidence)
Alternatives considered: (a) keep the deterministic-only reviewer (status quo), (b) a human coach reviewing every
plan, (c) AI writing language only (ADR-0007's current scope), (d) AI deciding whether a review is needed while the
runner decides whether to accept it — chosen.

## Context

ADR-0001 chose a deterministic planner with statistical calibration and kept the LLM for language only; ADR-0007
specified that language path with a template fallback. Both were written when the product's trust surface was one
comment and a bounded micro-adjustment, and both were correct for that scope.

The product owner has directed a different review shape (**direction D**):

- the **AI model decides** whether the future plan needs to change, using the runner's own choices, the plan, and
  what actually happened;
- the AI **never applies** a change: the runner accepts, declines or defers, exactly as today;
- a **central guideline layer** controls the AI's quality. Safety guidelines are **hidden** from runners; style and
  training guidelines are **public**. One operator (admin) role writes them, versioned and immutable;
- a **user console** lets the runner provide more information than the guidelines assume, and an onboarding
  **wizard** records their choices step by step. Choices are revisitable, with an original-versus-current view;
- when a runner's preference and a master guideline conflict, the order is
  **safety / non-negotiable master > master constraint > user preference**.

The forces this must respect are the ones the repository already treats as non-negotiable: safety rules subtract
only (AGENTS rule 3), the past is never rewritten (rule 4), a review proposes at most two changes (rule 5),
health-data humility (rule 6), per-user isolation (rule 7), i18n from day one (rule 8), and consent plus data
boundary for any hosted model (ADR-0006).

## Decision

The review path is re-layered into three parts. Everything numeric is still decided by deterministic code; the
model's decision is **whether to propose**, not **what the numbers are**.

1. **Central guidelines (operator console).** A versioned, immutable `guidelines` table. Each row carries a `tier`
   (`non-negotiable`, `constraint`, `default`), a `scope` (`safety`, `medical`, `progression`, `tone`,
   `review-cadence`), a `visibility` (`internal` for safety, `public` for style and training), the text, the
   rationale, and the effective date. A new guideline is a new row; no row is edited. Only the `operator` role can
   read or write them; the runner-facing API never returns internal text, only a derived explanation of the effect.
2. **User console (runner).** Onboarding is a step-by-step wizard. Each answer is an append-only `wizard_answers`
   row (`step_id`, `answer` JSON, `revision`, `source: wizard | settings`), so the runner can change a choice at any
   time and still see what they originally chose. The wizard's answers are the runner's side of the comparison
   against the central guidelines; the conflict order above decides who wins.
3. **AI reviewer (new `packages/advisor`).** Input: the effective guideline digest, the runner's wizard answers and
   settings, the active plan, the entries and signals (what actually happened), the allowed change vocabulary, and
   the knowledge bounds. Output: a strict JSON proposal — `decision: "no-change" | "propose-change"`, a reason code,
   the facts it used, at most two proposed changes, their stated cost, and a confidence. The proposal then passes
   **deterministic gates**, in this order:
   - schema, numeric grounding, banned-category and locale checks (the model may not introduce a number that is not
     in the fact object);
   - `packages/review`'s invariants: future days only, at most two changes, safety subtract-only, cost stated,
     knowledge bounds;
   - the runner's decision (accept / decline / defer) — the only path that activates a plan version.
   A proposal that fails a gate is recorded and the deterministic replan path produces the options instead. The AI
   path is allowed to say "no change"; it is never allowed to say "changed".

Every AI decision writes an immutable audit row: guideline version hash, prompt hash, model id, raw output,
validator verdict, fallback flag, and the review it belongs to.

### Non-negotiables this ADR does not relax

- Safety rules remain subtract-only, and neither the model nor a central guideline may add intensity. A guideline
  can only be *more* conservative than the corpus, never less.
- The past is never rewritten; proposals are future-only by construction and re-checked.
- No change without the runner's explicit decision; silence is not consent.
- Consent (ADR-0006) gates every hosted-model call; revoking consent falls back to the deterministic path, which is
  a complete feature.
- The template narrator remains the fallback for language, and the deterministic planner remains the fallback for
  planning.

## Consequences

**Buys.** The runner gets a reviewer that reads their own choices and their actual results instead of a fixed rule
list; the operator gets one place to set quality without a deploy; the runner keeps the decision and the audit trail
that made the deterministic path trustworthy; the hidden/public split lets safety guidance be blunt internally and
kind externally.

**Costs.** A hosted model enters the trust surface: latency, cost, outage, and prompt-injection risk (runner notes
are untrusted text). The review path now has two producers (model proposal, deterministic fallback), so both must be
evaluated against the same golden review scenarios. The central guidelines are a second source of truth next to
`knowledge/heuristics/`; a rule stated in both places will drift unless one names the other.

**Forecloses.** "AI silently adjusts the plan" — the approval step is not configurable. "Guideline edits without a
version" — the table is append-only. "Review by a human coach for every runner" is not this product's shape; a coach
console would be a separate ADR.

## Open questions (recorded, not hidden)

- The wizard's step list and answer schema are P2 work; P0 only creates the storage and the audit shape.
- The guideline digest sent to the model is P1 work; P0 only fixes the row shape and visibility.
- The provider, budget and circuit breaker are P3 and need deployment credentials; until then the deterministic path
  is the only live path.

## Phases

| Phase | Content | Needs |
|---|---|---|
| P0 | this ADR, `guideline` contract, DDL for guidelines / wizard answers / AI proposals / consent, data model | no model |
| P1 | `packages/advisor`: prompt builder, output schema, deterministic validator, fallback, fake-model tests | no network |
| P2 | wizard UI, personal console (original vs current), operator read/write path for guidelines | no model |
| P3 | provider wiring behind consent, budget, circuit breaker, audit; operator console UI | deployment credentials |
| P4 | evaluation harness: golden review scenarios, adversarial prompts, safety regression | P1 first |

## Revisit when

- A model proposal passes the gates but a coach or runner says the advice is wrong: that is evidence the guideline
  layer or the fact object is insufficient.
- The guideline corpus and `knowledge/heuristics/` disagree on a number: one of them must name the other.
- Consent revocations, provider outages, or per-user cost make the fallback path the common path: the model would
  then be a language feature again, and this ADR should be superseded rather than patched.
