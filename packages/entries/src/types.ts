/**
 * The entry pipeline's frozen interface: what a client may send, what the append-only log already holds, and
 * the three things that can happen to a submission.
 *
 * The pipeline is pure. Time, the user id and the instant are arguments, so a submission replayed six months
 * from now produces the same rows and the same ids - which is what makes "a double tap is one entry" a fact
 * rather than a hope.
 */
import type {
  DayEntry,
  DayEntryIntent,
  DayEntryOutcome,
  DayEntryPain,
  DayEntrySource,
  DayEntryWellness,
  OutcomeDetail,
  SessionTaken,
  TrainingEvent,
} from "@training-planner/domain";

/**
 * What the client sends. It carries no revision, no entry id and no superseded pointer: identity and history
 * are the writer's business, and a client that could name them could forge a correction.
 */
export interface EntryDraft {
  day: string;
  outcome: DayEntryOutcome;
  tzAtEvent: string;
  sessionTaken?: SessionTaken;
  outcomeDetail?: OutcomeDetail | null;
  completedKm?: number | null;
  durationMin?: number | null;
  rpe?: number | null;
  legs?: number | null;
  mood?: number | null;
  /** The legacy `musoreSoreness` spelling is accepted during the migration window and normalised on write. */
  wellness?: (DayEntryWellness & { musoreSoreness?: number | null }) | null;
  pain?: DayEntryPain[];
  note?: string | null;
  intent?: DayEntryIntent | null;
  source?: DayEntrySource;
  /** Required for runner writes: the events contract makes a runner event without one a client bug. */
  idempotencyKey: string;
  /** Required when the day is older than the backfill window, whether this is a correction or a first entry. */
  correctionReason?: string | null;
}

export interface EntryLog {
  /** Append-only. Nothing in this package mutates this array or the entries inside it. */
  entries: readonly DayEntry[];
  events: readonly TrainingEvent[];
}

export type RejectCode =
  | "missing-idempotency-key"
  | "future-day"
  | "invalid-entry"
  | "missing-correction-reason";

export interface AcceptedSubmission {
  status: "accepted";
  entry: DayEntry;
  event: TrainingEvent;
  /**
   * A correction leaves the superseded row in place and points it at the new revision. The pipeline returns
   * the pointer instead of writing it: the log is append-only here, and the API applies the pointer in the
   * same transaction that appends the new row.
   */
  superseded?: { entryId: string; supersededBy: string };
}

export interface DuplicateSubmission {
  status: "duplicate";
  /** The entry the first submission wrote; a retry must not create a second one. */
  entry: DayEntry;
}

export interface RejectedSubmission {
  status: "rejected";
  code: RejectCode;
  detail: string;
}

export type SubmitResult = AcceptedSubmission | DuplicateSubmission | RejectedSubmission;

export interface SubmitOptions {
  /** The user, from the session. Never from the request body. */
  userId: string;
  /** Today as a civil day, injected: the pipeline reads no clock. */
  today: string;
  /** The instant the write happened, supplied by the API. Recorded, never derived here. */
  occurredAt: string;
  knowledge: import("@training-planner/knowledge").KnowledgeBundle;
  /** The user's training-day boundary hour (users.dayStartHour). Stored with the event. */
  dayStartHour?: number;
}
