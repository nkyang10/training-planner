/**
 * Connections and the sync preference, on both adapters.
 *
 * A connection is a per-user record of an external account, not a credential: it says where the secret lives
 * (`credentialRef`) and whether one exists (`hasCredential`), never the secret. These tests hold the in-memory and
 * SQLite adapters to the same observable contract: one record per user+provider, per-user isolation, both providers
 * listed once each, a sync preference that is replaced rather than appended, and no secret in the stored shape.
 *
 * Ordering is the one place the adapters differ: `Repository.listConnections` promises no order, SQLite reads
 * `ORDER BY provider ASC`, and the in-memory adapter returns insertion order. The shared test saves garmin first, so
 * it sees ["garmin", "strava"] on both; the SQLite-only test below saves in reverse to prove its sort is real.
 */
import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Connection, SyncPreference } from "@training-planner/domain";
import { createMemoryRepository, createSqliteRepository } from "../src/index";
import type { Repository } from "../src/index";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const connectionOf = (overrides: Partial<Connection> = {}): Connection => ({
  userId: USER_A,
  provider: "garmin",
  status: "not-connected",
  externalAthleteId: null,
  displayName: null,
  scope: null,
  connectedAt: null,
  lastSyncAt: null,
  lastSyncStatus: null,
  lastSyncDetail: null,
  credentialRef: null,
  hasCredential: false,
  ...overrides,
});

const preferenceOf = (overrides: Partial<SyncPreference> = {}): SyncPreference => ({
  userId: USER_A,
  source: "manual",
  updatedAt: "2026-11-05T00:00:00.000Z",
  ...overrides,
});

const adapters: ReadonlyArray<{ name: string; create: () => Repository }> = [
  { name: "memory", create: () => createMemoryRepository() },
  { name: "sqlite", create: () => createSqliteRepository({ filename: ":memory:" }) },
];

describe.each(adapters)("$name adapter: connections and sync preference", ({ create }) => {
  it("gives a fresh user no connection and no sync preference", () => {
    const repository = create();
    expect(repository.getConnection(USER_A, "garmin")).toBeUndefined();
    expect(repository.getConnection(USER_A, "strava")).toBeUndefined();
    expect(repository.listConnections(USER_A)).toEqual([]);
    expect(repository.getSyncPreference(USER_A)).toBeUndefined();
  });

  it("saves a connection, reads it back, and updates rather than duplicates on a second save", () => {
    const repository = create();
    const original = connectionOf({ displayName: "Garmin Runner" });
    repository.saveConnection(original);

    expect(repository.getConnection(USER_A, "garmin")).toEqual(original);

    const updated = connectionOf({ status: "connected", displayName: "Renamed Runner" });
    repository.saveConnection(updated);

    expect(repository.getConnection(USER_A, "garmin")).toEqual(updated);
    expect(repository.getConnection(USER_A, "garmin")?.status).toBe("connected");
    expect(repository.getConnection(USER_A, "garmin")?.displayName).toBe("Renamed Runner");
    // One row per user+provider: the second save replaces, it does not append.
    expect(repository.listConnections(USER_A)).toHaveLength(1);
  });

  it("isolates one user's connections from another's", () => {
    const repository = create();
    repository.saveConnection(connectionOf({ userId: USER_A, provider: "garmin", status: "connected" }));

    expect(repository.getConnection(USER_A, "garmin")?.status).toBe("connected");
    expect(repository.getConnection(USER_B, "garmin")).toBeUndefined();
    expect(repository.listConnections(USER_B)).toEqual([]);
  });

  it("lists both of one user's providers sorted by provider", () => {
    const repository = create();
    // Saved garmin-first so both adapters read ["garmin", "strava"]; SQLite's sort is proved separately below.
    repository.saveConnection(connectionOf({ provider: "garmin", status: "connected" }));
    repository.saveConnection(connectionOf({ provider: "strava", status: "connected" }));

    const connections = repository.listConnections(USER_A);
    expect(connections.map((connection) => connection.provider)).toEqual(["garmin", "strava"]);
    // One record per provider, not one per save.
    expect(connections).toHaveLength(2);
  });

  it("round-trips the sync preference and lets a second save replace the first", () => {
    const repository = create();
    const first = preferenceOf({ source: "garmin", updatedAt: "2026-11-05T00:00:00.000Z" });
    repository.saveSyncPreference(first);

    expect(repository.getSyncPreference(USER_A)).toEqual(first);
    expect(repository.getSyncPreference(USER_A)?.source).toBe("garmin");
    expect(repository.getSyncPreference(USER_A)?.updatedAt).toBe("2026-11-05T00:00:00.000Z");

    const second = preferenceOf({ source: "both", updatedAt: "2026-11-06T09:30:00.000Z" });
    repository.saveSyncPreference(second);

    expect(repository.getSyncPreference(USER_A)).toEqual(second);
    expect(repository.getSyncPreference(USER_A)?.source).toBe("both");
    expect(repository.getSyncPreference(USER_A)?.updatedAt).toBe("2026-11-06T09:30:00.000Z");
    expect(repository.getSyncPreference(USER_B)).toBeUndefined();
  });

  it("never stores a raw secret: only the credential reference and the boolean", () => {
    const repository = create();
    const connection = connectionOf({
      status: "connected",
      credentialRef: "env:KEY",
      hasCredential: true,
    });
    repository.saveConnection(connection);

    const stored = repository.getConnection(USER_A, "garmin");
    expect(stored).toEqual(connection);
    expect(stored?.credentialRef).toBe("env:KEY");
    expect(stored?.hasCredential).toBe(true);

    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("token");
    expect(Object.keys(stored ?? {})).not.toContain("apiKey");
    expect(Object.keys(stored ?? {})).not.toContain("token");
  });
});

describe("sqlite adapter: provider order does not depend on save order", () => {
  it("sorts two providers by provider even when saved in reverse", () => {
    const repository = createSqliteRepository({ filename: ":memory:" });
    repository.saveConnection(connectionOf({ provider: "strava", status: "connected" }));
    repository.saveConnection(connectionOf({ provider: "garmin", status: "connected" }));

    expect(repository.listConnections(USER_A).map((connection) => connection.provider)).toEqual(["garmin", "strava"]);
    repository.close();
  });
});

describe("sqlite adapter: connections persist across a reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "training-planner-connections-"));
  const filename = join(directory, "training-planner.sqlite");

  afterAll(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it("writes a connection in one instance and reads it in the next", () => {
    const connection = connectionOf({
      status: "connected",
      displayName: "Persisted Runner",
      credentialRef: "env:KEY",
      hasCredential: true,
    });
    const first = createSqliteRepository({ filename });
    first.saveConnection(connection);
    first.close();

    const second = createSqliteRepository({ filename });
    try {
      expect(second.getConnection(USER_A, "garmin")).toEqual(connection);
      expect(second.listConnections(USER_A)).toHaveLength(1);
      expect(second.listConnections(USER_B)).toEqual([]);
    } finally {
      second.close();
    }
  });
});

describe("both adapters agree on provider order", () => {
  it("memory sorts garmin before strava even when strava was saved first", () => {
    const repository = createMemoryRepository();
    repository.saveConnection(connectionOf({ provider: "strava" }));
    repository.saveConnection(connectionOf({ provider: "garmin" }));
    expect(repository.listConnections(USER_A).map((connection) => connection.provider)).toEqual(["garmin", "strava"]);
  });
});

