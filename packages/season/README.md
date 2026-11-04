# `packages/season` — what the plan asked for, and what happened

The season view's only logic. `seasonSummary({ plan, entries, today })` returns the plan's weeks with planned and
completed kilometres, sessions, hard days, logging days, and one adherence percentage.

## What it does not do

- **No clock.** `today` is an argument; the caller (API or web) reads the clock, because the composition root owns
  the clock and this package owns arithmetic.
- **No language.** The caller renders the numbers; this package returns numbers and statuses.
- **No storage.** Entries and the plan version come in as arguments.

## The rules, and why

- **Latest revision per day wins.** An entry is a revision, and the newest one is the day's answer; a day is never
  counted twice.
- **Completed kilometres follow the worker's close rule**: the reported distance when there is one, the prescribed
  distance when the runner said "done as planned", zero otherwise. Two different rules would make the calendar and
  the season disagree about the same week.
- **Adherence only counts days that have happened.** A half-finished season cannot be "50 % behind" because the
  second half has not been run yet, and the current week is included day by day, which is what makes the number
  move on a Wednesday instead of only on Mondays. No days yet is `null`, not `0`: a rate over no days is unknown,
  not zero.
- **A partial first or last week is smaller than seven days**, and `plannedDays` says so; the week is a calendar
  week because that is how the runner lives, not a seven-day block from the plan's first day.

## Tests

`test/season.test.ts` covers the empty plan, the partial first week, future weeks, latest-revision-wins, the
reported-versus-prescribed distance rule, the adherence denominator, and the `null` rate.
