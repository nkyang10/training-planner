/**
 * The persistence contract (ADR-0008).
 *
 * The API talks to this interface and never to a database. The first adapter is in-memory, so the HTTP layer,
 * its transaction boundaries and its tests exist before a database does; the Postgres adapter lands behind the
 * same interface with row-level security (ADR-0002).
 *
 * Two properties are deliberately in the interface rather than in the adapter's good behaviour:
 * - **append-only**: there is no update and no delete. A correction is a new entry plus a pointer written in the
 *   same call, because three separate writes can fail between them and the failure mode is a log that
 *   disagrees with itself.
 * - **idempotency is a uniqueness rule**: `appendEntryWithEventAndPointer` refuses a second row for an
 *   idempotency key that already exists. A middleware cannot give that guarantee; a unique index can.
 */
import type { DayEntry, PlanDiff, PlanVersion, Review, TrainingEvent } from "@training-planner/domain";
import type { Locale } from "@training-planner/i18n";

export interface SupersededPointer {
  entryId: string;
  supersededBy: string;
}

export interface AppendEntryInput {
  entry: DayEntry;
  event: TrainingEvent;
  /** Set on a correction: the row this one replaces. Written in the same transaction as the new row. */
  superseded?: SupersededPointer;
}

export interface CommentRecord {
  commentId: string;
  userId: string;
  day: string;
  locale: Locale;
  /** The rendered sentences, stored so a comment can be re-read exactly as the runner saw it. */
  sentences: string[];
  text: string;
  knowledgeHash: string;
  createdAt: string;
}

/** Raised by the adapter when a unique constraint would be violated; the API maps it to a duplicate response. */
export class DuplicateIdempotencyError extends Error {
  constructor(
    readonly userId: string,
    readonly idempotencyKey: string,
  ) {
    super(`idempotency key ${idempotencyKey} already used by ${userId}`);
    this.name = "DuplicateIdempotencyError";
  }
}

export interface Repository {
  appendEntryWithEventAndPointer(input: AppendEntryInput): void;
  findEntryByIdempotencyKey(userId: string, idempotencyKey: string): DayEntry | undefined;
  listEntriesForDay(userId: string, day: string): DayEntry[];
  /** Every entry for a user, oldest day first: windowed signals read a season, not a day. */
  listEntries(userId: string): DayEntry[];
  listEvents(userId: string): TrainingEvent[];

  savePlanVersion(version: PlanVersion): void;
  getPlanVersion(userId: string, versionId: string): PlanVersion | undefined;
  /** The version whose firstDay..lastDay contains `day`, newest generation first. */
  latestPlanVersionFor(userId: string, day: string): PlanVersion | undefined;

  /** A proposed diff is evidence, stored when it is offered; a review points at it by id. */
  savePlanDiff(diff: PlanDiff): void;
  getPlanDiff(userId: string, diffId: string): PlanDiff | undefined;

  saveReview(review: Review): void;
  getReview(userId: string, reviewId: string): Review | undefined;
  /** Every review for a user, newest first: the calendar needs to know whether one is waiting. */
  listReviews(userId: string): Review[];

  saveComment(comment: CommentRecord): void;
  listComments(userId: string, day?: string): CommentRecord[];
}

/** Who is making the request. The API never trusts a userId from the body (ADR-0002). */
export interface Sessions {
  resolve(authorization: string | undefined): { userId: string } | null;
}

/** Test and development sessions: a bearer token maps to a user. Production swaps this, nothing else. */
export function createMemorySessions(tokens: Record<string, string>): Sessions {
  return {
    resolve(authorization) {
      if (authorization === undefined) return null;
      const token = authorization.replace(/^Bearer\s+/i, "").trim();
      const userId = tokens[token];
      return userId === undefined ? null : { userId };
    },
  };
}
