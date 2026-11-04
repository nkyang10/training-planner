/**
 * The queue's rules, as pure functions.
 *
 * Four rules, and each one exists because its absence loses an entry:
 * 1. **Enqueue is idempotent by key.** A double tap on a flaky connection is one draft, not two.
 * 2. **Nothing replays while offline.** A replay loop that fires on a dead network burns attempts and then
 *    abandons a draft that would have succeeded a minute later.
 * 3. **A failure keeps the draft.** It records the error and a backoff, and it never silently drops the entry.
 * 4. **Abandonment is a state, not a deletion.** After the attempt ceiling the draft stays in the state so the
 *    client can say "this one needs you" instead of pretending it was saved.
 *
 * Time arrives as milliseconds since the epoch and the backoff is data, so the whole thing is testable without a
 * browser, a timer or a clock. The module contains no `Date` at all - the purity gate would reject it.
 */
import type { EnqueueInput, QueueState, QueuedDraft, ReplayOptions } from "./types";

const copyDraft = (draft: QueuedDraft): QueuedDraft => ({ ...draft, form: { ...draft.form } });

/** Add a draft, or return the state unchanged when this key is already queued. */
export function enqueue(state: QueueState, input: EnqueueInput): QueueState {
  if (state.drafts.some((draft) => draft.key === input.key)) return state;
  const draft: QueuedDraft = {
    key: input.key,
    day: input.day,
    form: { ...input.form },
    queuedAtMs: input.nowMs,
    attempts: 0,
    lastError: null,
    nextAttemptAtMs: null,
  };
  return { drafts: [...state.drafts.map(copyDraft), draft] };
}

export function pendingCount(state: QueueState): number {
  return state.drafts.length;
}

/** Drafts that have hit the attempt ceiling and need the runner's attention. Never deleted. */
export function abandoned(state: QueueState, maxAttempts: number): QueuedDraft[] {
  return state.drafts.filter((draft) => draft.attempts >= maxAttempts).map(copyDraft);
}

const isDue = (draft: QueuedDraft, nowMs: number, maxAttempts: number): boolean => {
  if (draft.attempts >= maxAttempts) return false;
  const next = draft.nextAttemptAtMs;
  if (next === null || next === undefined) return true;
  return nowMs >= next;
};

/** The drafts to replay now, oldest first. Empty while offline, which is the rule that saves the attempts. */
export function dueForReplay(state: QueueState, options: ReplayOptions): QueuedDraft[] {
  if (!options.online) return [];
  return state.drafts.filter((draft) => isDue(draft, options.nowMs, options.maxAttempts)).map(copyDraft);
}

/** The delay before the attempt after `attempts` failures: linear in the table, capped at its last value. */
export function backoffFor(attempts: number, backoffMs: readonly number[]): number {
  if (backoffMs.length === 0) return 0;
  const index = Math.min(Math.max(attempts, 1), backoffMs.length) - 1;
  return backoffMs[index] ?? backoffMs[backoffMs.length - 1] ?? 0;
}

export function recordSuccess(state: QueueState, key: string): QueueState {
  return { drafts: state.drafts.filter((draft) => draft.key !== key).map(copyDraft) };
}

/**
 * Record a failed attempt: keep the draft, count the attempt, remember why, and set the next allowed time.
 * The error string is shown to the runner, so it is the server's detail, not a stack trace.
 */
export function recordFailure(
  state: QueueState,
  key: string,
  input: { nowMs: number; error: string; backoffMs: readonly number[] },
): QueueState {
  return {
    drafts: state.drafts.map((draft) => {
      if (draft.key !== key) return copyDraft(draft);
      const attempts = draft.attempts + 1;
      return {
        ...copyDraft(draft),
        attempts,
        lastError: input.error,
        nextAttemptAtMs: input.nowMs + backoffFor(attempts, input.backoffMs),
      };
    }),
  };
}

/** A replay request the browser can send without knowing anything about the queue's rules. */
export interface ReplayRequest {
  key: string;
  day: string;
  body: Record<string, string>;
}

export function replayRequest(draft: QueuedDraft): ReplayRequest {
  return {
    key: draft.key,
    day: draft.day,
    // The replay says where it came from, so the stored entry records the truth about its origin.
    body: { ...draft.form, source: "offline-queue" },
  };
}
