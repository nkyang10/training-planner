# packages/worker

The nightly sweep's **decisions**, pure and testable: which days closed, which closed with no entry, and what the
system believed at the moment they closed.

```ts
const { newlyClosed, pending, skipped, signalCache } = runNightlySweep({
  userId, today, entries, plan, knowledge, computedAt, closedDays,
});
```

The scheduler and the writes are deployment work; the rules about a closing day are not.

## Four properties, each why this is a function and not a cron script

| Property | What it means |
|---|---|
| **idempotent** | `closedDays` is an input, so a sweep that runs twice closes nothing the second time (`skipped` says what it passed over) |
| **only the past** | a day closes after it has ended: the window is `plan.firstDay … min(yesterday, plan.lastDay)` |
| **absence is information** | a closed day with no entry is `closed-unlogged` and lands in `pending` — never a zero, never a broken streak |
| **the cache is a snapshot** | the bundle carries `asOfDay`, `inputsHash` and `knowledgeHash`, so a plan can be explained later from the numbers the system actually believed |

## What the sweep does not do

- **It writes nothing.** `apps/api` (or a future worker process) owns persistence. The event catalogue has no
  day-close event type yet — that is backlog row 18, and inventing one here would create a second catalogue.
- **It does not schedule itself.** Cron, a queue, or a platform scheduler is deployment work (M6); the CLI's
  `planner sweep` runs the same function once, which is how it is verified.
- **It does not cache into `signals_current`.** It returns the row to write; the Postgres adapter is backlog row 24.

## Why `pending` is computed over every closed day

Not only over the days this run closed. The nudge list is a property of the log, and a sweep that only looked at its
own output would forget yesterday's gap the moment it ran twice.
