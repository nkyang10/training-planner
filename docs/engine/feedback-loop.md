---
status: draft
last_reviewed: 2026-11-03
---

# Daily feedback loop (LOG → COMMENT → micro-adjust)

The loop runs once per training day per user. It is the highest-frequency, lowest-risk part of the
system, and the data source for everything the review policy later decides.

```
06:00 local   session reminder (if enabled)  ──► day cell shows: today + purpose + alternate
   (runner runs, with or without a device)
evening       runner opens the day cell → 5-tap entry → POST /entries
                 │
                 ├─ append DayEntry (immutable) + EntryLogged event
                 ├─ recompute signals for that user (pure functions over the event log)
                 ├─ evaluate policy rules (knowledge/heuristics/daily-feedback-rules.yaml)
                 │     → Actions: [comment, adjustTomorrow{…}, flagReview{…}, hardStop{…}]
                 ├─ build FactObject ──► Narrator (templates, optional LLM phrasing)
                 ├─ append SystemComment (immutable, versioned) + MicroAdjustment (if any)
                 └─ UI updates: day cell chip + tomorrow's cell shows "changed because …"
```

---

## 1. The entry: what we ask, and why each field earns its place

Design rule: **every field must be answerable in under two seconds from memory, and must change
some decision.** Fields that are interesting but decision-free belong in the weekly check-in, not in
the daily one. Detail and scales: `knowledge/feedback-and-autoregulation/daily-feedback-taxonomy.md`.

**Tier 1 — always (≈15 s, one row of taps):**

| Field | Control | Why |
|---|---|---|
| `outcome` | `rest / completed / partial / skipped / missed` | the only mandatory answer; drives everything. `missed` is written by the system when a day closes with no entry |
| `sessionTaken` | `as-prescribed / alternate / extra / none` | same tap as `outcome`, no extra cost: an alternate is a success for load but not for running ramp, and extra subtracts rather than earning credit |
| `rpe` | 1–10 (Foster) | effort-vs-prescription gap is the single most useful daily signal |
| `legs` | 1–5 (feathered → wrecked) | cheap proxy for recovery debt; trends better than sleep data |

**Tier 2 — one optional row (collapsible, remembers last value):**
`sleepHours`, `restingHr` (auto if a device is connected), `stress` 1–5 (life load), `mood/motivation`
1–5.

