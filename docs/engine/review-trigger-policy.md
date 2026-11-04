---
status: draft
last_reviewed: 2026-11-03
---

# Review trigger & change-control policy

A **review** is a formal re-planning of the *future*: it reads the accumulated evidence, produces a
diagnosis, proposes a bounded change, shows the cost, and requires the runner's consent before a new
plan version becomes active. Everything below a review is a
[micro-adjustment](feedback-loop.md#micro-adjustment) and must not be able to do what a review does.

> Reviews are expensive in attention. Scarcity is what makes them credible.

---

## 1. Trigger sources

### 1.1 User-triggered (first-class, not an emergency hatch)
Available from the calendar header, the day drawer, and the weekly summary. The runner picks an
intent, which scopes the review — this is where most of the product's practical value lives:

| Intent | Scope implied | Typical must-preserve |
|---|---|---|
| "I'm travelling / work exploded" (`日期要出差`) | the affected date range only | race date, phase end-state |
| "Something hurts" | forward from today, pain-aware | nothing hard in the next 7 days |
| "I've been sick" | restart-from-zero in load terms | race date if > 4 weeks out |
| "This block is boring / too hard / too easy" | intensity distribution & session variety | weekly volume ceiling |
| "I want to change my goal / race date" | whole remaining season | training history |
| "Race went badly" | post-race re-baseline + next cycle | — |
| "Just check me" | read-only review: verdict + narrative, **no diff** | — |

The manual path exists in code: `POST /reviews/manual` opens a review with a manual candidate (`ruleId: null`, so the
review records `openedBy: user-request`), the same bounded option set the engine may offer, and an `orientation`
block that records what the runner's un-applied answers would change. A full re-plan from a changed orientation is a
different proposal shape (a new plan, not at most two edits), and it is tracked separately rather than smuggled in as
a "change".

A read-only review matters: "show me the plan and tell me if it still makes sense" is the most
common real coaching request and must not force a change nobody asked for.

### 1.2 System-triggered
Defined in `knowledge/heuristics/review-triggers.yaml`. Every rule carries one of the three tiers —
`advisory`, `constraint`, `hard-stop` — the same three words as the YAML, the two DDL CHECKs and the
wire enum, compared by `tools/check-vocabulary.ps1` and decided in
[contract-vocabulary.md](../engineering/contract-vocabulary.md) items 5 and 6.

What the runner *sees* is a second question, and it is not a fourth vocabulary: no YAML carries it
and no code computes it yet — that mapping is M1 work. The four presentation levels below are the
product intent, ordered by how hard they interrupt:

| Presentation | What the runner sees | Examples |
|---|---|---|
| interrupt now | a blocking card; the safety layer is already active; cannot be deferred | pain ≥ 7, pain that changes gait, chest pain/syncope, blood in urine, illness with fever below the neck |
| offer at next open | review card offered at next open; auto-applies only a *reduction* if the runner doesn't respond within 48 h (and says so) | 3 consecutive red days, 2 missed key sessions in 7 days, sustained HRV/RHR deviation, load step > ceiling, adherence < 50% with rising RPE |
| weekly summary | queued suggestion in the weekly summary | 3-week plateau on the same key session, `rpeGap` drift, monotony above threshold, sleep deficit trend, intensity distribution badly off over 4 weeks |
| recorded only | recorded, no user interruption | pace-vs-prediction mismatch, long-run drift, secondary race added |

Thresholds, windows and debounce live in the YAML with `provenance` and `range` — this file owns the
*discipline*, the YAML owns the *numbers*, and the numbers only change via a golden-tested rule
change.

---

## 2. Arbitration: when several triggers fire

1. Highest presentation level wins (interrupt now > offer at next open > weekly summary > recorded
   only); same level ⇒ most specific (body-site pain beats general fatigue).
2. **Budget**: at most one review per `dwellDays` (default 7) unless the trigger is interrupt-now. A
   second concurrent trigger is merged into the open review as additional evidence, not queued as a
   second review.
3. **Cooldown**: a rejected review of the same trigger family cannot re-fire for `cooldownFactor ×
   dwellDays`, with an escalation path: two consecutive rejections of the same signal ⇒ stop nagging,
   raise the threshold, and surface it in the weekly summary as a standing note the runner can act on.
   (Annoying a runner into ignoring the review card is worse than missing a soft signal.)
4. An interrupt-now trigger bypasses budget and cooldown, and cannot be produced by more than one
   safety rule per day (dedupe by site/symptom).

---

## 3. Review workflow (in order)

1. **Collect** — snapshot evidence at review time (this snapshot is stored; later data changes must
   not silently mutate why a decision was made).
2. **Classify** — which intent/trigger family, what is at stake, days-to-race.
3. **Diagnose** — candidate causes ranked, each with the evidence for and against. Overreach,
   under-recovery, under-training, illness, bad paces, life load, or "nothing is wrong".
   Explicitly allowed answer: *no change needed*.
4. **Generate options** — 2–3 candidates, always including **"keep the plan, note the risk"**:
   - each option = a new candidate plan version + `plan-diff` + **cost** (what is sacrificed) +
     **expected effect** in ranges, not promises;
   - option set spans a conservative↔aggressive axis so the runner's risk appetite is honoured (P3);
   - safety `critical` reviews generate only reductions, and an option that increases load is not
     offered at all.
5. **Narrate** — the diagnosis narrative (LLM-assisted, fact-object-grounded, same guardrails as the
   comment) + the diff rendered in plain language.
6. **Present** — one screen: verdict, why, options with costs, diff, "what I'll watch for", expiry
   date of the new plan.
7. **Decide** — accept / choose option / edit within allowed bounds / decline-with-reason / defer
   with a scheduled re-check. Decline is a normal, non-punished outcome.
8. **Apply** — create the child plan version; nothing before `from-date` changes; `mustPreserve`
   enforced; the change log entry records rule ids, evidence snapshot hash, chosen option, and the
   runner's stated reason.
9. **Verify** — a follow-up checkpoint is scheduled ("we'll look at this on 2026-11-24"): did the
   change achieve what it claimed? This is what turns a changelog into learning.
10. **Learn** — outcome feeds per-user calibration (how this runner responds to a change) and, at
    the aggregate/opt-in level, the quarterly promotion of patterns into
    `knowledge/case-studies/` → `knowledge/heuristics/` (per
    [MAINTENANCE.md](../../knowledge/MAINTENANCE.md#5-adding-knowledge-from-a-running-season)).

---

## 4. Change-control discipline

| Rule | Reason |
|---|---|
| ≤ 2 changes per review, prefer 1 | two simultaneous changes make the outcome unattributable |
| Never modify executed days | history is the measurement baseline |
| Never change the goal and the plan simultaneously | the goal is the experiment's hypothesis |
| Never re-derive training paces mid-block via a review | paces change at phase boundaries or after a test/race |
| Every change states its cost | a "free" improvement is a sign the model isn't modelling the trade-off |
| Review has an expiry | a plan nobody re-checked since week 6 of 16 is stale, and should say so |
| Full reversibility | any applied review can be rolled back to the parent version with one action |
| Log is append-only and exportable | a runner must be able to hand their season to a human coach or a physio |

### Anti-oscillation
Adaptive systems fail by thrashing. Guards: weekly-regeneration change budget (§5 of
[planner-engine.md](planner-engine.md#horizon-freeze-window-regeneration)), dwell/cooldown above,
**hysteresis** on every threshold (a signal must cross `trigger` to start and fall below
`clear` — a lower value — to end; never one shared line), and a visible "stability" line in the
weekly summary: *changes this month: 2 (1 review, 6 micro-adjustments)*.

---

## 5. What a review must never do

- Increase load while an unresolved pain or illness flag is open (even if the runner asks — offer
  the discussion, not the plan).
- Rewrite the current week's already-completed evidence to fit a new narrative.
- Present a single option, or a change with no cost.
- Fire outside its declared scope (a travel review may not quietly re-base paces).
- Act on a signal whose `requires[]` inputs the user hasn't got (no HRV-based review for a runner
  with no HRV data — say the review is limited and name the blind spot).
- Diagnose, or discuss weight, calories, or body composition.

---

## 6. Measuring review quality

`time-to-detect`, `false-interrupt-rate` (reviews opened and resolved as "nothing wrong"),
`acceptance-rate` by trigger class, `outcome-verified-rate` from step 3.9, `rollback-rate`, and —
the honest one — **what happened to runners whose review the system did not fire**. Missed events
are found via post-hoc audit of seasons that ended in forced rest, DNF, or a pain-driven stop: each
becomes a `case-study` and, if generalisable, a new trigger rule with a golden fixture proving it
would now have fired earlier.
