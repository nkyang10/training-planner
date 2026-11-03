---
status: draft
last_reviewed: 2026-11-04
---

# Milestones

Each milestone ends with something a real runner can use and something we can *measure*. Gate = the
evidence required to open the next milestone. No milestone ships without its tests; the planner's
golden plans are the specification, so M1 is where correctness is bought cheaply and M2 onward is
where it is verified against humans.

**This file is the narrative, not the control.** Which milestone is active, what has to be true to
close it, and where the evidence lives is a machine-read contract in
[../engineering/phases/README.md](../engineering/phases/README.md), one file per milestone, checked by
`tools/check-phases.py` on every PR. Read the prose here to understand a milestone; read that folder to
know whether it is done.

Team assumption: 1–2 engineers + 1 coach-curated knowledge owner (part-time) + runners from one club
(the Strava 10-athlete tier is literally this cohort — [ADR-0003](../adr/0003-manual-first-logging-with-import-as-enrichment.md)).

---

## M0 — Skeleton & contracts (1–2 weeks)
**Ship:** pnpm workspace; `packages/domain` zod schemas mirroring `schemas/json`; `packages/planner-core`
with a stub that returns a valid empty plan; Fastify health route; Drizzle migration for `users`,
`athlete_profiles`, `plan_versions`, `events` with RLS enabled and the cross-user test suite green;
vitest + fast-check configured; CI (typecheck, tests, knowledge lint); next-intl wired with `en` +
`zh-Hant` catalogues; Docker Compose dev stack.
**Gate:** CI green on a clean machine; RLS test proves user A cannot read user B's row (404, not 500);
`pnpm test` runs golden-plan harness with one trivial fixture.

## M1 — Headless planner, correctness first (3–5 weeks) ← *the highest-value milestone*
**Ship:** planner passes 0–8 ([planner-engine](../engine/planner-engine.md)); knowledge bundle loader
with `knowledgeHash`; 6 determinism requirements enforced (injected clock/seed, stable sorts, rounding
policy, canonical-JSON hash); **6 golden plans** spanning novice 5K, competitive marathon, masters 40+,
3-days/week, returning-after-layoff, trail ultra; property tests for invariants (48 h hard-day spacing,
≤2 hard days, weekly ramp ceiling, hard days never added by safety, no session beyond knob `range`);
`PlanDiff` generator; CLI `planner gen|diff|explain` reading a fixture profile.
**Gate:** 6/6 golden plans pass and a rule change breaks exactly the fixtures it should; a coach reads
three generated plans and signs off on structure; two consecutive generations are byte-identical;
**this is where we stop and re-read the knowledge base** — most of the domain cost is here.

## M2 — The daily loop, manual-first (4–6 weeks)
**Ship:** Next.js calendar (month/week/day drawer); 5-tap entry with offline IndexedDB + idempotency
keys; rollups + signals; policy evaluator emitting `comment | adjustTomorrow | flagReview`; **template
narrator** (LLM off by default) in both languages; correction/backfill trail; safety layer live with
hard stops; account, timezone, units, locale; plan publication from a fixture profile.
**Gate (measured with 10–15 real runners over 4 weeks):** ≥ 60% daily logging in week 4; entry
completed in ≤ 30 s median; zero cases of a past day being modified; every comment traceable to a rule
id; runners can explain their own week in their own words (3 interviews — the real test of the
comment).

## M3 — Reviews that change the future (4–6 weeks)
**Ship:** review triggers with severity/dwell/cooldown/hysteresis; review screen with verdict, 2–3
options always including *keep*, stated cost, diff view, consent, decline-with-reason; new
`plan_version` + stored diff; safety reviews with non-overridable stops and clearance recording;
weekly summary (the light-touch review); review outcome checkpointing.
**Gate:** ≥ 50% of opened reviews reach a decision within 7 days; ≥ 55% acceptance of *some* option;
post-hoc audit shows the policy caught the events runners later reported as bad (miss-rate under
control); **no runner can describe an adaptation as "random"** — the wording test we run in interviews.

## M4 — Evidence enrichment: Strava + import (3–4 weeks, partly external)
**Ship:** Strava OAuth + webhook + bounded sync at the documented limits; GPX/CSV import;
`activity_links` with `suggested`/`manual` matching UX; TRIMP and HR-based metrics where HR exists;
confidence labels that state missing evidence; connection revoke = real delete.
**Gate:** import or link a week of activities in ≤ 2 minutes; zero wrong auto-links in a 20-session
test set (ambiguous cases must surface as suggestions); rate-limit budget proven under load; Strava app
review submitted (the calendar for this is the app's, not ours — start the paperwork in M2).

## M5 — Autoregulation & calibration (4–8 weeks)
**Ship:** HRV/RHR wellness baselines with the 3-reading rule and sufficiency gating; `rpe_gap`-driven
pace-band recalibration at phase boundaries only; individual ramp-tolerance calibration; comment
flavour experiment scaffolding (measure, don't guess); narrative LLM path behind consent with the
template floor still tested in CI; notification budgets and per-user local schedules.
**Gate:** calibrated users show better adherence or fewer flagged bad weeks than a matched
non-calibrated group (small-n, honest about power); zero HRV-driven action when sufficiency is below
threshold; LLM path never produces a banned output in the adversarial suite (both languages).

## M6 — Multi-tenant hardening & launch (3–4 weeks)
**Ship:** billing (free: plan + log + comment; paid: reviews, autoregulation, integrations); quota and
cost controls (no LLM in numeric paths means cost is bounded and predictable); export/import round-trip
(`DELETE /me` real within 30 days); observability: "why did this change" one query, fallback and revert
counters; load test (1,000 concurrent users' nightly regeneration); subprocessor list, privacy copy,
guardian acknowledgement for 16–17; backup restore rehearsal.
**Gate:** restore rehearsal reproduces a user's plan versions and comment history; RLS suite clean on a
staging restore; 30-day pilot cohort retention ≥ target from
[product-vision](../vision/product-vision.md); support load under 1 h/week per 20 users.

---

## Sequencing logic worth defending

**Planner before UI.** The planner is the part we cannot fake and the part that takes longest to get
right; UI work that assumes a plan shape we later change is the obvious waste. M1 also forces the
knowledge base to become executable, which exposes every vague rule.

**Template narrator before LLM narrator.** Proving the loop works with deterministic prose is the
honest test of whether the *content* is valuable; the LLM then improves warmth, which is measurable as
a delta rather than assumed.

**Manual logging before integrations** ([ADR-0003](../adr/0003-manual-first-logging-with-import-as-enrichment.md))
and **reviews before autoregulation**: consent-based adaptation teaches us what runners accept before
we automate more of it.

**Post-launch, not milestone-bound:** coach/grant model, community/benchmarks, watch write-back,
multi-sport, second language. See [backlog.md](backlog.md).
