---
status: draft
last_reviewed: 2026-11-03
---

# Planner engine

The generator that turns **who the runner is + what they want + what has actually happened** into a
dated sequence of sessions. Lives in `packages/planner-core` as a **pure, deterministic** module: no
clock, no random, no I/O, no LLM. Time, randomness and knowledge are arguments.

```
generate({ profile, evidence, state, calendar, constraints, knowledgeBundle, seed, clock, revisionRequest })
   → { planVersion, sessions[], generationReport, openQuestions[] }
```

---

## 1. Inputs

### 1.1 `profile` — slow-changing, edited by the runner
| Group | Fields | Notes |
|---|---|---|
| Identity | `birthYear`, `sex`, `heightCm*` | *optional; never for weight goals — only for context |
| Background | `yearsRunning`, `recentWeeklyKmAvg`, `longestRecentLongRun`, `runsPerWeekCurrently`, `recentConsistency` (weeks/12) | the single most predictive group |
| Evidence | recent races/time-trials `{date, distance, time, conditions}`, `currentTestPace`, `hrMax`, `lthr`, `restingHr` | drives pace derivation; absent evidence ⇒ conservative default + a test workout in week 1–2 |
| Goal | `priorityRace {date, distance, kind: time-goal/finish/experience/bqualify}`, `secondaryRaces[]`, `goalConfidence` | one priority race; others are ranked |
| Availability | `daysAvailable[]` (weekday pattern), `minutesPerSession{min,max}`, `longRunDay`, `hardDaysAllowed[]`, `fixedCalendar[]` (travel, work, family) | **hard constraints**, never violated |
| Constraints | `injuryHistory[]` (site, trigger, recency), `healthFlags[]`, `surfaceOptions`, `temperatureSeason`, `strengthAccess`, `otherSports[]` | shapes exercise choice, not just load |
| Preference | `planStyle` (structured/flexible), `riskAppetite`, `hardSessionCapPerWeek`, `language`, `commentVerbosity` | autonomy knob (P3) |

### 1.2 `evidence` — computed, read-only, from the event log
`fitnessSnapshot` (CTL, ATL, TSB, 28-day load trend), `predictedPaces[]` with `confidence`,
`adherenceRate{4w,12w}`, `paceVsPrescription{}`, `rpeVsPaceDrift`, `wellnessEwma{}`,
`hrDecouplingTrend`, `painLogSummary`, `mileageHistoryWeekly[]`, `detectedPlateau{}`.

### 1.3 `state` — the current plan's reality
`activePlanVersionId`, `completedSessions[]`, `openMicroAdjustments[]`, `lastReview{date, outcome,
rejections[]}`, `unresolvedFlags[]` (pain, illness, missed streak).

### 1.4 `revisionRequest` (optional) — present only when this generation is a **review**
`{ reason, userIntent, scope: from-date, options considered, mustPreserve[] }`. Its presence is the
only legitimate way to rewrite the future.

---

## 2. Output

A `PlanVersion` (immutable) containing:

- `phaseMap` — dated phase boundaries (base / build / sharpen / race / taper / recovery).
- `weeklyTargets` — volume and intensity budget per ISO week, plus the *distribution* target.
- `sessions[]` — one per calendar day, each with:
  - `kind` (easy, long, tempo, vo2max, MP, strides, recovery, rest, cross, strength, test, race),
  - `structure[]` — warmup / main sets / reps / recovery jog / cooldown, as concrete numbers,
  - `targets` — `{paceMin, paceMax, hrMin, hrMax, rpeTarget}` and *which* authority wins when they
    disagree (`primaryTarget: rpe | hr | pace`) — for easy days this is deliberately **RPE/talk
    test**, because pace-chasing on easy days is the most common self-inflicted error,
  - `purpose` — one line the UI can show verbatim ("aerobic durability at race effort"),
  - `alternate` — the "if today goes wrong" branch: `shortened`, `substitute`, `moveTo` (with its
    own cascade rules, see [feedback-loop.md](feedback-loop.md#missed-session-handling)),
  - `nonNegotiable: boolean` — only race-adjacent and key structural sessions may be true; ≤ 2/week,
  - `explain` — `{ruleIds[], knowledgeRefs[]}` so any session can answer "why is this here?" and
    link to the prose file in `knowledge/`.
- `generationReport` — what was assumed, what was ignored and why, `openQuestions[]` (max 3, asked
  one at a time in the UI), and `warnings[]` for infeasible preferences.

---

## 3. Knowledge bundle

`knowledgeBundle` = the machine-readable rules in `knowledge/heuristics/*.yaml` plus pace/zone
tables plus workout-library templates, frozen at build time and identified by a **content hash**
stored on every generated plan version. Consequences:

- A plan says which knowledge version produced it ⇒ a plan from March can still be explained after
  the rules changed in August.
- Rule changes are code changes: they require golden tests (see [eval](../../eval/README.md)).
- Every numeric knob has a `range` the engine clamps to; out-of-range values are a build error, not
  a silent mis-generation.

---

## 4. Generation algorithm (ordered passes)

Each pass narrows the solution space. Passes are deterministic; where several candidates tie, the
tie-break is a documented, stable ordering (never hash order, never object key order).

### Pass 0 — Establish the measurement baseline
Derive training paces from the *most recent, most specific, best-conditioned* evidence.
Order of authority: recent race over same distance → recent race at other distance (distance-time
prediction) → field test → self-reported typical pace → population default (flagged `low`
confidence). Every derived pace carries `confidence` and `expiresAt`; the planner refuses to build a
high-intensity block on `low` confidence and inserts a test session instead
(`knowledge/plan-construction/measurement-and-testing.md`).
Paces are **not** re-derived mid-block: changing paces mid-week makes adherence unmeasurable.
Re-baseline at phase boundaries or after a review with new evidence.

### Pass 1 — Season structure from the race calendar
Priority race anchors everything. Phase lengths come from distance + background (a novice marathon
build is not a 10-week elite build), then work backwards: taper ← sharpen ← build ← base, with a
recovery week after each race. Secondary races are converted into tune-up races or hard sessions
(`phase-transition-rules.md`). When two races conflict, the plan states which one it is sacrificing
for — this is a *stated trade-off*, not a silent compromise.

### Pass 2 — Weekly volume curve
Start from **actual recent sustained volume**, never from stated aspiration. Progression with
caps (`load-progression.yaml`): step weeks and down weeks, per-week increment ceiling that shrinks
with distance-from-race and with age/injury history, a long-run ceiling, and a hard "never exceed
X% of the highest recent week" rule after any layoff. The curve is generated first and defended in
later passes — volume is the least negotiable variable because it is the dominant modifiable injury
risk factor.

### Pass 3 — Week skeleton (day placement)
Instantiate a `weekly-templates.md` template for the runner's `daysAvailable`, then hard-align to
the real calendar (`fixedCalendar`, travel weeks, `longRunDay`). Rules: min 48 h between
high-neural-cost sessions for most runners, longer for masters; the long run on the day that is
actually free; nothing hard the day before a non-negotiable session; ≥1 full rest day pattern.
Templates are chosen by `runsPerWeek` and phase, then *verified* against availability; a template
that cannot fit is discarded in a fixed preference order.

### Pass 4 — Session-type allocation under an intensity-distribution target
Allocate session kinds to the skeleton slots to hit the distribution target (default polarized
~80/20 by **time at intensity**, evaluated on a **rolling 4-week window**, never on a single week —
one week at 70/30 inside an 80/20 block is noise). Enforce per-week kind ceilings
(`knowledge/heuristics/workout-dosage.yaml`): e.g. one V̇O₂max-class session per week for most runners, no more than
two "moderate-hard" quality sessions, strides dosed as neuromuscular work rather than as fitness.
This is the pass where an integer/CP-style allocation is appropriate (small search space: 7 slots ×
~10 kinds with constraints), solved by constrained greedy + repair rather than brute force; the
implementation must remain deterministic and explainable (record the objective score of the chosen
solution).

### Pass 5 — Prescribe the content
From `knowledge/workout-library/`, instantiate structure and dose for the session kind, phase,
goal-pace and current volume. Add progression within a block (e.g. cruise intervals 3×8′ → 4×8′ →
3×10′ → 5×6′) using documented progressions, not arbitrary increases. Attach `purpose`, `alternate`,
`targets` with `primaryTarget`, and `explain`.

### Pass 6 — Taper, race week, post-race
Taper = keep intensity, drop volume, extend rest — model per `taper-and-peak.md` (length by
distance; exponential or linear; last hard session timing). Race week is generated as a fixed
template with the runner's own last-week habits merged in. Post-race forces a recovery block and a
**measurement checkpoint** (this is where paces legitimately get re-derived).

### Pass 7 — Constraint repair and safety pass
Run all hard constraints; if violated, repair in a fixed order (downgrade → relocate → substitute →
delete) with the reason recorded. Then the safety layer runs **last and can only subtract**
([safety-layer.md](safety-layer.md)). Repair traces go in `generationReport` so the UI can explain
"Thursday became easy because a threshold session already sits on Wednesday".

### Pass 8 — Feasibility check and honest failure
If the constraint set is infeasible (30 min/day, 2 days, marathon sub-3:15, current 25 km/week),
the engine **does not silently compromise the goal**. It returns `openQuestions[]` and 2–3
feasible goal options with their stated cost ("keep the race date and target 3:40", or "keep 3:15
and choose a spring race"). Honesty about infeasibility is a feature (P5).

---

## 5. Horizon, freeze window, regeneration

- **Generate**: whole-plan structure immediately (phases + weekly targets + session kinds all the way
  to race day), *content* for the next `contentHorizon` (default 14 days) with full detail.
  Far-future days are intentionally coarse: pretending to know Wednesday's exact set 10 weeks out
  is theatre and makes every adaptation a "rewrite".
- **Rolling regeneration**: nightly job refines days inside the content horizon; weekly regeneration
  re-optimises the next 2–3 weeks using the last 4 weeks of evidence. This is *not* a review — it
  only refines unexecuted detail and must be diff-visible in the weekly summary.
- **Freeze window**: the next `freezeDays` (default 2) are committed. Inside the freeze window only
  two things may happen: a safety downgrade, or an explicit micro-adjustment from today's feedback
  (which is visible and reversible).
- **Regeneration budget**: a weekly regeneration may not change more than N future session kinds
  without escalating to a review. Prevents the rolling job from becoming a stealth review.

---

## 6. Determinism requirements (testable, not aspirational)

1. No `Date.now()`, `Math.random()`, `process.env`, fs, or network in the core. Inject `clock`,
   `seed`, `knowledgeBundle`.
2. Use a seedable PRNG only for documented tie-breaking/variation (e.g. workout variety), so
   "variety" is reproducible.
3. Stable sorts with explicit comparators. No iteration over object keys where insertion order
   could vary.
4. All times ISO-8601 with explicit zone; the plan stores the runner's `tz` so a device in another
   zone doesn't move sessions.
5. Floating-point arithmetic for paces uses a fixed rounding policy (round to 5 s/km, distances to
   0.1 km) — cosmetic jitter in a golden test is a real diff to a runner.
6. `planVersion.hash = sha256(canonical-json(inputs) + knowledgeHash)`.

---

## 7. Plan versioning and diffs

States: `draft → active → superseded | archived`. Completed days never change. A review creates a
child version with `parentVersionId`, and the UI diff is computed between parent and child over the
`from-date`:

- per-day: `unchanged | changed(kind|dose|targets) | added | removed | moved`
- aggregate "cost": weekly km Δ, key sessions Δ, intensity-distribution Δ, phase-boundary shift,
  projected readiness at race day, and what is given up ("−1 VO2max session in weeks 6–9 costs
  peak-speed confidence, buys recovery margin").
- `mustPreserve[]` from the review request is enforced as hard constraints in the child generation.

The diff object is a first-class API artefact (`schemas/json/plan-diff.schema.json`) — the same
structure feeds the UI, the review record, and the audit log.

---

## 8. What the planner must never do

- Invent evidence ("you said 45 min 10K" when nothing was logged) — mark estimates as estimates.
- Raise intensity in response to a good feeling without a phase justification. Good days are
  *permission to hold*, not to add, unless the progression curve already had it.
- Violate availability, injury history, or a safety flag to hit a plan number.
- Rewrite history to make metrics look better.
- Depend on a device being connected to produce a plan, a comment, or a review.
