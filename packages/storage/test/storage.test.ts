/**
 * The reference adapter's tests. The point is not that a Map works; it is that the two rules the database will
 * enforce - a unique idempotency key and an append-only log - are enforced here, so the HTTP tests that run
 * against this adapter are testing the same discipline Postgres must keep.
 */
import { describe, expect, it } from "vitest";
import type { DayEntry, PlanDiff, PlanVersion, Review, TrainingEvent } from "@training-planner/domain";
import { createMemoryRepository, createMemorySessions, DuplicateIdempotencyError } from "../src/index";
import type { Repository } from "../src/index";
import { makeEntry, makeEvent } from "./helpers";
import { makePlan, WEEK } from "../../policy/test/helpers";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const append = (repository: Repository, entry: DayEntry, event: TrainingEvent) =>
  repository.appendEntryWithEventAndPointer({ entry, event });

const entryOf = (day: string, overrides: Partial<DayEntry> = {}): DayEntry =>
  makeEntry({ day, idempotencyKey: `key-${day}`, ...overrides });

describe("an append writes the row, the event and the pointer together", () => {
  it("stores the entry and the event", () => {
    const repository = createMemoryRepository();
    const entry = entryOf("2026-11-05");
    append(repository, entry, makeEvent({ userId: USER_A, entry, idempotencyKey: "key-2026-11-05" }));
    expect(repository.listEntriesForDay(USER_A, "2026-11-05")).toHaveLength(1);
    expect(repository.listEvents(USER_A)).toHaveLength(1);
  });

  it("refuses a second write for the same idempotency key and stores nothing", () => {
    const repository = createMemoryRepository();
    const key = "key-retry";
    const entry = entryOf("2026-11-05", { idempotencyKey: key });
    append(repository, entry, makeEvent({ userId: USER_A, entry, idempotencyKey: key }));
    const retry = entryOf("2026-11-05", { idempotencyKey: key });
    expect(() => append(repository, retry, makeEvent({ userId: USER_A, entry: retry, idempotencyKey: key }))).toThrow(DuplicateIdempotencyError);
    expect(repository.listEntriesForDay(USER_A, "2026-11-05")).toHaveLength(1);
    expect(repository.listEvents(USER_A)).toHaveLength(1);
  });

  it("refuses a write with no idempotency key at all", () => {
    const repository = createMemoryRepository();
    // No key at all: the adapter refuses the write rather than inventing one.
    const entry = entryOf("2026-11-05", { idempotencyKey: undefined });
    expect(() => append(repository, entry, makeEvent({ userId: USER_A, entry, idempotencyKey: null }))).toThrow(/idempotency key/);
  });

  it("points the superseded row forward without touching the new row", () => {
    const repository = createMemoryRepository();
    const first = entryOf("2026-11-05", { revision: 1, entryId: "11111111-1111-4111-8111-111111111111" });
    append(repository, first, makeEvent({ userId: USER_A, entry: first, idempotencyKey: first.idempotencyKey ?? null }));

    const second = entryOf("2026-11-05", {
      revision: 2,
      correctedFromRevision: 1,
      entryId: "22222222-2222-4222-8222-222222222222",
      idempotencyKey: "key-correction",
      supersededBy: null,
    });
    repository.appendEntryWithEventAndPointer({
      entry: second,
      event: makeEvent({ userId: USER_A, entry: second, idempotencyKey: "key-correction" }),
      superseded: { entryId: first.entryId ?? "", supersededBy: second.entryId ?? "" },
    });

    const revisions = repository.listEntriesForDay(USER_A, "2026-11-05");
    expect(revisions.map((entry) => entry.revision)).toEqual([1, 2]);
    expect(revisions[0]?.supersededBy).toBe(second.entryId);
    expect(revisions[1]?.supersededBy).toBeNull();
    expect(revisions[1]?.correctedFromRevision).toBe(1);
  });

  it("refuses a pointer to a row that does not exist", () => {
    const repository = createMemoryRepository();
    const entry = entryOf("2026-11-05");
    expect(() =>
      repository.appendEntryWithEventAndPointer({
        entry,
        event: makeEvent({ userId: USER_A, entry, idempotencyKey: entry.idempotencyKey ?? null }),
        superseded: { entryId: "00000000-0000-4000-8000-000000000000", supersededBy: entry.entryId ?? "" },
      }),
    ).toThrow(/cannot supersede/);
  });
});

