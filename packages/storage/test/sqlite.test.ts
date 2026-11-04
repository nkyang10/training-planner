/**
 * The SQLite adapter's tests. They run the same contract the in-memory adapter is tested against, on a
 * `:memory:` database, so the two adapters can be swapped without changing what a caller observes.
 *
 * The point is not that SQLite works. It is that the rules the Repository interface states - per-user reads,
 * a unique append key, an append-only log, a correction pointer, activation as a separate act from staging,
 * global guideline versions, profile history, the consent switch - survive the translation to SQL.
 */
import { describe, expect, it } from "vitest";
import type { AiReviewProposal, AthleteProfile, GuidelineContract, PainReport, PlanDiff, PlanVersion, Review } from "@training-planner/domain";
import { latestWizardAnswers, originalWizardAnswers } from "@training-planner/domain";
import { createSqliteRepository, DuplicateIdempotencyError } from "../src/index";
import type { CommentRecord, Repository } from "../src/index";
import { makeEntry, makeEvent } from "./helpers";
import { makePlan, WEEK } from "../../policy/test/helpers";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const sqliteRepository = (): Repository => createSqliteRepository({ filename: ":memory:" });

const reviewOf = (reviewId: string, openedAtDay: string, userId: string): Review => ({
  schemaVersion: 1,
  reviewId,
  userId,
  openedAtDay,
  openedBy: "system-signal",
  evidence: { signalIds: ["completion"], ruleIds: ["plan-too-big"], evidenceGradeMax: "B" },
  horizonDays: 14,
  freezeDays: 2,
  options: [
    {
      optionId: "keep",
      labelKey: "keep-as-is",
      keepAsIs: true,
      diffId: null,
      costSummary: "risk noted",
      expiresAfterDay: "2026-11-24",
    },
  ],
  status: "open",
});

const planFor = (userId: string, generatedAtDay: string, versionId: string): PlanVersion => ({
  ...makePlan(WEEK, generatedAtDay),
  userId,
  versionId,
});

const profileOf = (overrides: Partial<AthleteProfile> = {}): AthleteProfile => ({
  userId: USER_A,
  revision: 1,
  age: 33,
  availability: { days: ["Mon", "Wed"] },
  goal: { type: "finish", event: null },
  preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
  health: {},
  ...overrides,
});

const guidelineOf = (version: number): GuidelineContract => ({
  guidelineId: "safety-hard-stops",
  version,
  tier: "non-negotiable",
  scope: "safety",
  visibility: "internal",
  text: "Hard stops subtract, never add.",
  rationale: "AGENTS rule 3.",
  effectiveFrom: "2026-11-05",
  createdBy: "operator",
});

const proposalOf = (id: string, overrides: Partial<AiReviewProposal> = {}): AiReviewProposal => ({
  userId: USER_A,
  id,
  day: "2026-11-05",
  guidelineVersionHash: "sha256:" + "0".repeat(64),
  model: "fake-model",
  promptHash: "sha256:" + "1".repeat(64),
  output: { decision: "no-change" },
  validatorVerdict: "accepted",
  fallbackUsed: false,
  reviewId: null,
  createdAt: "2026-11-05T00:00:00.000Z",
  ...overrides,
});

const commentOf = (commentId: string, day: string): CommentRecord => ({
  commentId,
  userId: USER_A,
  day,
  locale: "en",
  sentences: ["Nice work."],
  text: "Nice work.",
  knowledgeHash: "sha256:" + "0".repeat(64),
  createdAt: `${day}T22:00:00.000Z`,
});

const painReportOf = (id: string, day: string, site: string): PainReport => ({
  userId: USER_A,
  id,
  day,
  site,
  side: "left",
  intensity: 6,
  duringRun: true,
  nextMorning: false,
  trendGaitChange: false,
  nightPain: false,
  duration: "few-days",
  knownInjury: false,
  note: null,
});

