---
status: draft
last_reviewed: 2026-11-03
owner: unowned
---

# Product vision

## The problem in one sentence

A runner buys or downloads a plan built for an *average* body on an *ideal* calendar, runs three
good sessions, gets a cold on Tuesday, misses Thursday, and then has no honest way to answer the
only question that matters: **"what should I do today, and what does that mean for my race?"**

Static plans break on contact with a real life. Coaching fixes it but does not scale. Existing apps
mostly automate the *plan* and skip the *conversation*, or they adapt silently so the runner stops
understanding their own season.

## Who this is for

Anyone who trains with intent but without a full-time coach. Concretely, the design must not break
for these four ends of the spectrum (details in `knowledge/personas/`):

- a first-time 5K runner who has 3 evenings a week and no idea what "easy pace" means;
- a sub-3:30 marathoner doing 70 km/week who needs the plan to survive a work trip;
- a 52-year-old returning after 8 months off, where the cost of one bad decision is a stress fracture;
- a runner whose goal is simply "finish without stopping", for whom a missed VO2 session is not a crisis.

A plan generator that works for the middle and destroys the edges is worthless here, because the
edges are where coaching actually matters.

## Thesis

> **The plan is not the product. The daily loop is the product.**
> A plan is a hypothesis about the next 12 weeks. The daily entry is the evidence. The comment is
> the interpretation. The review is the moment the hypothesis is honestly revised — and the runner
> sees the revision.

Three commitments follow.

### 1. Feedback must cost less than 30 seconds, or it will not happen on the hard days

The value of the dataset is concentrated in the days a runner *doesn't* want to log: the missed
session, the bad sleep, the knee that hurt. If logging requires a form, we get data only from
motivated days, and every downstream signal is biased toward exactly the days that need no
intervention. So: one tap for status, two for feel, optional detail, works offline, backfillable.

### 2. Every day the system must say something specific — and say nothing when it has nothing

A reply that could have been written without the runner's data is worse than silence: it teaches
them the loop is theatre. The comment is generated from a structured fact object and must reference
at least one concrete element of *today* (the session, the RPE vs prescription gap, the streak, the
distance to race day). It states what happens **tomorrow**, which is the runner's actual question.

### 3. Change must be visible, reviewable, and reversible

Adaptation without a diff is the failure mode of most "AI coaching": the user cannot tell whether
the system is adapting to them or drifting. So future-plan changes arrive as a **review** with a
before/after diff, a stated reason, and the cost of each option — and the runner approves it. They
can also ask for a review at any time ("I'm travelling", "my calf has been tight for 10 days",
"I'm bored of this block"), which is the user-triggered path the product must treat as first-class,
not as an emergency.

## Product principles (tie-breakers when design fights)

| # | Principle | What it rules out |
|---|---|---|
| P1 | Explainable beats clever | a model that can't state why Tuesday became easy |
| P2 | Understands the runner as a person, not a data stream | an app that only works when a watch syncs |
| P3 | The runner owns the last decision | auto-applying a plan rewrite without consent |
| P4 | Safety subtracts, never adds | "push through, I'll manage it" automation |
| P5 | Honest about uncertainty | fake precision ("you will run 1:29:47") |
| P6 | Data stays in the user's scope | training the model on another runner's history |
| P7 | Works for the edge cases or doesn't count | defaults tuned on the median user |

## What "good" looks like in 12 weeks of use

Measurable, not vibes:

1. **Log continuity** — ≥70% of users still logging at week 8, with the log streak visible in the
   calendar as its own affordance (a gap is an invitation, not a shame marker).
2. **Comprehension** — a runner can predict tomorrow's session and say why it is what it is.
3. **Trust in reviews** — ≥60% of reviews accepted without heavy editing; rejections are recorded
   with a reason, because a rejected intervention is data about the model's calibration.
4. **Early detection** — overreach is flagged before the runner's own complaint, measured against
   what they tell us later ("you were right — I got sick on the 14th").
5. **Goal attainment without harm** — race outcomes tracked against prediction, *and* injury /
   DNF / forced-rest rate kept as a headline metric, not a hidden one.

## Why now, and why this shape

Consumer wearables made HR, HRV, sleep and pace table stakes, so the raw-data problem is solved and
the *interpretation* problem is wide open. Meanwhile the research base on load metrics has become
more sceptical (see `knowledge/signals-and-metrics/acute-chronic-workload.md`): single-number
"readiness" scores are shakier than their marketing. That argues for a system that is **plural in
signals, conservative in actions, and explicit about what it is doing** — which is exactly the
comment + review architecture above, and hard for a gamified readiness score to copy.

## Business frame (light, but real)

Per-user subscription. Per-user isolation is already the architecture (see
`docs/architecture/per-user-isolation.md`), so the paid unit and the data unit are the same thing.
Free tier = static plan generation + logging + comments (the loop is the demo). Paid = reviews,
autoregulation, integrations, race-season history, coach-share export. A coach/coaching-club tier is
a later, natural extension: the same objects, one human adding judgement on top.
