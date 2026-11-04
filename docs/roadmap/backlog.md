---
status: draft
last_reviewed: 2026-11-04
---

# Backlog

Not a schedule — an ordered set of things we believe, with the evidence that would change our mind.
Effort: S (< 1 wk) · M (1–3 wk) · L (> 3 wk).

## Now (M2)

Rows 8--11 came out of [the end-user 5W1H self-review](../review/2026-11-03-enduser-5w1h-review.md)
(F1--F10); F1 and F2 are launch blockers for the loop itself, not polish. Rows 12--16 came out of
[the M1 coach sign-off](../review/2026-11-04-m1-coach-signoff.md) (F2--F6 there): coaching-quality
findings that do not make a plan unsafe, which is why M1 closed with them recorded rather than fixed.

| # | Item | Why | Effort | Risk if skipped |
|---|---|---|---|---|
| 1 | Encode the 6 golden-plan personas as fixtures with coach-annotated expectations | the planner's specification; every later rule change is measured against it | M | planner correctness becomes opinion |
| 2 | Knowledge lint in CI (`last_reviewed` age, source ids resolve, `status` values, `→ rule:` links resolve) | the knowledge base is a product artifact; rot is silent | S | knowledge drifts from code invisibly |
| 3 | Message-catalogue completeness check `en` vs `zh-Hant` | a missing key at launch looks like a broken product for half the users | S | fallback language leaks into the comment |
| 4 | Banned-output test suite for the narrator (diagnosis, weight/calorie, guarantees, shame) in both languages | safety requirement, not style | S | our worst failure mode ships in prose |
| 5 | Entry-form timing instrumented from day one of M2 | adherence is the business risk; we must see it in week 1 | S | guessing at the biggest risk |
| 6 | Remaining contracts: `plan-version` and `events` JSON Schema, then `schemas/sql/schema.sql` | `plan-diff` and `review` are written; the DDL is where RLS becomes real | M | engine and UI inventing two different shapes |
| 7 | `docs/engine/explanation-and-trust.md` + `docs/vision/personas-and-journeys.md` | the comment is half the product; explaining a plan is the trust surface | S | trust work deferred until it is a redesign |
| 10 | Sessions the runner does not control: club night, parkrun, pacing a friend (**F3**) | the group decides Tuesday; the plan has to survive that | S | every club runner's first week is fiction |
| 12 | Distance-aware long-run band (M1 review F2: an 11.4 km longest run for a 50 km trail race) | one `long_run_share_pct` cannot serve a 5K and a 50K; the corpus needs a band keyed by race distance | M | ultra and marathon plans that cannot possibly prepare the runner |
| 14 | Terrain-aware session kinds (M1 review F4: no hills in a trail ultra plan) | `hills` exists as a kind and is never selected from terrain | S | trail plans that train like road plans |
| 16 | A target-peak notion derived from race distance (M1 review F6: race blocks cannot exceed recent volume) | the curve is purely incremental, so a 7-week race block holds volume instead of building it, and the planner cannot tell "hold" from "fail to build" | L | marathon blocks that never build, with nothing in the plan saying so |
| 19 | Store pain reports as their own rows with ids, referenced from the entry and the event | ADR-0006 keeps health free text out of the event log, and the pain triage rules need a trajectory across reports, not one array inside an entry | M | pain history is a blob inside entries, and the triage cannot see a trend |


| 27 | Fix `review-triggers.yaml`'s `load-rising-too-fast`: it names `load-progression.weekly_increment_pct_effective`, which is not a knob | the knob is `weekly_increment_pct` (8 %) with `weekly_increment_pct_conservative` (5 %); the code now reads the knob that exists, but the corpus text still names a phantom. Found while implementing the trigger | S | the rule's provenance points at a number nobody can find |
| 30 | Apply or narrow `session_kinds_forbidden_by_persona`: the corpus forbids tempo for `novice-first-5k`, the engine still prescribes it from the second quality slot | measured 2026-11-04: the list says `threshold, tempo, cruise, interval, track_repeats, mp` for a novice, its rationale claimed the golden plan asserted `mustNotContain`, the format had no such field and the runner asserted no kind list, and `novice-5k`'s plan contains tempo from week 2. `packages/planner-core` now applies only the weaker `first_quality_kind` rule (row 15) | M | the corpus forbids a kind the engine prescribes, and no gate can see it |
| 33 | Heat/altitude cost, travel week shift, and the delete-account screen | the rest of row 11. The cost and the shift are planning rules that need corpus evidence and golden fixtures; delete-account needs the purge path wired to a real database (rows 24/26) and a screen that files the request rather than pretending a tap erases history | M | the surfaces row 11 promised are still half missing, and "delete my account" stays a promise with no door |
| 34 | Alternate cost is not on any surface | `packages/review` and `packages/replan` already compute what an option gives up (`costKey`, `costSlots`), and the review sheet shows it; what is missing is the daily case: a runner who logged `sessionTaken: alternate` or `extra` never sees what that choice cost against the prescription. Needs a narrator template keyed on the alternate, a place on the day page, and the copy rules that keep it a trade-off rather than a scolding | S | the trade-off is the product's promise, and half of it is still invisible |
| 26 | Wire the sweep to a scheduler and persist its output (`signals_current`, closed days) | `packages/worker` decides the sweep and the CLI runs it once; what is left is a process that runs it on a schedule, a Postgres write for the cache, and the day-close event type (row 18). All three need deployment or a database | M | the sweep exists and nothing runs it on a schedule |
| 24 | The Postgres adapter behind `Repository`, with migrations and row-level security | the interface and the in-memory reference adapter exist and are contract-tested; the database adapter is the first place RLS becomes real (ADR-0002), and it cannot be verified without a database | L | the product cannot leave one process, and RLS stays an unproven claim |

