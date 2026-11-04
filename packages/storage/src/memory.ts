/**
 * The in-memory adapter: the reference implementation of the persistence contract, and the one the HTTP tests
 * run against. It is not a mock - it enforces the two rules the database will enforce (unique idempotency key,
 * append-only) so a test that passes here is testing the same discipline the Postgres adapter must keep.
 *
 * Per-user isolation is structural: every read and write is keyed by `userId` first, so a cross-user read is not
 * a check that can be forgotten, it is a lookup that cannot be expressed.
 */
import { promptDeliverySchema } from "@training-planner/domain";
import type { DayEntry, GuidelineContract, PainReport, PlanDiff, PlanVersion, PromptDelivery, Review, TrainingEvent, WizardAnswerRecord } from "@training-planner/domain";
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
  /** Proposed but not accepted: a review s options, staged. */
  proposed: Map<string, PlanVersion>;
  activeVersionId: string | null;
  diffs: Map<string, PlanDiff>;
  promptDeliveries: PromptDelivery[];
  painReports: Map<string, PainReport>;
  wizardAnswers: WizardAnswerRecord[];
  reviews: Map<string, Review>;
  comments: CommentRecord[];
  idempotencyKeys: Set<string>;
}

const emptyUser = (): UserState => ({
  entries: [],
  events: [],
  plans: new Map(),
  proposed: new Map(),
  activeVersionId: null,
  diffs: new Map(),
  promptDeliveries: [],
  painReports: new Map(),
  wizardAnswers: [],
  reviews: new Map(),
  comments: [],
  idempotencyKeys: new Set(),
});

export function createMemoryRepository(): Repository {
  const users = new Map<string, UserState>();
  // Global, not tenant-scoped: ADR-0009's guidelines are the operator's layer for every runner.
  const guidelines: GuidelineContract[] = [];
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

    listEntries(userId: string): DayEntry[] {
      return [...stateOf(userId).entries].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.revision - b.revision));
    },

    listEvents(userId: string): TrainingEvent[] {
      return [...stateOf(userId).events];
    },

    savePlanVersion(version: PlanVersion): void {
      const state = stateOf(version.userId);
      state.plans.set(version.versionId, version);
      // A saved plan is the plan in force; a review s proposal goes through saveProposedPlanVersion instead.
      state.activeVersionId = version.versionId;
    },

    saveProposedPlanVersion(version: PlanVersion): void {
      stateOf(version.userId).proposed.set(version.versionId, version);
    },

    getProposedPlanVersion(userId: string, versionId: string): PlanVersion | undefined {
      return stateOf(userId).proposed.get(versionId);
    },

    getActivePlanVersion(userId: string): PlanVersion | undefined {
      const state = stateOf(userId);
      return state.activeVersionId === null ? undefined : state.plans.get(state.activeVersionId);
    },

    activatePlanVersion(userId: string, versionId: string): void {
      const state = stateOf(userId);
      const staged = state.proposed.get(versionId);
      if (staged === undefined) throw new Error(`cannot activate ${versionId}: it was never proposed`);
      state.plans.set(versionId, staged);
      state.proposed.delete(versionId);
      state.activeVersionId = versionId;
    },

    activatePlanVersionForDiff(userId: string, diffId: string): PlanVersion {
      const state = stateOf(userId);
      const diff = state.diffs.get(diffId);
      if (diff === undefined) throw new Error(`cannot activate: no diff ${diffId} for this user`);
      const staged = state.proposed.get(diff.toVersionId);
      if (staged === undefined) throw new Error(`cannot activate: diff ${diffId} predicts ${diff.toVersionId}, which was never proposed`);
      state.plans.set(staged.versionId, staged);
      state.proposed.delete(staged.versionId);
      state.activeVersionId = staged.versionId;
      return staged;
    },

    saveWizardAnswer(userId: string, record: WizardAnswerRecord): void {
      stateOf(userId).wizardAnswers.push(record);
    },

    listWizardAnswers(userId: string): WizardAnswerRecord[] {
      return [...stateOf(userId).wizardAnswers];
    },

    saveGuideline(guideline: GuidelineContract): void {
      // Guidelines are global, so they live outside the per-user state. A duplicate (id, version) is an error:
      // versions are append-only, and silently overwriting one would rewrite history.
      const exists = guidelines.some(
        (candidate) => candidate.guidelineId === guideline.guidelineId && candidate.version === guideline.version,
      );
      if (exists) throw new Error(`guideline ${guideline.guidelineId}@${guideline.version} already exists; write a new version`);
      guidelines.push(guideline);
    },

    listGuidelines(): GuidelineContract[] {
      return [...guidelines];
    },

    savePainReport(report: PainReport): void {
      // Keyed by the derived id: a replayed submission or a re-derivation writes the same row, never a second one.
      stateOf(report.userId).painReports.set(report.id, report);
    },

    listPainReports(userId: string): PainReport[] {
      return [...stateOf(userId).painReports.values()].sort((left, right) =>
        left.day < right.day ? -1 : left.day > right.day ? 1 : left.site < right.site ? -1 : 1,
      );
    },

    listPlanVersions(userId: string): PlanVersion[] {
      return [...stateOf(userId).plans.values()].sort((left, right) =>
        left.generatedAtDay < right.generatedAtDay ? -1 : left.generatedAtDay > right.generatedAtDay ? 1 : 0,
      );
    },

    getPlanVersion(userId: string, versionId: string): PlanVersion | undefined {
      return stateOf(userId).plans.get(versionId);
    },

    latestPlanVersionFor(userId: string, day: string): PlanVersion | undefined {
      const state = stateOf(userId);
      const active = state.activeVersionId === null ? undefined : state.plans.get(state.activeVersionId);
      // The active plan wins when it covers the day: a review that was accepted must change what the runner sees,
      // even if an older version happens to cover the same day.
      if (active !== undefined && active.firstDay <= day && day <= active.lastDay) return active;
      const covering = [...state.plans.values()].filter((version) => version.firstDay <= day && day <= version.lastDay);
      return covering.sort((a, b) => (a.generatedAtDay < b.generatedAtDay ? 1 : -1))[0];
    },

    savePlanDiff(diff: PlanDiff): void {
      stateOf(diff.userId).diffs.set(diff.diffId, diff);
    },

    getPlanDiff(userId: string, diffId: string): PlanDiff | undefined {
      return stateOf(userId).diffs.get(diffId);
    },

    savePromptDelivery(delivery: PromptDelivery): void {
      // A row the contract rejects is not storable: the same backstop the entry pipeline has. The Postgres
      // adapter gets the same enforcement from the DDL's CHECK constraints and the for_day <= day constraint.
      const parsed = promptDeliverySchema.safeParse(delivery);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "delivery"}: ${issue.message}`);
        throw new Error(`prompt delivery does not satisfy prompt-delivery.schema.json: ${issues.join("; ")}`);
      }
      stateOf(delivery.userId).promptDeliveries.push(delivery);
    },

    listPromptDeliveries(userId: string): PromptDelivery[] {
      return [...stateOf(userId).promptDeliveries];
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
