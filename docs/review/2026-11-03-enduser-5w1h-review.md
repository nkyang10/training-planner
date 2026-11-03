---
status: draft
last_reviewed: 2026-11-03
kind: self-review
reviewer: team lead, in the seat of the end user
method: grep + read across 122 files in `knowledge/` and `docs/`; every gap below quotes its hit count
---

# End-user review: does this survive a runner's Tuesday?

Not a design summary. I read our own 122 knowledge and design files the way a runner lives them --
in the kitchen at 06:40 with coffee, at the desk at 12:20, in bed at 23:05 -- and asked the five Ws
and one H for three of our own personas. Where I claim something is missing, I quote the scan. Where
a limitation is a *declared* non-goal, I say so and cost it instead of pretending it is a bug.

## Walkthrough A -- time-poor, three runs, two children (persona: `time-poor-3-days`)

| | What the runner actually does | What our design assumes | Verdict |
| --- | --- | --- | --- |
| **Who** | 38, two kids, "I run when the house sleeps" | Onboarding asks years running, weekly km, runs/week (`screens.md` §6) | covered |
| **What** | "Can I do today in 40 minutes?" | The plan prescribes distance and pace. Duration appears **twice in 122 files**, once in onboarding (`screens.md:155`), once in a physiology doc | **F2 -- gap** |
| **When** | 22:40, or a lunch hour that ends at 13:00 sharp | Training day = 04:00 boundary; availability picker with time budgets | partially covered |
| **Where** | Treadmill when it rains, roads when it does not | Weather is not an input; heat/altitude posture exists (`safety-layer.md:104`) | partial |
| **Why** | Sub-2:00 half, but not at the cost of Sunday | Goal type finish/time/experience, plan style structured↔flexible | covered |
| **How** | Five taps, one hand, in the dark | 3-tap minimum viable entry, `alternate` counts as success | covered, and it is the best thing we designed |

The Tuesday that breaks this persona: Wednesday's interval session collides with the running club's
Tuesday speed night. Nobody in our corpus has ever met the club. **`group run`, `running group`,
`pacing partner`: 0 hits in 122 files.** This is not the declared non-goal at
`scope-and-non-goals.md:27` (that is *coach/group dashboards*, i.e. tenancy). It is a per-user input:
the session a runner does not control.

## Walkthrough B -- masters 46, five runs, one calf that has opinions (`masters-40plus`)

Calf wakes up mid-run at 6 km. Our stop rule (`feedback-microcopy.md#stop`, 7+/10 plus night pain or
gait change) is written, correct, and **reaches them the next day** -- real-time in-run coaching is a
declared non-goal (`scope-and-non-goals.md:32`), so the runner decides alone. I accept that boundary;
I do not accept that we leave nothing on either side of it: no pre-run "if it feels like X today"
card, and the post-run capture does not ask the one question that matters (`nextMorningWorse` exists
in `day-entry` but is buried in the tier-2 pain object).

What we do get right for this runner: the hard-day gap has exactly one owner (48 h, 72 h after
quality, 96 h at 40+ -- `heuristics/recovery.yaml`), safety subtracts and never adds, and a review
must offer "keep as is" first with a stated cost.

## Walkthrough C -- first 5K, no watch (`novice-first-5k`)

Six weeks in, three days of silence after a bad week. What happens? **Nothing is specified.** The
corpus governs review prompts (`≤ 1 per week`, dwell 7 d, cooldown 10 d) and says `unlogged` is the
system's absence marker -- but there is **no engagement policy**: 0 hits for `nudge`, `daily reminder`,
`push at`. So the product's single most important behaviour -- *when do we speak to a person about
their own body, and when do we stay quiet* -- is undefined, while the rarer event is exhaustively
specified. Silence is also load-bearing in the other direction: three quiet days after a hard block is
information, and today it is neither feedback nor a miss.

This persona also has no long-range mirror. Screens end at "Weekly summary" (§5);
`history screen`, `monthly view`, `what did I do`: **0 hits**. Eight weeks in, "am I actually anywhere
different?" is unanswerable -- which is exactly when a novice quits. The season export exists as
posture (`safety-layer.md:96`, a physio should be able to read our loading history), but it is not a
screen or an endpoint anywhere.

## What survived the review (do not "improve" these)

- **Three taps is enough to keep the loop alive.** `minimum-viable-entry {taps: 3}` is the reason the
  product can exist at all.
- **Never add volume to make up missed work.** The single most common generic-plan lie, refused by
  design, and `alternate-taken` is a *success* status, not a failure.
- **The review is an option set with "keep as is" first, a visible diff and a stated cost.** Consent
  without cost is not consent.
- **A good signal never buys extra work**; safety only subtracts, and hard stops are not one-tap
  overridable.
- **The comment talks about a number the engine chose** (`allowedNumbers` grounding, ADR-0007) -- and
  about nothing else. No recovery percentages, no durability scores, no diagnosis, no weight.
