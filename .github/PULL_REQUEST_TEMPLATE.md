<!-- Keep the title conventional: feat|fix|test|knowledge|chore|docs: <what> (<area>) -->

## Why

Closes #

Layer: [ ] leaf  [ ] spine  [ ] stacked on #___ (do not merge before it)

## What changed

## Which rule does this protect?

One line. If the answer is "none", the change probably should not exist.

## Gate evidence

- [ ] `tools/audit-links.ps1` prints `MISSING ANCHORS: 0 / MISSING YAML FILES: 0 / BAD SOURCE IDS: 0 / DEAD LINKS: 0`
- [ ] Knowledge: no number copied; new knob has `range` + `confidence` + resolvable source ids; `last_reviewed` bumped
- [ ] Planner: golden plans pass **and** a new fixture encodes the reason for this change
- [ ] UI: `en` and `zh-Hant` both updated; tone rules respected (no shame / diagnosis / weight / guarantees)
- [ ] Safety: subtract-only (nothing added intensity); hard stop still not one-tap overridable
- [ ] Data: `user_id` present, RLS still holds; completed days untouched

## Cost of being wrong

What breaks for a runner, and how we would notice. Two sentences, honestly.
