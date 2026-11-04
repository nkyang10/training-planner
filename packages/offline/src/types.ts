/**
 * The offline queue's frozen interface.
 *
 * The queue is the answer to one sentence in the product: "a runner in a basement gym or on a trail with no
 * signal must still be able to log". That makes it a durability problem, not a UI problem - so its rules are
 * pure functions over a plain state object, tested without a browser, and the browser only supplies storage and
 * a network.
 *
 * Time is a number of milliseconds since the epoch, passed in by the caller. The queue never reads a clock, so a
 * test can make an hour pass in a function call.
 */

export interface QueuedDraft {
  /** The idempotency key: the queue's identity for the draft, and the key the replay sends. */
  key: string;
  day: string;
  /** The form fields exactly as the browser will post them. */
  form: Record<string, string>;
  queuedAtMs: number;
  attempts: number;
  lastError?: string | null;
  /** When the next replay attempt is allowed. Null means "as soon as the network is there". */
  nextAttemptAtMs?: number | null;
}

export interface QueueState {
  drafts: readonly QueuedDraft[];
}

export interface EnqueueInput {
  key: string;
  day: string;
  form: Record<string, string>;
  nowMs: number;
}

export interface ReplayOptions {
  nowMs: number;
  online: boolean;
  maxAttempts: number;
  /** Delay before attempt n, in milliseconds; the last value is the cap. */
  backoffMs: readonly number[];
}
