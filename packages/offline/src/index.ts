/**
 * packages/offline: the queue's rules, pure and browser-free. The browser supplies IndexedDB and a network; this
 * package decides what may be replayed, when, and what a failure means.
 */
export {
  abandoned,
  backoffFor,
  dueForReplay,
  enqueue,
  pendingCount,
  recordFailure,
  recordSuccess,
  replayRequest,
} from "./queue";
export type { ReplayRequest } from "./queue";
export type { EnqueueInput, QueueState, QueuedDraft, ReplayOptions } from "./types";
