/**
 * packages/entries: the write path for daily feedback. Pure, so a replayed submission produces the same rows
 * and the same ids, and append-only, so a correction never rewrites a day somebody already learned from.
 */
export { submitEntry, entriesForDay, resolveCurrent, pendingDays } from "./submit";
export { closeEventFor, DAY_CLOSED } from "./close";
export { painReportsOf } from "./pain";
export { painTrendOf, PAIN_TREND_WINDOW_DAYS } from "./pain-trend";
export type { PainDirection, PainTrend, PainTrendInput } from "./pain-trend";
export type { PainReportInput } from "./pain";
export type { CloseEventInput } from "./close";
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
