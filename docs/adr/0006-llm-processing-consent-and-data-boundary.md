# ADR-0006: LLM processing — consent, data boundary, and residency

Status: proposed (needs legal review before launch)
Date: 2026-11-03

## Context

Comments and review narratives go through a hosted LLM. The prompt is built from the runner's recent
training *and* health-adjacent free text (pain descriptions, illness notes, "my child is sick", "I
stopped my menstrual cycle"). Under GDPR this is close to — and arguably within — special-category
data processing, and it involves a subprocessor. Users in the EU (and health-data-sensitive users
elsewhere) reasonably want to know what leaves their account. The product promise
("your season stays yours") has to survive the architecture.

## Decision (proposed)

1. **Minimised, structured prompt.** The narrator receives a `FactObject`: numeric signals, rule ids,
   session kinds, and *redacted* free-text fragments. Raw note text is not sent unless the runner
   opts in; pain/illness free text is replaced by controlled vocabulary codes with severity.
2. **Explicit consent gate** at onboarding, separate from ToS: "Use AI phrasing for your daily
   comment?" with a plain description of what is sent, and an off switch that changes only *phrasing*
   (the deterministic template path) — never the plan, never the comment's existence.
3. **Zero retention / no training** clauses with the provider; no provider-side log persistence beyond
   request handling; provider named in the public subprocessor list.
4. **Residency**: EU users are served an EU-region database and, where available, an EU-region
   inference endpoint. Non-EU providers require either an EU adequacy finding or SCCs plus a documented
   transfer assessment — decided before marketing to the EU, not after.
5. **Local/small-model path** kept working for the free tier and as a residency fallback: the template
   narrator is the guaranteed floor; a small on-device or self-hosted model is the mid tier.
6. **No LLM in any numeric path** (already fixed by
   [ADR-0001](0001-deterministic-rule-planner-with-statistical-calibration.md)), so a residency or
   provider outage degrades prose quality, never training correctness.

## Consequences

**Buys:** a defensible privacy posture that matches the marketing; a graceful free/offline tier;
provider swap in one adapter; consent that is meaningful because opting out costs almost nothing.

**Costs:** two narrative paths to maintain and test (including a banned-output test suite in both
languages); redaction logic is real engineering and can fail subtly; latency and per-user budget
tracking; legal review and a subprocessor list to keep current.

**Open questions for legal:** whether our pain/illness processing is special-category under GDPR in
our specific configuration; minors' consent flow (16–17 with guardian acknowledgement); whether
"aggregate coaching benchmarks" are permissible from health-adjacent fields (current answer: no, they
stay excluded — see [data-model](../data/data-model.md#derived-rebuildable)).

**Revisit when** legal review returns, when we add any new provider or region, and whenever a new
field would enter the narrator prompt (checklist item in the contribution guide).
