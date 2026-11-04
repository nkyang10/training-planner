# packages/narrator

A fact object in, sentences out. Nothing is decided here.

```ts
const rendered = renderComment(decision.commentFacts, { locale: "en" });
// rendered.sentences -> string[]   (max 4, AIR order; safety actions speak first)
// rendered.text      -> string     ("" when the day was unlogged: silence is a comment type)
// rendered.nudge     -> string?    (the inbox nudge, a different channel from the comment)

const chip = renderAdjustment(decision.adjustTomorrow, { locale: "zh-Hant" });
// "節奏跑 10 km → 輕鬆跑 8 km —— 改了,因為 今天的回饋偏重;代價: 這週的強度課改成輕鬆跑"
```

This is the template-only path of `docs/engine/feedback-loop.md` §5, and it is a **complete feature**, not a
degraded mode: offline, cheap, auditable, deterministic. An LLM rewrite (later, optional) would be measured
against these sentences and would fall back to them on any failure. **No LLM is reachable from this
package** — AGENTS rule 2 is a dependency graph here, not a promise.

## What it refuses

| Export | What it does |
|---|---|
| `renderDailyCost(cost, { locale })` | fills the `dailyCost` template with the locale's kind name and the fact object's numbers, under the same grounding, banned-language and tone guardrails as a comment |
| Guardrail | Refusal |
|---|---|
| grounding | a number that is not in `commentFacts.allowedNumbers` and not in the template's fixed copy |
| banned language | diagnosis, guarantees, weight/calorie framing, shame, fake precision, streak pressure, toxic positivity, comparison to other runners, emoji — in both languages |
| tone | more exclamation marks than the locale allows (en 1, zh-Hant 0), shouting in capitals |
| script | English output containing CJK, or Chinese output without it |
| slots | a template whose slots are missing, or a placeholder left in the output |

Every one of these has a failing case in `test/narrator.test.ts`. The banned list is data
(`BANNED` in `src/guardrails.ts`), and each category carries the promise it protects, so a failure names the
promise instead of saying "blocked".

## Why numbers are the guardrail's centre

`docs/ux/feedback-microcopy.md` rule 1 says every number in the output must exist in the fact object. The
engine's `CommentFacts` carries `allowedNumbers` precisely so that rule is a comparison instead of a review
habit. Two kinds of number are legitimate:

- **data**: a number the engine chose (distance, RPE, legs, gap) — it is in `allowedNumbers`;
- **copy**: a number inside the fixed sentence (`Rest until you are 48 hours symptom-free`) — it is a rule,
  not a measurement, and it is part of the reviewed copy rather than the fact object.

The check accepts both and nothing else.

## The explanation surface

```ts
renderPlanExplanation(version, { locale });
// "42 sessions over 7 weeks, 42.9 km in total."
// "Week of Monday: 3.9 km, 1 hard session."
// "The first week is partial: 3.9 km over 4 days, which is 6.8 km at a full week's rate."
// "Peak week 8.5 km, longest run 2.7 km."
```

The partial-week sentence is M1 review finding **F3**: the novice block begins on a Thursday, so its raw first
week (3.9 km) looks like a collapse next to week two (7.3 km) while the 7-day-normalised rate moves +8%. A
correct plan that reads as wrong is a plan the runner stops trusting, so the explanation states **both**
numbers. `summariseWeeks()` exposes the same facts for the UI.

## Ordering

- normal days: **acknowledge → interpret → redirect** (the AIR contract);
- a safety action: the fixed instruction is **sentence one** and coaching is suppressed
  (`daily-feedback-rules.yaml#safety-text-first`).

## What this slice does not do

- no LLM phrasing, no catalogue authoring UI, no review narrative (that is a different writer, see
  `docs/ux/feedback-microcopy.md#voice-for-the-two-other-writers`);
- no persistence and no delivery: `apps/api` stores comments, the worker sends nudges;
- no measurement: whether the copy is understood is M2's interview criterion, not a unit test.