describe("the log is append-only and per-user", () => {
  it("has no update or delete method to call", () => {
    const repository = createMemoryRepository();
    const names = Object.keys(repository);
    for (const forbidden of ["updateEntry", "deleteEntry", "updateEvent", "deleteEvent", "deletePlanVersion"]) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("cannot read across users", () => {
    const repository = createMemoryRepository();
    const entry = entryOf("2026-11-05");
    append(repository, entry, makeEvent({ userId: USER_A, entry, idempotencyKey: entry.idempotencyKey ?? null }));
    expect(repository.listEntriesForDay(USER_B, "2026-11-05")).toEqual([]);
    expect(repository.listEvents(USER_B)).toEqual([]);
    expect(repository.findEntryByIdempotencyKey(USER_B, "key-2026-11-05")).toBeUndefined();
  });

  it("answers the idempotency lookup only for the owning user", () => {
    const repository = createMemoryRepository();
    const entry = entryOf("2026-11-05");
    append(repository, entry, makeEvent({ userId: USER_A, entry, idempotencyKey: entry.idempotencyKey ?? null }));
    expect(repository.findEntryByIdempotencyKey(USER_A, "key-2026-11-05")?.entryId).toBe(entry.entryId);
  });
});

describe("a user's whole log is readable in day order", () => {
  it("returns every entry, oldest first, and never another user's", () => {
    const repository = createMemoryRepository();
    for (const day of ["2026-11-07", "2026-11-03", "2026-11-05"]) {
      const entry = makeEntry({ day, idempotencyKey: `key-${day}` });
      repository.appendEntryWithEventAndPointer({
        entry,
        event: makeEvent({ userId: USER_A, entry, idempotencyKey: `key-${day}` }),
      });
    }
    expect(repository.listEntries(USER_A).map((entry) => entry.day)).toEqual(["2026-11-03", "2026-11-05", "2026-11-07"]);
    expect(repository.listEntries(USER_B)).toEqual([]);
  });
});

describe("plans are found by the day they cover", () => {
  const planFor = (userId: string, generatedAtDay: string): PlanVersion => ({
    ...makePlan(WEEK, generatedAtDay),
    userId,
    generatedAtDay,
  });

  it("returns the newest version whose window contains the day", () => {
    const repository = createMemoryRepository();
    const older = planFor(USER_A, "2026-11-01");
    const newer = planFor(USER_A, "2026-11-05");
    repository.savePlanVersion(older);
    repository.savePlanVersion(newer);
    expect(repository.latestPlanVersionFor(USER_A, "2026-11-05")?.versionId).toBe(newer.versionId);
    expect(repository.latestPlanVersionFor(USER_A, "2027-06-01")).toBeUndefined();
  });

  it("does not leak a plan across users", () => {
    const repository = createMemoryRepository();
    repository.savePlanVersion(planFor(USER_A, "2026-11-01"));
    expect(repository.latestPlanVersionFor(USER_B, "2026-11-05")).toBeUndefined();
  });
});

describe("reviews are readable in the order a page needs them", () => {
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
      { optionId: "keep", labelKey: "keep-as-is", keepAsIs: true, diffId: null, costSummary: "risk noted", expiresAfterDay: "2026-11-24" },
      { optionId: "reduce", labelKey: "reduce", keepAsIs: false, diffId: "33333333-3333-4333-8333-333333333333", costSummary: "less intensity", expiresAfterDay: "2026-11-24" },
    ],
    status: "open",
  });

  it("lists a user s reviews newest first and never another user s", () => {
    const repository = createMemoryRepository();
    repository.saveReview(reviewOf("11111111-1111-4111-8111-111111111111", "2026-11-01", USER_A));
    repository.saveReview(reviewOf("22222222-2222-4222-8222-222222222222", "2026-11-05", USER_A));
    repository.saveReview(reviewOf("33333333-3333-4333-8333-333333333333", "2026-11-05", USER_B));

    const mine = repository.listReviews(USER_A);
    expect(mine.map((review) => review.openedAtDay)).toEqual(["2026-11-05", "2026-11-01"]);
    expect(repository.listReviews(USER_B)).toHaveLength(1);
    expect(repository.listReviews("cccccccc-cccc-4ccc-8ccc-cccccccccccc")).toEqual([]);
  });
});

