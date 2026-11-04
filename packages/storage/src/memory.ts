/**
 * The in-memory adapter: the reference implementation of the persistence contract, and the one the HTTP tests
 * run against. It is not a mock - it enforces the two rules the database will enforce (unique idempotency key,
 * append-only) so a test that passes here is testing the same discipline the Postgres adapter must keep.
 *
 * Per-user isolation is structural: every read and write is keyed by `userId` first, so a cross-user read is not
 * a check that can be forgotten, it is a lookup that cannot be expressed.
 */
import type { DayEntry, PlanVersion, Review, TrainingEvent } from "@training-planner/domain";
import {
  DuplicateIdempotencyError,
  type AppendEntryInput,
  type CommentRecord,
  type Repository,
} from "./types";

interface UserState {
  entries: DayEntry[];
  events: TrainingEvent[];
  plans: Map<string, PlanVersion>;
  reviews: Map<string, Review>;
  comments: CommentRecord[];
  idempotencyKeys: Set<string>;
}

const emptyUser = (): UserState => ({
  entries: [],
  events: [],
  plans: new Map(),
  reviews: new Map(),
  comments: [],
  idempotencyKeys: new Set(),
});

export function createMemoryRepository(): Repository {
  const users = new Map<string, UserState>();
  const stateOf = (userId: string): UserState => {
    const existing = users.get(userId);
    if (existing !== undefined) return existing;
    const created = emptyUser();
    users.set(userId, created);
    return created;
  };

  return {
    appendEntryWithEventAndPointer(input: AppendEntryInput): void {
      const userId = input.event.userId;
      const state = stateOf(userId);
      const key = input.event.idempotencyKey ?? input.entry.idempotencyKey;
      if (key === undefined || key === null || key.length === 0) {
        throw new Error("an entry write needs an idempotency key");
      }
      // The unique constraint the database will carry. A retry must never create a second row.
      if (state.idempotencyKeys.has(key)) throw new DuplicateIdempotencyError(userId, key);

      const pointer = input.superseded;
      if (pointer !== undefined) {
        const original = state.entries.find((entry) => entry.entryId === pointer.entryId);
        if (original === undefined) throw new Error(`cannot supersede unknown entry ${pointer.entryId}`);
        // The pointer is the only mutable field in the whole store, and it is set in this same call, which is
        // what makes "a correction never rewrites history" true rather than aspirational.
        state.entries = state.entries.map((entry) =>
          entry.entryId === pointer.entryId ? { ...entry, supersededBy: pointer.supersededBy } : entry,
        );
      }

      state.entries = [...state.entries, input.entry];
      state.events = [...state.events, input.event];
      state.idempotencyKeys.add(key);
    },

    findEntryByIdempotencyKey(userId: string, idempotencyKey: string): DayEntry | undefined {
      return stateOf(userId).entries.find((entry) => entry.idempotencyKey === idempotencyKey);
    },

    listEntriesForDay(userId: string, day: string): DayEntry[] {
      return stateOf(userId)
        .entries.filter((entry) => entry.day === day)
        .sort((a, b) => a.revision - b.revision);
    },

    listEvents(userId: string): TrainingEvent[] {
      return [...stateOf(userId).events];
    },

    savePlanVersion(version: PlanVersion): void {
      const state = stateOf(version.userId);
      state.plans.set(version.versionId, version);
    },

    getPlanVersion(userId: string, versionId: string): PlanVersion | undefined {
      return stateOf(userId).plans.get(versionId);
    },

    latestPlanVersionFor(userId: string, day: string): PlanVersion | undefined {
      const covering = [...stateOf(userId).plans.values()].filter(
        (version) => version.firstDay <= day && day <= version.lastDay,
      );
      return covering.sort((a, b) => (a.generatedAtDay < b.generatedAtDay ? 1 : -1))[0];
    },

    saveReview(review: Review): void {
      stateOf(review.userId).reviews.set(review.reviewId, review);
    },

    getReview(userId: string, reviewId: string): Review | undefined {
      return stateOf(userId).reviews.get(reviewId);
    },

    listReviews(userId: string): Review[] {
      return [...stateOf(userId).reviews.values()].sort((a, b) => (a.openedAtDay < b.openedAtDay ? 1 : -1));
    },

    saveComment(comment: CommentRecord): void {
      const state = stateOf(comment.userId);
      state.comments = [...state.comments, comment];
    },

    listComments(userId: string, day?: string): CommentRecord[] {
      const comments = stateOf(userId).comments;
      return day === undefined ? [...comments] : comments.filter((comment) => comment.day === day);
    },
  };
}
