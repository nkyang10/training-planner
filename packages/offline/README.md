# packages/offline

The offline queue's rules, pure and browser-free. The browser supplies IndexedDB and a network; this package
decides what may be replayed, when, and what a failure means.

```ts
let state: QueueState = { drafts: [] };
state = enqueue(state, { key, day, form, nowMs });
const due = dueForReplay(state, { nowMs, online, maxAttempts: 5, backoffMs: [30_000, 60_000, 300_000] });
state = recordSuccess(state, key);              // or recordFailure(state, key, { nowMs, error, backoffMs })
```

Time arrives as **milliseconds since the epoch**, so "an hour later" is one argument and the package contains no
`Date` at all — the purity gate would reject one.

## Four rules, each of which exists because its absence loses an entry

| Rule | What it prevents |
|---|---|
| **Enqueue is idempotent by key** | a double tap on a flaky connection becoming two drafts, and then two writes |
| **Nothing replays while offline** | a replay loop on a dead network burning the attempt budget and abandoning a draft that would have worked a minute later |
| **A failure keeps the draft** | the entry disappearing because the server said 500 once |
| **Abandonment is a state, not a deletion** | the client pretending a draft was saved; after the ceiling it stays in the state so the page can say "this one needs you" |

## What this package is not

- **It is not the storage.** IndexedDB lives in the browser script (`apps/web/public/queue.js`), which is
  deliberately thin: it stores a draft under its key, never replays offline, and never deletes a draft the server
  did not accept. The policy lives here, where it is tested.
- **It is not a retry timer.** `dueForReplay` answers "what may go now", not "wake me in 30 seconds"; the caller
  owns the timer, and the tests own the arithmetic.
- **It does not know HTTP.** `replayRequest(draft)` produces the form body, including `source: "offline-queue"`,
  so the stored entry records where it really came from.
