/**
 * The reference adapter's tests. The point is not that a Map works; it is that the two rules the database will
 * enforce - a unique idempotency key and an append-only log - are enforced here, so the HTTP tests that run
 * against this adapter are testing the same discipline Postgres must keep.
 */
import { describe, expect, it } from "vitest";
import type { DayEntry, PlanVersion, TrainingEvent } from "@training-planner/domain";
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
