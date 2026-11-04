# packages/nudges

When may a prompt be delivered, and why was it not? Pure, so a decision can be replayed and explained.

```ts
const decision = decideNudge({ userId, today, nowMinute, entries, plan, delivered, loggingHours, knowledge });
// decision.prompt = { kind: "nudge", atMinute, forDay } | null, with a reason and the evidence behind it
```

## Five gates, in the order they matter

| # | Gate | Refusal reason | Why it exists |
|---|---|---|---|
| 1 | nothing to ask | `no-plan` / `already-answered` / `nothing-pending` | a prompt about an answered day is noise |
| 2 | one shared budget | `budget` | a review prompt that does not count arrives on top of the nudge and teaches the runner to ignore both |
| 3 | a nudge already went | `delivered` | a second nudge for the same day is not a reminder, it is a nag |
| 4 | quiet hours | `quiet-hours` | a hard stop, not a preference: never inside the window, and not after it has opened |
| 5 | the runner's own hour | — | the median **local** logging hour once there is enough history, else the default |

The **silence ladder** is gate 1.5: an unanswered gap is asked about on days **1, 3 and 7** after it, and never in
between (`silence_ladder_days`). A fourth attempt is not persistence; it is the runner learning to swipe.

## Numbers are corpus values

Everything the decision needs is a knob in `knowledge/heuristics/feedback-prompts.yaml`: the default hour, the
lookback, the minimum sample count, the quiet window, the ladder and both budgets. The module reads them through
`KnowledgeBundle` and throws on a malformed one — a prompt policy with a silent default is a prompt policy that
lies.

## What this package is not

- **Not delivery.** It returns a decision; a scheduler sends, and a later worker records it (rows 24/26).
- **Not the words.** Copy is `prompt.*` in the message catalogue, in both languages; the narrator owns sentences.
- **Not a clock.** `nowMinute` and `loggingHours` are inputs. `loggingHours` is **local** hour-of-day computed by the
  caller from the entry and its zone, because a median of UTC hours is a median of the wrong clock.
- **Not the review policy.** `packages/review` opens reviews; this package only spends the shared budget that
  decides whether a prompt of any kind may arrive today.
