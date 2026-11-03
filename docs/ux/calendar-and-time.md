---
status: draft
last_reviewed: 2026-11-03
---

# Calendar, timezones, and the definition of "today"

A training calendar is a distributed-systems problem wearing a UI. A runner who takes a red-eye from
Taipei to Frankfurt has, in one 12-hour span, a long run, a night's sleep, and two days that both
claim to be Tuesday. If "today" is unstable, the plan, the entry, the comment, and every derived
metric drift — and drift silently. This file is the spec for not letting that happen.

## 1. Definitions (the vocabulary the whole codebase uses)

| Term | Definition |
|---|---|
| **Instant** | an absolute point in time, `timestamptz`. Never interpreted alone. |
| **Local wall time** | an instant + a named IANA zone → what a clock on the wall showed. |
| **Training day** | `[D 04:00 local, D+1 04:00 local)` in the user's zone at that moment. The `04:00` default (`users.day_start_hour`) keeps a 01:00 run on the day it happened for night runners and keeps a 23:30 finish on the right day for everyone else. |
| **Week** | ISO-8601, Monday-first, `iso_week_start` stored as the Monday *date* in the user's zone. Monday-first is a deliberate choice (it matches coaching practice and the weekly summary rhythm); the calendar *grid* may render Sunday-first for `en-US` locale while the *week unit* stays Monday-first. Those are independent and both are tested. |
| **Block / phase** | a date range of training days, never a count of instants. |
| **User's "today"** | the training day containing `now()` in `users.tz`. Rendered server-side to avoid client-clock skew. |

Storage rule (from [data-model](../data/data-model.md#time-handling-this-bites-so-it-is-specified)):
instants in `timestamptz`, training days as `date` + the `tz` they were computed in. A training day
is never derived by formatting a UTC instant.

## 2. DST

- A spring-forward day has 23 hours; a fall-back day has 25. Sessions are prescribed in *distance
  and effort*, so the session itself is unaffected — but **duration-based** easy runs, the 04:00
  boundary, and notification times must be computed with zone-aware arithmetic (never `+24h`).
- A long run crossing a fall-back boundary can appear 1 h longer on the watch than the elapsed plan
  window implies. We store the activity's own `started_at`/duration and do not "correct" it.
- Notification and daily-nudge times are stored as *wall times* (`20:30` + zone), so "remind me at
  20:30" keeps meaning 20:30 after a DST change, even though the instant shifts.
- A zone change (travel) re-derives **day labels** for the ±3 day window around the trip and
  triggers a bounded recompute; the runner sees one line: *"Your runs stayed on the days they
  happened; the calendar shifted to match your new timezone."*

## 3. Travel (the interesting case)

On `availability.changed` with a `travel` intent (or from the trip form: from/to zones, dates):

1. Sessions are **shifted, never duplicated or deleted**: the plan's *sequence* (hard → easy → long)
   is what carries the training stress; clock time is incidental.
2. **Jet-lag-aware placement**: for trips crossing ≥ 4 zones, the first 2 days get easy/short
   options and no interval session is placed in the first 48 h after arrival; a treadmill or short
   repeats alternate is offered. (`missed-session-rules.yaml#travel-*`)
3. Entries logged abroad are stamped with the **zone at the time of the activity** (`entry.submitted`
   carries `tz_at_event`), so a 06:00 Berlin run lands on the Berlin training day, not the Taipei one.
4. Race travel is special: the race-day session is immovable, everything before it compresses, and
   the review that produced the travel plan states the arrival-to-race gap and its cost.

## 4. Device clock skew and backfill

- The client never trusts its clock alone: entries carry `client_submitted_at`, `occurred_at`
  (runner-corrected) and `server_received_at`. If they disagree by > 12 h, the entry lands on the
  day the runner chose and the discrepancy is stored for audit.
- **Backfill grace**: corrections to the last 72 h are silent; older corrections create an
  `entry.corrected` event with a reason, because changing last week's load changes CTL and the
  explanation of a past comment. Nothing is silently rewritten — the past is append-only with a
  visible correction trail.

## 5. Recurring computation schedule (per user, in the user's zone)

| When (wall time) | What |
|---|---|
| 04:00 (day start) | day boundary rolls; day state → `planned`; day-level refinement for today+1; missing-entry nudge scheduled |
| 04:20 | rollups recomputed for the closed day; signals; policy evaluation for the *yesterday* comment |
| 20:30 (default, user-set) | missing-entry nudge, once per day |
| Sunday 18:00 | weekly summary generation |
| On `entry.submitted` | immediate re-evaluation of today's micro-adjustment for tomorrow (hot path, < 2 s) |
| On demand | review generation |

All of these are **per-user scheduled jobs with the user's zone**, not a global cron at UTC midnight —
a global cron would deliver "good evening" nudges at 3 a.m. to half the user base.

## 6. Calendar UX specifics

- **Month view is the default** (a season is understood month by month); week view is the phone
  default; both deep-link to `/d/{date}`.
- The grid shows **planned** by default with a toggle for *logged vs planned* overlay and a toggle
  for *diff overlay* after a review (added / removed / moved / replaced, four marks, colour + glyph).
- A day cell shows the **comment badge only if a comment exists**; unlogged days show a quiet `+`,
  never a red "!" (guilt pressure is banned — see [feedback-microcopy](feedback-microcopy.md#never-say)).
- Long-press / right-click a future day → "can't do this day" → the availability editor with the
  reason pre-filled; this is the most common *proactive* review trigger and must be reachable from
  the moment the thought occurs.
- **i18n in the grid**: month/weekday names from `Intl` with the user's locale, no hardcoded English
  abbreviations, and no `new Date(str)` string parsing anywhere (lint rule).
- Keyboard: `t` today, `←/→` day, `e` entry, `r` review. Accessible: each cell is a `button` with an
  `aria-label` reading kind, distance, state, and whether a comment exists.

## 7. Tests that must exist

1. A run at 00:30 Asia/Taipei lands on the correct training day.
2. DST spring-forward: 23-hour day, rollups and CTL unchanged for a fixed load sequence.
3. Travel Taipei→Berlin: a 06:00 Berlin run lands on the Berlin day; a shift of the plan preserves
   session *order*; no duplicate hard day.
4. Race day is immovable across a 9-hour zone change.
5. Backfill on day −5 emits `entry.corrected` and recomputes rollups without altering stored comments.
6. Property test: for any random sequence of instants and zones, `trainingDay(x)` is a total,
   order-preserving map and consecutive training days partition the timeline with no gaps or overlaps.
7. A user with `day_start_hour = 2` gets the 01:00 run on the same day as a user with default 04:00.