**Tier 3 — conditional, appears only when relevant:**
`pain {site, intensity 0–10, duringRun: less/same/worse, nextMorning: better/same/worse}` — opens
when the runner taps a body map or types a pain word. This branch runs the triage path
([safety-layer.md](safety-layer.md#pain-triage)) and may produce a `hardStop` before any planning
logic.

**Tier 4 — `note` (free text, optional, 280 chars).** Parsed only for a small intent vocabulary
(travel, illness, work, family, sleep, motivation, pain, weather) to explain *why* a session was
missed. Reason matters more than the miss: a missed session because of a fever is a different
decision than a missed session because of boredom, and the same holds for what we say back.

### Entry rules that protect the data

- **Partial credit, no lies.** `partial` with `percentComplete` or actual duration — the adherence
  metric needs the fraction, and a runner who rounds up corrupts their own history.
- **A missing entry is a signal, never a zero.** `unlogged` ≠ `rest`. Absence after a hard block is
  information (avoidance, chaos, illness); we surface gaps neutrally and never as a broken streak.
- **Backfill window**: entries for the last 7 days are editable by creating a *correction* record
  (original stays; derived metrics recompute from the corrected view). Corrections after 7 days
  require a reason.
- **Offline-first**: the entry is written to IndexedDB first, synced with an idempotency key, and
  shows as "saved locally" — a runner in a basement gym or on a trail with no signal must still be
  able to log.
- **Immutability**: `DayEntry` rows are append-only; edits create a new revision referencing the
  original. Derived metrics are recomputed, and any review that already consumed the old value keeps
  its recorded snapshot (a review's reasoning must remain explainable).

---

## 2. From entry to signals

Signals are pure functions over the event log, recomputed on write and nightly. Windows matter more
than values (`interpretation-windows.md`):

| Signal | Window | Meaning |
|---|---|---|
| `rpeGap` | single day, then 7-day mean | did the prescribed work get easier/harder than intended |
| `paceAtHr` / `hrAtPace` | 4-week on matched easy/long sessions | the only honest aerobic-fitness trend without a lab |
| `wellnessDeviation` | ln(HRV) and RHR vs 7-day rolling median ± MAD, 3-consecutive-day rule | recovery debt; single days are noise by construction |
| `completionRate` | 7-day and 28-day weighted by session importance | adherence, and whether the plan is over-prescribed |
| `loadMonotony` | 7-day (week SD / mean) | monotony, not just load, drives overuse risk |
| `painTrajectory` | per body site, 3-entry | the fastest-moving signal we have and the one with the lowest threshold to interrupt |
| `intentMix` | 8-week | *why* sessions get missed; predicts whether the plan or the life is the problem |

Every signal stores `inputSet` and `requires[]` so the UI can say "HR drift needs a connected device"
instead of showing a misleading empty trend (P5).

---

## 3. Policy evaluation

Rules live in `knowledge/heuristics/*.yaml`, versioned with the knowledge hash, evaluated in a
**fixed priority order**, and each emits zero or one typed `Action`:

```yaml
- id: DF-014
  when: status == 'skipped' && reason_intent == 'illness' && (fever == true || symptoms_below_neck == true)
  then: { action: hard_stop, scope: 'until 48h symptom-free', downgrade_remaining_block: true }
  severity: hard-stop          # one of advisory | constraint | hard-stop; the action is in then:
  provenance: knowledge/feedback-and-autoregulation/… ; knowledge/risk-and-safety/…
  confidence: high
```

Precedence: `safety-hard-stops` → `missed-session-rules` → `daily-feedback-rules` →
`load-progression` → `review-triggers`. Conflicts resolve by tier, then by "the more conservative
action wins" — a documented, testable rule, because "the engine said two different things about
tomorrow" is the most trust-destroying bug this product can have.

**Actions are capped**: at most one micro-adjustment and at most one review flag per day. Otherwise
one entry triggers a cascade and tomorrow's calendar silently becomes unrecognisable.

---

## 4. Micro-adjustment

Scope: tomorrow (rarely +2 days). Kinds: `keep | downgrade | upgrade-within-plan | swap | shift |
shorten | insert-rest | reduce-dose`.

Invariants (from `missed-session-rules.yaml`, enforced by the engine, not by the rule author):

1. Never create two high-cost sessions adjacent; shifting one session must cascade, and the cascade
   is deterministic and bounded (max 3 sessions displaced, then the rest gets dropped, not deferred
   forever).
2. Never *add* volume above the progression ceiling to "make up" a missed session. Missed work is
   gone; the plan adapts around it. (This single rule prevents most adaptive-app injuries.)
3. Race-week sessions are shift-only.
4. Every micro-adjustment renders as a visible chip on tomorrow's cell:
   *"Thursday → easy 40′ (was: cruise intervals) — because you logged 6/10 legs and 5 h sleep."*
5. Reversible with one tap, and the reversal is recorded — a rejected adjustment is calibration data.
6. Weekly summary reports a counter: adjustments made, accepted, reverted. A high revert rate means
   our model is wrong or our tone is wrong, and it is a headline metric, not a hidden one.

---

## 5. The system comment

Two to four sentences, one idea each. Structure (the "AIR" contract):

1. **Acknowledge** something specific from today (the session, a number, the streak, the gap).
2. **Interpret** in plain language, with the confidence we actually have.
3. **Redirect** to tomorrow: what is on the calendar, and what the runner should watch for.

Never: diagnose, guarantee, shame, moralise a missed session, stack three numbers on a tired user,
or invent a fact absent from the `FactObject`. If the rule fired with nothing specific to say, the
system says nothing (silence is a valid, low-noise outcome and preserves the value of the comments
that do appear).

Generation pipeline (see [architecture/system-overview.md](../architecture/system-overview.md#narrator)):

```
RuleAction + FactObject
   → choose template id (per rule, per tone, per language)     ← deterministic, tested
   → fill slots from FactObject only                            ← numbers come from data
   → optional LLM rewrite (same language, same numbers, ≤ 4 sentences, schema-validated)
   → guardrail check: every number present in the FactObject; no banned patterns (diagnosis,
     promises, weight/diet talk); length limit; language match
   → fallback to the deterministic template text on any failure
```

The template-only path must be a **complete product feature**, not a degraded mode: it is the
offline, cheap, auditable, deterministic baseline that the LLM path is measured against. Examples
and banned phrasings: [ux/feedback-microcopy.md](../ux/feedback-microcopy.md).

---

## 6. Day state machine

```
planned ──► in_progress ──► awaiting_log ──► logged ──► commented ──► resolved
   │                            │                                      │
   │                            ├── (no entry by 23:59 local) ──► unlogged ──► (nudge once, then drop)
   │                            └── device activity matched ──► prefill offered
   └── safety flag (pain/illness) ──► constrained  (only downgrade allowed)
                                      └──► review_candidate
```

`unlogged` days are matched against device activities opportunistically; a match offers a *prefill*
the runner confirms — we never auto-create a completed-session record from a stray GPS file (a
watch left in a pocket must not rewrite history).

Day boundary: the runner's stored timezone, `dayStartHour` default 04:00 so a 06:00 run belongs to
that day and a late-night treadmill run still belongs to the day it felt like. DST transitions use
the date, not the instant (see [ux/calendar-and-time.md](../ux/calendar-and-time.md)).

---

## 7. Loop health metrics (are we helping?)

`feedback-loop-metrics.md` defines these properly; the product-relevant four:

1. **Log continuity** and, more importantly, **log quality by day type** — if hard days are logged
   40% less than easy days, every downstream signal is biased exactly where it matters.
2. **Comment comprehension** — a monthly one-tap "was that useful / clear?" on a sample.
3. **Adjustment acceptance / revert rate** (§4.6).
4. **Time-to-flag** for overreach and pain, and the runner's later verdict on that flag.
