# packages/replan

Bounded candidate changes for a review. It **proposes**; it never opens, decides or stores.

```ts
const { options, refusals, firstEditableDay } = proposePlanOptions({ plan, today, candidate, knowledge });
// options[0] is always keep-the-plan; the rest are one-change candidates with a diff, a cost and a load delta
```

## Four guards, in the order they matter

| Guard | Rule | What it prevents |
|---|---|---|
| **freeze window** | nothing at or before `today + review-triggers.yaml#freeze_window_days` may change | a review that can move tomorrow is a review the runner cannot trust this evening |
| **one change per option** | `diffPlans` produced exactly one change, and `changeCountWithinLimit` holds | an option that needs three changes is a rewrite wearing a review's clothes |
| **planner invariants** | a candidate that introduces a violation **on a day it changes** is refused, not offered with a warning | offering a plan the planner itself would reject |
| **no added load under safety** | every option is subtractive; a safety-critical trigger gets reductions only | a "review" that adds intensity to an injured runner |

## Two options today

| Option | Change | Cost (numbers, not prose) |
|---|---|---|
| `downgrade-next-quality` | the next quality session after the freeze window becomes easy, distance × (1 − `wellness.yaml#downgrade_magnitude_pct`) | `quality-stimulus-lost` + `{day, beforeKm, afterKm}` |
| `rest-instead-of-easy` | the next easy day becomes a rest day (`outcome: "rest"` too — `rest-is-rest` is a real invariant) | `easy-stimulus-lost` + `{day, km}` |

If the plan has no target for an option, the option is **refused with a reason** instead of being invented, and a
plan whose horizon is empty returns only keep-the-plan — which `packages/review` then refuses to open, correctly.

## The `weekly-increment-ceiling` finding, and where it was fixed

A reduction of week N lowers the base of week N+1, so the invariant fired on week N+1 (`adds 1.10 km/wk, ceiling
is 0.54 km`) even though the absolute load there was unchanged. Refusing on that would deadlock the engine: the
plan-too-big review would never be able to offer the reduction it exists to offer.

The fix is in the invariant, not in this package: `checkInvariants` now takes `baseVersion`, and with it the check
asks *"does this plan add load relative to the plan the runner was already on?"*. This package passes the base plan
it is changing, and attribution stays scoped to the days an option changes as a second line of defence. Every
option here is subtractive, so the direction that would matter (added load) cannot happen; a candidate that
adds load is still refused, and the planner-core tests prove it.

## What this package is not

- **It is not storage.** A proposed child version is returned in memory and its **diff** is stored by the caller as
  evidence; the child version itself becomes a row only when the runner accepts (backlog row 28).
- **It is not the decision.** `packages/review` opens and the runner chooses; this package never sets a status.
- **It is not a re-planner.** It changes one day in a way the corpus justifies; a genuine re-plan (phase rebuild,
  goal change) is M3's larger engine.
- **It does not phrase the cost.** `costKey` + `costSlots` are the record; the narrator owns the sentence.