describe("per-user isolation", () => {
  it("never returns another runner's entries, events or reviews", () => {
    const repository = sqliteRepository();
    const entry = makeEntry({ day: "2026-11-05", idempotencyKey: "key-a" });
    repository.appendEntryWithEventAndPointer({
      entry,
      event: makeEvent({ userId: USER_A, entry, idempotencyKey: "key-a" }),
    });
    const reviewId = "44444444-4444-4444-8444-444444444444";
    repository.saveReview(reviewOf(reviewId, "2026-11-05", USER_A));

    expect(repository.listEntriesForDay(USER_A, "2026-11-05")).toHaveLength(1);
    expect(repository.listEntriesForDay(USER_B, "2026-11-05")).toEqual([]);
    expect(repository.listEntries(USER_B)).toEqual([]);
    expect(repository.listEvents(USER_B)).toEqual([]);
    expect(repository.findEntryByIdempotencyKey(USER_B, "key-a")).toBeUndefined();

    expect(repository.listReviews(USER_A)).toHaveLength(1);
    expect(repository.listReviews(USER_B)).toEqual([]);
    expect(repository.getReview(USER_B, reviewId)).toBeUndefined();
  });

  it("keeps a review decision visible without rewriting the opening row", () => {
    const repository = sqliteRepository();
    const reviewId = "55555555-5555-4555-8555-555555555555";
    repository.saveReview(reviewOf(reviewId, "2026-11-05", USER_A));
    repository.saveReview({
      ...reviewOf(reviewId, "2026-11-05", USER_A),
      status: "accepted",
      chosenOptionId: "keep",
      decidedAtDay: "2026-11-05",
    });

    expect(repository.getReview(USER_A, reviewId)?.status).toBe("accepted");
    expect(repository.getReview(USER_A, reviewId)?.chosenOptionId).toBe("keep");
    // One visible review per review id, not two: the decision row is history, the read is the latest row.
    expect(repository.listReviews(USER_A)).toHaveLength(1);
    expect(repository.listReviews(USER_A)[0]?.status).toBe("accepted");
  });

  it("lists reviews newest first and keeps one visible row per review id", () => {
    const repository = sqliteRepository();
    repository.saveReview(reviewOf("11111111-1111-4111-8111-111111111111", "2026-11-01", USER_A));
    repository.saveReview(reviewOf("22222222-2222-4222-8222-222222222222", "2026-11-05", USER_A));
    repository.saveReview({
      ...reviewOf("11111111-1111-4111-8111-111111111111", "2026-11-01", USER_A),
      status: "accepted",
    });

    const reviews = repository.listReviews(USER_A);
    expect(reviews.map((review) => review.reviewId)).toEqual([
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(reviews[1]?.status).toBe("accepted");
  });
});

describe("an append writes the entry, the event and the pointer together", () => {
  it("refuses a second write for the same idempotency key and stores nothing", () => {
    const repository = sqliteRepository();
    const key = "key-retry";
    const first = makeEntry({
      day: "2026-11-05",
      idempotencyKey: key,
      entryId: "11111111-1111-4111-8111-111111111111",
    });
    repository.appendEntryWithEventAndPointer({
      entry: first,
      event: makeEvent({ userId: USER_A, entry: first, idempotencyKey: key }),
    });

    const retry = makeEntry({ day: "2026-11-05", idempotencyKey: key });
    expect(() =>
      repository.appendEntryWithEventAndPointer({
        entry: retry,
        event: makeEvent({ userId: USER_A, entry: retry, idempotencyKey: key }),
      }),
    ).toThrow(DuplicateIdempotencyError);
    expect(repository.listEntriesForDay(USER_A, "2026-11-05")).toHaveLength(1);
    expect(repository.listEvents(USER_A)).toHaveLength(1);
  });

  it("refuses a write with no idempotency key at all", () => {
    const repository = sqliteRepository();
    const entry = makeEntry({ day: "2026-11-05", idempotencyKey: undefined });
    expect(() =>
      repository.appendEntryWithEventAndPointer({
        entry,
        event: makeEvent({ userId: USER_A, entry, idempotencyKey: null }),
      }),
    ).toThrow(/idempotency key/);
    expect(repository.listEntries(USER_A)).toEqual([]);
    expect(repository.listEvents(USER_A)).toEqual([]);
  });

  it("appends a correction and points the previous row forward without touching the new row", () => {
    const repository = sqliteRepository();
    const first = makeEntry({
      day: "2026-11-05",
      revision: 1,
      entryId: "11111111-1111-4111-8111-111111111111",
      idempotencyKey: "key-1",
    });
    repository.appendEntryWithEventAndPointer({
      entry: first,
      event: makeEvent({ userId: USER_A, entry: first, idempotencyKey: "key-1" }),
    });

    const second = makeEntry({
      day: "2026-11-05",
      revision: 2,
      correctedFromRevision: 1,
      entryId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "key-2",
      supersededBy: null,
    });
    repository.appendEntryWithEventAndPointer({
      entry: second,
      event: makeEvent({ userId: USER_A, entry: second, idempotencyKey: "key-2" }),
      superseded: { entryId: first.entryId ?? "", supersededBy: second.entryId ?? "" },
    });

    const revisions = repository.listEntriesForDay(USER_A, "2026-11-05");
    expect(revisions.map((entry) => entry.revision)).toEqual([1, 2]);
    expect(revisions[0]?.supersededBy).toBe(second.entryId);
    expect(revisions[1]?.supersededBy).toBeNull();
    expect(revisions[1]?.correctedFromRevision).toBe(1);
  });

  it("refuses a pointer to a row that does not exist and writes nothing", () => {
    const repository = sqliteRepository();
    const entry = makeEntry({ day: "2026-11-05", idempotencyKey: "key-a" });
    expect(() =>
      repository.appendEntryWithEventAndPointer({
        entry,
        event: makeEvent({ userId: USER_A, entry, idempotencyKey: "key-a" }),
        superseded: {
          entryId: "00000000-0000-4000-8000-000000000000",
          supersededBy: entry.entryId ?? "",
        },
      }),
    ).toThrow(/cannot supersede/);
    expect(repository.listEntries(USER_A)).toEqual([]);
    expect(repository.listEvents(USER_A)).toEqual([]);
  });
});

describe("the rest of a user's log reads in interface order", () => {
  it("lists entries across days oldest first and finds one by idempotency key", () => {
    const repository = sqliteRepository();
    for (const day of ["2026-11-07", "2026-11-03", "2026-11-05"]) {
      const entry = makeEntry({ day, idempotencyKey: `key-${day}` });
      repository.appendEntryWithEventAndPointer({
        entry,
        event: makeEvent({ userId: USER_A, entry, idempotencyKey: `key-${day}` }),
      });
    }

    expect(repository.listEntries(USER_A).map((entry) => entry.day)).toEqual(["2026-11-03", "2026-11-05", "2026-11-07"]);
    expect(repository.findEntryByIdempotencyKey(USER_A, "key-2026-11-05")?.day).toBe("2026-11-05");
    expect(repository.findEntryByIdempotencyKey(USER_B, "key-2026-11-05")).toBeUndefined();
    expect(repository.listEvents(USER_A)).toHaveLength(3);
  });

  it("stores a pain report once and orders the rows by day", () => {
    const repository = sqliteRepository();
    repository.savePainReport(painReportOf("11111111-2222-4333-8444-555555555555", "2026-11-05", "achilles"));
    // A replay is the same row, not a second one.
    repository.savePainReport(painReportOf("11111111-2222-4333-8444-555555555555", "2026-11-05", "achilles"));
    repository.savePainReport(painReportOf("aaaaaaaa-2222-4333-8444-555555555555", "2026-11-06", "shin"));

    expect(repository.listPainReports(USER_A).map((report) => report.day)).toEqual(["2026-11-05", "2026-11-06"]);
    expect(repository.listPainReports(USER_A)).toHaveLength(2);
    expect(repository.listPainReports(USER_B)).toEqual([]);
  });

  it("appends comments and filters them by day", () => {
    const repository = sqliteRepository();
    repository.saveComment(commentOf("c1", "2026-11-05"));
    repository.saveComment(commentOf("c2", "2026-11-06"));

    expect(repository.listComments(USER_A).map((comment) => comment.commentId)).toEqual(["c1", "c2"]);
    expect(repository.listComments(USER_A, "2026-11-05").map((comment) => comment.commentId)).toEqual(["c1"]);
    expect(repository.listComments(USER_B)).toEqual([]);
  });

  it("lists prompt deliveries per user in insertion order", () => {
    const repository = sqliteRepository();
    repository.savePromptDelivery({ userId: USER_A, kind: "nudge", day: "2026-11-05", forDay: "2026-11-05", atMinute: 19 * 60 });
    repository.savePromptDelivery({ userId: USER_A, kind: "review", day: "2026-11-06", forDay: "2026-11-06", atMinute: 9 * 60 });

    expect(repository.listPromptDeliveries(USER_A).map((delivery) => delivery.kind)).toEqual(["nudge", "review"]);
    expect(repository.listPromptDeliveries(USER_B)).toEqual([]);
  });
});

describe("plans: staging, activation and history", () => {
  it("stages a version, activates it through its diff, and keeps the parent as history", () => {
    const repository = sqliteRepository();
    const parent = planFor(USER_A, "2026-11-01", "11111111-1111-4111-8111-111111111111");
    const staged: PlanVersion = {
      ...planFor(USER_A, "2026-11-05", "22222222-2222-4222-8222-222222222222"),
      parentVersionId: parent.versionId,
      generatedBy: "review-accepted",
    };
    const diff: PlanDiff = {
      schemaVersion: 1,
      diffId: "33333333-3333-4333-8333-333333333333",
      userId: USER_A,
      fromVersionId: parent.versionId,
      toVersionId: staged.versionId,
      createdAtDay: "2026-11-05",
      changes: [],
      changeCountWithinLimit: true,
      knowledgeHash: parent.knowledgeHash,
    };

    repository.savePlanVersion(parent);
    repository.saveProposedPlanVersion(staged);
    repository.savePlanDiff(diff);

    expect(repository.getActivePlanVersion(USER_A)?.versionId).toBe(parent.versionId);
    expect(repository.getProposedPlanVersion(USER_A, staged.versionId)?.versionId).toBe(staged.versionId);
    expect(repository.getPlanVersion(USER_A, staged.versionId)).toBeUndefined();
    expect(repository.latestPlanVersionFor(USER_A, "2026-11-05")?.versionId).toBe(parent.versionId);
    expect(repository.latestPlanVersionFor(USER_B, "2026-11-05")).toBeUndefined();
    expect(repository.getPlanDiff(USER_A, diff.diffId)?.diffId).toBe(diff.diffId);
    expect(repository.getPlanDiff(USER_B, diff.diffId)).toBeUndefined();

    const activated = repository.activatePlanVersionForDiff(USER_A, diff.diffId);
    expect(activated.versionId).toBe(staged.versionId);
    expect(repository.getActivePlanVersion(USER_A)?.versionId).toBe(staged.versionId);
    expect(repository.getProposedPlanVersion(USER_A, staged.versionId)).toBeUndefined();
    expect(repository.latestPlanVersionFor(USER_A, "2026-11-05")?.versionId).toBe(staged.versionId);
    expect(repository.getPlanVersion(USER_A, parent.versionId)?.versionId).toBe(parent.versionId);
    expect(repository.listPlanVersions(USER_A).map((version) => version.versionId)).toEqual([
      parent.versionId,
      staged.versionId,
    ]);
  });

  it("activates a staged version directly and refuses one that was never proposed", () => {
    const repository = sqliteRepository();
    const parent = planFor(USER_A, "2026-11-01", "11111111-1111-4111-8111-111111111111");
    const staged: PlanVersion = {
      ...planFor(USER_A, "2026-11-05", "22222222-2222-4222-8222-222222222222"),
      parentVersionId: parent.versionId,
    };
    repository.savePlanVersion(parent);
    repository.saveProposedPlanVersion(staged);

    repository.activatePlanVersion(USER_A, staged.versionId);
    expect(repository.getActivePlanVersion(USER_A)?.versionId).toBe(staged.versionId);
    expect(repository.getProposedPlanVersion(USER_A, staged.versionId)).toBeUndefined();
    expect(() => repository.activatePlanVersion(USER_A, "99999999-9999-4999-8999-999999999999")).toThrow(/never proposed/);
    expect(() => repository.activatePlanVersion(USER_B, staged.versionId)).toThrow(/never proposed/);
  });

  it("refuses to activate through a diff that is missing or points nowhere", () => {
    const repository = sqliteRepository();
    const parent = planFor(USER_A, "2026-11-01", "11111111-1111-4111-8111-111111111111");
    repository.savePlanVersion(parent);
    expect(() => repository.activatePlanVersionForDiff(USER_A, "99999999-9999-4999-8999-999999999999")).toThrow(/no diff/);

    const missingVersionDiff: PlanDiff = {
      schemaVersion: 1,
      diffId: "88888888-8888-4888-8888-888888888888",
      userId: USER_A,
      fromVersionId: parent.versionId,
      toVersionId: "77777777-7777-4777-8777-777777777777",
      createdAtDay: "2026-11-05",
      changes: [],
      changeCountWithinLimit: true,
      knowledgeHash: parent.knowledgeHash,
    };
    repository.savePlanDiff(missingVersionDiff);
    expect(() => repository.activatePlanVersionForDiff(USER_A, missingVersionDiff.diffId)).toThrow(/never proposed/);
  });
});

describe("wizard answers keep the original and the latest apart", () => {
  it("lists answers oldest first and folds latest and original separately", () => {
    const repository = sqliteRepository();
    repository.saveWizardAnswer(USER_A, { stepId: "goal", answer: { value: "finish" }, revision: 1, source: "wizard" });
    repository.saveWizardAnswer(USER_A, { stepId: "goal", answer: { value: "time" }, revision: 2, source: "settings" });

    const answers = repository.listWizardAnswers(USER_A);
    expect(answers.map((answer) => answer.revision)).toEqual([1, 2]);
    expect(latestWizardAnswers(answers).goal).toEqual({ value: "time" });
    expect(originalWizardAnswers(answers).goal).toEqual({ value: "finish" });
    expect(repository.listWizardAnswers(USER_B)).toEqual([]);
  });
});

describe("guidelines are global and versioned", () => {
  it("keeps every version and refuses a duplicate id@version with memory's message", () => {
    const repository = sqliteRepository();
    repository.saveGuideline(guidelineOf(1));
    repository.saveGuideline(guidelineOf(2));
    expect(repository.listGuidelines().map((guideline) => guideline.version)).toEqual([1, 2]);

    let message = "";
    try {
      repository.saveGuideline(guidelineOf(1));
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe("guideline safety-hard-stops@1 already exists; write a new version");
    expect(repository.listGuidelines()).toHaveLength(2);
  });
});

describe("a profile write always carries its revision row", () => {
  it("upserts the profile and appends a per-user revision per save", () => {
    const repository = sqliteRepository();
    expect(repository.getAthleteProfile(USER_A)).toBeUndefined();

    const first = repository.saveAthleteProfile(profileOf(), {
      changedBy: "runner",
      source: "user",
      diff: [{ path: "goal.type", from: null, to: "finish" }],
      occurredAt: "2026-11-04T00:00:00.000Z",
    });
    const second = repository.saveAthleteProfile(profileOf({ goal: { type: "time", event: null } }), {
      changedBy: "runner",
      source: "user",
      diff: [{ path: "goal.type", from: "finish", to: "time" }],
      occurredAt: "2026-11-04T00:00:01.000Z",
    });

    expect(first.id).toBe("1");
    expect(second.id).toBe("2");
    expect(repository.getAthleteProfile(USER_A)?.goal.type).toBe("time");
    const revisions = repository.listProfileRevisions(USER_A);
    expect(revisions.map((revision) => revision.id)).toEqual(["1", "2"]);
    expect(revisions[1]?.occurredAt).toBe("2026-11-04T00:00:01.000Z");
    expect(revisions[1]?.diff).toEqual([{ path: "goal.type", from: "finish", to: "time" }]);
    expect(repository.getAthleteProfile(USER_B)).toBeUndefined();
    expect(repository.listProfileRevisions(USER_B)).toEqual([]);

    // Revision ids are per user: B's first save is "1" even though A already has two rows.
    repository.saveAthleteProfile(profileOf({ userId: USER_B }), {
      changedBy: "import",
      source: "import",
      diff: [],
      occurredAt: "2026-11-05T00:00:00.000Z",
    });
    expect(repository.listProfileRevisions(USER_B).map((revision) => revision.id)).toEqual(["1"]);
  });
});

describe("the AI-review audit trail is append-only and per user", () => {
  it("appends rows oldest first and never shows them to another user", () => {
    const repository = sqliteRepository();
    repository.saveAiReviewProposal(proposalOf("aaaa1111-1111-4111-8111-aaaa11111111"));
    repository.saveAiReviewProposal(
      proposalOf("bbbb2222-2222-4222-8222-bbbb22222222", { validatorVerdict: "rejected", fallbackUsed: true }),
    );

    const rows = repository.listAiReviewProposals(USER_A);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual([
      "aaaa1111-1111-4111-8111-aaaa11111111",
      "bbbb2222-2222-4222-8222-bbbb22222222",
    ]);
    expect(rows[1]?.validatorVerdict).toBe("rejected");
    expect(rows[0]?.output).toEqual({ decision: "no-change" });
    expect(repository.listAiReviewProposals(USER_B)).toEqual([]);
  });
});

describe("consent is a switch, not a log", () => {
  it("distinguishes never granted from revoked", () => {
    const repository = sqliteRepository();
    expect(repository.getLlmConsent(USER_A)).toBeUndefined();

    repository.saveLlmConsent({
      userId: USER_A,
      granted: true,
      purpose: "review-decision",
      policyVersion: "v1",
      grantedAt: "2026-11-04T00:00:00.000Z",
      revokedAt: null,
      updatedAt: "2026-11-04T00:00:00.000Z",
    });
    expect(repository.getLlmConsent(USER_A)?.granted).toBe(true);

    repository.saveLlmConsent({
      userId: USER_A,
      granted: false,
      purpose: "review-decision",
      policyVersion: "v1",
      grantedAt: "2026-11-04T00:00:00.000Z",
      revokedAt: "2026-11-05T00:00:00.000Z",
      updatedAt: "2026-11-05T00:00:00.000Z",
    });
    expect(repository.getLlmConsent(USER_A)?.granted).toBe(false);
    expect(repository.getLlmConsent(USER_A)?.revokedAt).toBe("2026-11-05T00:00:00.000Z");
    expect(repository.getLlmConsent(USER_B)).toBeUndefined();
  });
});

describe("prompt deliveries are validated before they are stored", () => {
  it("refuses a delivery the contract rejects", () => {
    const repository = sqliteRepository();
    expect(() =>
      repository.savePromptDelivery({
        userId: USER_A,
        kind: "nudge",
        day: "2026-11-05",
        forDay: "2026-11-05",
        atMinute: 1440,
      }),
    ).toThrow(/prompt-delivery\.schema\.json/);
    expect(repository.listPromptDeliveries(USER_A)).toEqual([]);
  });
});

describe("the adapter exposes no mutation method", () => {
  it("has no update or delete method to call", () => {
    const repository = sqliteRepository();
    const names = Object.keys(repository);
    for (const forbidden of ["updateEntry", "deleteEntry", "updateEvent", "deleteEvent", "deletePlanVersion", "updateReview"]) {
      expect(names).not.toContain(forbidden);
    }
  });
});


describe("a file-backed database persists across connections", () => {
  it("writes in one repository instance and reads the same rows in the next", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const directory = mkdtempSync(join(tmpdir(), "training-planner-sqlite-"));
    const filename = join(directory, "training-planner.sqlite");
    try {
      const first = createSqliteRepository({ filename });
      first.savePlanVersion(planFor(USER_A, "2026-11-02", "2026-11-08"));
      first.saveWizardAnswer(USER_A, { stepId: "goal", answer: { type: "finish" }, revision: 1, source: "wizard" });
      first.saveLlmConsent({
        userId: USER_A,
        granted: true,
        purpose: "review-decision",
        policyVersion: "v1",
        grantedAt: "2026-11-04T00:00:00.000Z",
        revokedAt: null,
        updatedAt: "2026-11-04T00:00:00.000Z",
      });

      const second = createSqliteRepository({ filename });
      expect(second.listPlanVersions(USER_A)).toHaveLength(1);
      expect(second.listWizardAnswers(USER_A)).toHaveLength(1);
      expect(second.getLlmConsent(USER_A)?.granted).toBe(true);
      expect(second.listPlanVersions(USER_B)).toEqual([]);
      second.close();
      first.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
