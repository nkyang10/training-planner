/**
 * The runner's data, in one document.
 *
 * "Export my data" is a promise (backlog row 11), and a promise needs one definition rather than one per client:
 * both the API and the web server call this function, so what a runner downloads cannot depend on which surface
 * they asked. It reads through the `Repository` interface and computes nothing: an export that transformed the
 * facts would be a second, unversioned interpretation of them.
 */
import type { DayEntry, PainReport, PlanVersion, PromptDelivery, Review, TrainingEvent } from "@training-planner/domain";
import type { CommentRecord } from "./types";
import type { Repository } from "./types";

export interface ExportCounts {
  planVersions: number;
  entries: number;
  events: number;
  reviews: number;
  comments: number;
  promptDeliveries: number;
  painReports: number;
}

export interface ExportDocument {
  /** The instant the export was assembled (the caller's clock). */
  exportedAt: string;
  userId: string;
  /** Counts first, so a client can check the file it received is the file that was sent. */
  counts: ExportCounts;
  planVersions: PlanVersion[];
  entries: DayEntry[];
  events: TrainingEvent[];
  reviews: Review[];
  comments: CommentRecord[];
  promptDeliveries: PromptDelivery[];
  painReports: PainReport[];
}

export function exportDocument(repository: Repository, userId: string, exportedAt: string): ExportDocument {
  const planVersions = repository.listPlanVersions(userId);
  const entries = repository.listEntries(userId);
  const events = repository.listEvents(userId);
  const reviews = repository.listReviews(userId);
  const comments = repository.listComments(userId);
  const promptDeliveries = repository.listPromptDeliveries(userId);
  const painReports = repository.listPainReports(userId);
  return {
    exportedAt,
    userId,
    counts: {
      planVersions: planVersions.length,
      entries: entries.length,
      events: events.length,
      reviews: reviews.length,
      comments: comments.length,
      promptDeliveries: promptDeliveries.length,
      painReports: painReports.length,
    },
    planVersions,
    entries,
    events,
    reviews,
    comments,
    promptDeliveries,
    painReports,
  };
}