### Landed in M2

Rows that were open and are now shipped, kept here so the backlog stays a list of open work only.

| # | Item | Where it landed |
|---|---|---|
| 13 | State the 7-day-normalised rate wherever a week is partial | [PR #29](https://github.com/nkyang10/training-planner/pull/29): `summariseWeeks` + `explain.partial`, and the CLI prints `3.9 km over 4 days, which is 6.8 km at a full week's rate` |
| 22 | The offline queue | [PR #34](https://github.com/nkyang10/training-planner/pull/34): `packages/offline` (rules, 16 tests) + `apps/web/public/queue.js` (IndexedDB, replay with `source=offline-queue`) |
| 23 | The review sheet | [PR #35](https://github.com/nkyang10/training-planner/pull/35): `GET`/`POST /review/:reviewId` plus the week banner; the ordering and freeze window are `packages/review`'s rules, the page only renders them |
| 25 | The M3 option generator | PR #38: `packages/replan` (bounded one-change options with diffs, costs and invariant guards) plus `POST /reviews/open`, which closes log → signals → triggers → options → open review |
| 28 | Materialise the child plan version on acceptance | PR #39: staged proposals in `packages/storage` (`saveProposedPlanVersion`, `activatePlanVersionForDiff`) and the accept path in the API and the web sheet; the week page shows the accepted plan on the next load |
| 26 | The nightly sweep's decisions | PR #40: `packages/worker` (idempotent, plan-bounded, absence-aware, cache snapshot) plus `planner sweep`; what remains is the scheduler and the cache write, recorded in row 26 above |
| 29 | `weekly-increment-ceiling` judged against the base plan | PR #41: `checkInvariants` takes `baseVersion`, so a review reduction is judged by whether the plan adds load relative to the plan the runner was on, not by the ratio the reduction created; a candidate that adds load is still refused, and a new week still has to earn its own baseline |
| 20 | `SessionTaken` has a partial marker | PR #42: `partial` in the wire enum, the DDL CHECK and the two-axes CHECK, the domain type, the entry pipeline's coherence rules, and the web form's distance field — a partly-done day is now storable and readable instead of a dead end with a button on it |
| 21 | The `sessionTaken: null` contradiction | PR #42: the enum loses null, the description says absence is an omitted key, the domain type loses `| null`, and `invalid-session-taken-null.json` keeps it from coming back |
| 18 | The `day.closed` event type | PR #43: the catalogue row, an `events.schema.json` clause that lets only the system or the worker close a day, `DayCloseStatus`/`DayClosePayload`, `closeEventFor` in `packages/entries`, and the sweep now returns the events a writer should append |
| 17 | `muscleSoreness` is the one spelling | PR #44: canonical name in the wire and the frozen interface, the legacy spelling kept for a window ending 2027-02-04, a write-path normalisation and a refusal when both are present |
| 15 | Neuromuscular before threshold | PR #45: `session-classes.yaml#first_quality_kind` (read with the new `knowledge.text`), the sequencing rule in the planner, `knowledge/plan-construction/quality-sequencing.md`, four planner-core tests, and the golden fixture `novice-first-quality-strides` plus the `qualityKinds` expectation it needed |
| 8 | Feedback-prompt policy (F1) | PR #46: `knowledge/heuristics/feedback-prompts.yaml` (hour, lookback, sample floor, quiet window, ladder, two budgets) plus `packages/nudges` with five gates and 17 tests; copy is `prompt.*` in both catalogues; delivery and persistence stay with the worker/API rows |
| 31 | `prompt_deliveries` gets its DDL row | PR #48: the table (PK `(user_id, day, kind)`, `for_day <= day`), the tenant policy factory call, append-only (dropped UPDATE/DELETE policies plus the `refuse_mutation` trigger), the revoke, the purge list entry, and the append-only ruler in `tools/check-claims.sql` now names it |
| 9 | Elapsed time lands; alternate cost moves to row 34 | PR #51: `pace-bands.yaml#elapsed_estimate` (two offsets, low confidence, no pace evidence means no duration), the planner's `durationMin` from the pace the plan already prescribes, the web label's "about N min", 5 planner tests, a ninth golden fixture (`elapsed-time-easy`) with per-day duration assertions, and the prose section in `key-workout-dosage.md` |
| 11 | Season view and export land; heat/altitude cost, travel shift and delete-account stay in row 33 | PR #50: `packages/season` (weekly planned-versus-done, calendar weeks, latest revision wins, adherence over days that happened), `GET /season` on both surfaces, `GET /export` from one `exportDocument` definition, and `Repository.listPlanVersions` so the export is the history |
| 32 | `PromptDelivery` gets its JSON contract | PR #49: `schemas/json/prompt-delivery.schema.json`, the generated zod mirror, three fixtures (valid, bad kind, atMinute 1440), and a write-path parse in the reference adapter so a row the contract rejects is not storable |

## Next (M3–M5)

| Item | Why | Effort |
|---|---|---|
| Review-option cost model (state the cost of every option numerically) | consent without cost is not consent | M |
| Post-hoc missed-event audit (what runners reported that policy did not flag) | the only honest way to tune escalation | M |
| Individual ramp-tolerance calibration from the runner's own history | population defaults are the reason generic plans fail | L |
| `alternate` session branches used deliberately (plan B for a bad morning) | turns "I failed the session" into "I chose the other option" | M |
| Pace-evidence provenance UI ("why these paces, and when they expire") | pace distrust kills plan trust | M |
| GPX/CSV import + manual activity creation polish | manual-first must not mean manual-punishing | M |
| Notification budget per user + local scheduling (promoted to `knowledge/engagement-policy`, **F1**) | spam kills the loop quietly | S |
| Accessibility pass (keyboard calendar, colour-independent states, screen-reader labels) | a runner with low vision is a user | M |

## Later, deliberately

| Item | Why later | Revisit trigger |
|---|---|---|
| Strava beyond 10 athletes (app review) | external gate; submit paperwork early, build later | review granted |
| Garmin / wearables beyond Strava | access unverified ([PROD-S2](../../knowledge/sources/bibliography.md)) | verified access |
| Watch write-back | gated by every vendor; the plan is already usable | a platform opens it |
| Coach/grant tier | needs the grant model in [per-user-isolation](../architecture/per-user-isolation.md#sharing-later-without-breaking-isolation) and legal review of health-data sharing | paying coaches appear |
| Community / anonymous benchmarks | health-adjacent data in aggregates is the riskiest data decision we could make | DPI + k-anonymity design reviewed |
| Multi-sport, strength block, trail-specific terrain modelling | each one multiplies planner states | marathon/5K loop proven |
| Conversational "ask the coach" | collapses the language/decision boundary from [ADR-0007](../adr/0007-llm-language-only-with-template-fallback.md) | rule coverage + eval suite strong enough to defend it |
| Native app | mobile web + push may be enough; the loop is 30 s | push-delivery data says otherwise |
| Second language (Japanese, Simplified Chinese) | catalogue infrastructure makes this cheap later | demand signal |

## Research gaps we are carrying (tracked, not hidden)

| Gap | Current posture | What would resolve it |
|---|---|---|
| Optimal intensity distribution for *amateurs* (80/20 vs pyramidal at ≤ 4 sessions) | use population default (polarised-leaning, capped hard days) and let `rpe_gap` + adherence argue; documented as contested | our own cohort data by persona |
| ACWR as a risk signal | **display only**; never actionable ([metric-definitions](../data/metric-definitions.md#fitness--fatigue)) | a reproducible, uncoupled alternative |
| Garmin API access | assumed gated; nothing depends on it | direct enquiry, not blog posts |
| Does a daily comment cause adherence, or does adherence cause comments? | measure with in-product variation (M5 scaffolding), assume confounded | a designed experiment with real users |
| Individual HRV usefulness in novices | gated behind sufficiency checks; often absent for the first 3 weeks | cohort evidence from our own data |
| Postpartum and masters-specific guardrails beyond current rules | conservative knobs + clinician-referral paths; personas exist but are thin | a coach/physician review pass — the knowledge base needs it, and it is the least-evidenced area we cover |