- **No device is normal.** Manual-first with import as enrichment (ADR-0003) is the right call for
  exactly the personas above.

## Findings

| # | Finding | Sev | Evidence (scan of 122 files) | Decision | Branch |
| --- | --- | --- | --- | --- | --- |
| F1 | No engagement/notification policy: entry nudge timing, quiet hours, and the meaning of N silent days | **1** | `nudge`, `daily reminder`, `push at`: 0 hits; review prompts governed, entry never | New `heuristics/engagement.yaml`: nudge anchored to the runner's own observed run hour (never a default 09:00), quiet hours from their own entry times, silence ladder at 3 d ("no plan change, just checking you are okay to log") and 7 d (pause prompt, never guilt); silence is data, not a failure. Add the same rules to `feedback-microcopy.md` | `knowledge/engagement-policy` |
| F2 | Elapsed time is an input, not an output | **1** | duration/how-long: 2 hits, one in onboarding | Make estimated duration a first-class plan output field (`duration_estimate_min` + `earliest_finish_at`), rendered on the calendar card and the day drawer; when the runner's remaining time is short, offer the already-specified `alternate` dose rather than a truncated key session | `feat/client/today-takes` |
| F3 | Sessions the runner does not control (club night, parkrun, a friend's pace) are invisible | 2 | club/group/pacing-partner: 0 hits | Day-entry `intent: with-others` + `statusDetail`, and a plan rule: at most one plan-adjacent substitution per week, recorded as a review change with its cost; a parkrun counts as what it *was* (a hard day), never as free volume | `knowledge/uncontrolled-sessions` |
| F4 | No long-horizon self-view (8+ weeks) | 2 | history/monthly: 0 hits | `Season` screen: trend narrative only (CTL/TSB stay narrative per `performance-management`), no scores, no rankings, plus the export button | `feat/client/season-view` |
| F5 | Heat and altitude adjust down but never state the cost | 2 | 77 heat hits, all posture/direction; no band table in `heuristics/` | Knobs for temperature/humidity bands with `range`, and one sentence of *stated cost* in the comment ("today's 8 km is doing the work of 11 km at 31 °C") -- effort-based, never a promise | `knowledge/heat-altitude-bands` |
| F6 | Travel across zones shifts the day boundary but not the week | 3 | 1 hit: `calendar-and-time.md:47` | Rule: after ≥ 4 zones, shift *session placement*, never the sequence, and freeze reviews for the flight day + 1 | `knowledge/travel-week-shift` |
| F7 | Nothing on either side of the run for pain decisions | 3 | in-run coaching is a declared non-goal (`scope-and-non-goals.md:32`) | Pre-run "if today feels X" card on the day drawer (2 taps, from the pain bands already in `injury-risk-and-pain-triage.md`); promote `nextMorningWorse` into tier 1 of the entry flow | `feat/client/pre-run-card` |
| F8 | A day holds one session in the model, though competitive amateurs do two | 2 | two-a-day hits exist in physiology only, none in `day-entry`/screens | Day → `sessions[]` (1..2) with a shared daily load budget; the ACWR and gap rules read the day, not the session; the second session may only be easy/strength | `feat/data/multi-session-day` |
| F9 | Leaving the product is a posture, not a feature | 2 | export/delete: 3 hits, all in ADR-0006 / isolation doc | Export (JSON + CSV + the safety record) and delete are v0.1 endpoints, not rights we hope for | `feat/api/export-delete` |
| F10 | Race day is a plan day with no card | 2 | 6 race-day hits, none a surface | Race card: warm-up, bands (not promises -- no guarantees, rule 6), what to bring back the same evening (RPE, result, legs) so paces re-band honestly; `post_race_easy_days` already exists in `recovery.yaml` | `feat/client/race-card` |

## Verdict, in the runner's seat

The **reasoning** is better than most commercial products I have used: nothing invents a number, safety
only subtracts, and the review respects me as the decision-maker. The **daily reality** has two holes
that would make me stop using it inside three weeks -- **F1** (it either never speaks or speaks at
09:00, and my silence means nothing to it) and **F2** (it tells me 10 km at easy pace when my real
constraint is 42 minutes). Those two are launch blockers for the loop; F3/F4/F8 are the ones that make
me leave after the novelty, and F9 is the one that makes me angry if I ever want to go.

I would still ship the three defended MVP items (`scope-and-non-goals.md:36-40`),
with F1 and F2 folded into item 2. Everything else waits.

One honest limit on this review: it was produced by reading our own corpus, so it inherits that
corpus's blind spots -- English-language, road-marathon-weighted, thin on trail/ultra, masters and
postpartum (`research/2026-11-03-foundation/README.md` says so). Real runners break findings F3 and F8
open wider than I have.

## Follow-up

Each finding is a branch in the M1 tree; scope, first PRs and DoD are in
[branching-and-github.md](../engineering/branching-and-github.md).
