/**
 * packages/entries: the write path for daily feedback. Pure, so a replayed submission produces the same rows
 * and the same ids, and append-only, so a correction never rewrites a day somebody already learned from.
 */
export { submitEntry, entriesForDay, resolveCurrent, pendingDays } from "./submit";
export type {
  AcceptedSubmission,
  DuplicateSubmission,
  EntryDraft,
  EntryLog,
  RejectCode,
  RejectedSubmission,
  SubmitOptions,
  SubmitResult,
} from "./types";
