# ADR-0007: LLM language-only with a first-class template fallback

Status: accepted
Date: 2026-11-03

## Context

The daily comment is the product's trust surface: one sentence that must be *true*, specific, and kind.
An LLM is the only technology that can phrase "18 km with 4 at MP and legs at 3/10 — the MP section
held, which is the point of this block" without sounding like a form letter. It is also the only part
of the system that can confidently fabricate. Numbers are where fabrication becomes harm.

## Decision

The LLM receives a structured `FactObject` (rule id, evidence values, intended action, tone register)
and returns **language only**. It cannot choose a distance, pace, rest day, intensity, or the action
itself — those are decided before the call. Output passes numeric-grounding and safety checks; on any
failure we emit the **deterministic template** for that rule id. Both paths write an immutable
`system_comments` row recording which narrator produced it. The template path is a *complete feature*
— shipped first, tested continuously, never treated as a stub — and is the default for users who turn
AI off ([ADR-0006](0006-llm-processing-consent-and-data-boundary.md)).

## Guardrails (implemented, not aspirational)

1. Numbers must appear in the `FactObject` and match it; any other number → reject.
2. Length, locale, and banned-category checks (diagnosis, weight/calories, guarantees, shame) in both
   languages; classifier + blocklist; reject → template.
3. `hard_stop` comments must include the referral line where medical.
4. Per-user/day LLM budget and a circuit breaker; a provider outage must be invisible to the runner.
5. Sampling temperature ≤ 0.4, no chain-of-anything, no tool use in the narrator; it is a re-writer.

## Consequences

**Buys:** warmth without epistemic risk; a comment that is reproducible for tests (template path
pinned in golden tests); a free tier that works offline; graceful degradation and cost control.

**Costs:** double maintenance of every comment rule (fact object + template + prompt); template prose
quality is the real baseline and must be *good*; some nuance (long free-text notes) is under-used
deliberately — the narrator paraphrases intent codes, not the runner's diary.

**Forecloses:** "ask the coach anything" chat, which would collapse the boundary between language and
decision authority. If a conversational surface is ever built, it runs on the same fact objects, cites
rule ids, and cannot mutate the plan without going through a review.

**Revisit when** we have evaluation data showing template comments measurably underperform on
adherence — that is the honest reason to add cost, not the reason "the model sounds nicer".
