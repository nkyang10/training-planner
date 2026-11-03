# ADR-0003: Manual-first logging; device import as enrichment

Status: accepted
Date: 2026-11-03

## Context

Device import is the obvious "easy win" for a training app, so the temptation is to build on Strava
and Garmin from day one. The verified reality (2026-11-03,
[Strava developer docs](https://developers.strava.com/docs/getting-started/)): creating an app
requires a paid Strava subscription; new apps are in **single-player mode** (only the developer's own
account) until configuration, then a **10-athlete** tier with **200 req/15 min and 2,000 req/day**
read limits, and **app review is required beyond 10 athletes** — plus a mandatory webhook endpoint.
Garmin's Connect Developer program could not be verified from the research environment (DNS failure /
empty page), so it is assumed approval-gated. If the product's core loop required a connected device,
we could not even demo it to a second person.

There is also a domain argument: the signals that change a plan fastest — perceived effort, leg
heaviness, pain, sleep, *why a session was skipped* — are not on any watch.

## Decision

**The loop works fully with manual entry.** A 5-tap daily entry (status, RPE, legs, optional
wellness/pain, optional note) plus optional free-text is the foundation; plan generation, comments,
micro-adjustments and reviews all function on manual data alone, with confidence labelled
accordingly. Device import (Strava first) is an **enrichment layer** added behind an adapter, with
provenance preserved per [integrations.md](../architecture/integrations.md).

## Consequences

**Buys:** a demoable, sellable, testable product with zero third-party dependency; the highest-value
evidence captured anyway; graceful degradation when an API is down; honest confidence statements for
device-less users; no per-provider legal/ToS exposure blocking launch.

**Costs:** the daily ask is real, so entry design, nudges and adherence measurement are first-order
work (and the biggest product risk in
[scope-and-non-goals](../vision/scope-and-non-goals.md#risks-accepted-at-launch)); HR-based metrics
(TRIMP, decoupling) are unavailable or weaker for many users; we must build and maintain a manual
import path (GPX/CSV/Fit) that rivals "connect Strava" in low friction; some prospects will compare
unfavourably on day one against import-first apps.

**Mitigations:** manual entry must be genuinely fast (≤ 30 s, measurable in tests); import becomes the
first post-launch enrichment; a documented "connect when available" seam already exists
(`ActivityObserved` events with provenance).

**Revisit when** Strava app review is granted (or an equivalent open source/provider path exists) and
manual adherence is proven stable (≥ 70% logging at week 8), at which point import improves rather
than rescues the evidence base.
