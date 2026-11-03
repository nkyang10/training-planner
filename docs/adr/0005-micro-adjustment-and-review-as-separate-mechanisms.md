# ADR-0005: Micro-adjustment and review as separate mechanisms

Status: accepted
Date: 2026-11-03

## Context

"Adaptive training" fails in both directions in practice: an app that changes nothing is inert, and an
app that changes everything is unreadable and untrustworthy. The two needs are genuinely different:
tomorrow's session must respond to today's legs *without asking*, while a season structure must never
change without the runner understanding and consenting. Feedback from daily logs is high-volume,
low-confidence and short-horizon; season-level changes are rare, high-stakes, and need explanation.

## Decision

Two mechanisms, deliberately asymmetric ([feedback-loop.md](../engine/feedback-loop.md),
[review-trigger-policy.md](../engine/review-trigger-policy.md)):

| | micro-adjustment | review |
|---|---|---|
| scope | tomorrow (≤ 2 days ahead) | everything after the freeze horizon |
| authority | automatic, bounded by policy | runner decides from 2–3 generated options |
| visibility | one-line "because" + undo | diff, cost, expected effect, logged outcome |
| magnitude | one substitution/downgrade/relocation per day | ≤ 2 changes to structure |
| reversibility | one tap | re-review; each version is restorable |

A micro-adjustment may never change goal, phase, pace bands, or the calendar structure; a review may
never touch executed days. Both are emitted by the same rule engine as typed actions, so they share
provenance and testing while differing in authority.

## Consequences

**Buys:** the runner experiences responsiveness without loss of control; the adaptation budget is
auditable (adjustments/day, reviews/season, reverts); safety can act immediately (subtract-only) while
coaching changes wait for consent; anti-oscillation has somewhere to live (dwell, cooldown, hysteresis
on the *review* side, per-day budget on the *micro* side).

**Costs:** two rule sets and two UX surfaces to keep coherent; the boundary (freeze horizon) is a knob
users will ask about; some situations want a middle tier (e.g. shifting this week's long run by two
days) — handled as review-with-default (pre-selected option, one-tap accept), not by widening
micro-adjust's authority.

**Forecloses:** silent structural changes; "AI auto-replans your season" marketing, which is exactly
the framing this separation exists to avoid.

**Revisit when** review acceptance rates and time-to-decision show consent is costing more than
adaptation is worth for a specific persona — evidence-driven, per-persona, and still never for
structural changes without a visible diff.