describe("a proposed version is staged, and only acceptance makes it active", () => {
  const base = (userId: string): PlanVersion => ({ ...makePlan(WEEK, "2026-11-01"), userId });
  const child = (parent: PlanVersion): PlanVersion => ({
    ...parent,
    versionId: "dddddddd-4444-4444-8444-444444444444",
    parentVersionId: parent.versionId,
    generatedBy: "review-accepted",
    generatedAtDay: "2026-11-05",
  });
  const diffOf = (parent: PlanVersion, toVersionId: string): PlanDiff => ({
    schemaVersion: 1,
    diffId: "eeeeeeee-5555-4555-8555-555555555555",
    userId: parent.userId,
    fromVersionId: parent.versionId,
    toVersionId,
    createdAtDay: "2026-11-05",
    changes: [],
    changeCountWithinLimit: true,
    knowledgeHash: parent.knowledgeHash,
  });

  it("keeps a staged version out of the active plan and out of day lookups", () => {
    const repository = createMemoryRepository();
    const parent = base(USER_A);
    repository.savePlanVersion(parent);
    const staged = child(parent);
    repository.saveProposedPlanVersion(staged);

    expect(repository.getActivePlanVersion(USER_A)?.versionId).toBe(parent.versionId);
    expect(repository.getProposedPlanVersion(USER_A, staged.versionId)?.versionId).toBe(staged.versionId);
    expect(repository.getPlanVersion(USER_A, staged.versionId)).toBeUndefined();
    expect(repository.latestPlanVersionFor(USER_A, "2026-11-05")?.versionId).toBe(parent.versionId);
  });

  it("activates the staged version that a diff predicts, and only that one", () => {
    const repository = createMemoryRepository();
    const parent = base(USER_A);
    repository.savePlanVersion(parent);
    const staged = child(parent);
    repository.saveProposedPlanVersion(staged);
    repository.savePlanDiff(diffOf(parent, staged.versionId));

    const activated = repository.activatePlanVersionForDiff(USER_A, diffOf(parent, staged.versionId).diffId);
    expect(activated.versionId).toBe(staged.versionId);
    expect(repository.getActivePlanVersion(USER_A)?.versionId).toBe(staged.versionId);
    expect(repository.latestPlanVersionFor(USER_A, "2026-11-05")?.versionId).toBe(staged.versionId);
    // The parent is history, not garbage: a past plan still has to be explainable.
    expect(repository.getPlanVersion(USER_A, parent.versionId)?.versionId).toBe(parent.versionId);
  });

  it("refuses to activate a version that was never proposed", () => {
    const repository = createMemoryRepository();
    repository.savePlanVersion(base(USER_A));
    expect(() => repository.activatePlanVersion(USER_A, "00000000-0000-4000-8000-000000000000")).toThrow(/never proposed/);
  });

  it("refuses to activate through a diff that is missing or points nowhere", () => {
    const repository = createMemoryRepository();
    const parent = base(USER_A);
    repository.savePlanVersion(parent);
    expect(() => repository.activatePlanVersionForDiff(USER_A, "00000000-0000-4000-8000-000000000000")).toThrow(/no diff/);

    repository.savePlanDiff(diffOf(parent, "99999999-9999-4999-8999-999999999999"));
    expect(() => repository.activatePlanVersionForDiff(USER_A, diffOf(parent, "99999999-9999-4999-8999-999999999999").diffId)).toThrow(/never proposed/);
  });

  it("never activates another user's staged version", () => {
    const repository = createMemoryRepository();
    const mine = base(USER_A);
    repository.savePlanVersion(mine);
    repository.saveProposedPlanVersion(child(mine));
    repository.savePlanDiff(diffOf(mine, child(mine).versionId));
    expect(() => repository.activatePlanVersionForDiff(USER_B, diffOf(mine, child(mine).versionId).diffId)).toThrow();
    expect(repository.getActivePlanVersion(USER_B)).toBeUndefined();
  });
});

describe("sessions resolve a bearer token to a user, and nothing else", () => {
  const sessions = createMemorySessions({ "token-a": USER_A });

  it("resolves a known token with or without the Bearer prefix", () => {
    expect(sessions.resolve("Bearer token-a")?.userId).toBe(USER_A);
    expect(sessions.resolve("token-a")?.userId).toBe(USER_A);
  });

  it("refuses an unknown token and a missing header", () => {
    expect(sessions.resolve("Bearer nope")).toBeNull();
    expect(sessions.resolve(undefined)).toBeNull();
  });
});
