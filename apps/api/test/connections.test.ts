/**
 * Connections (2026-11-05): a runner links Garmin, chooses the sync source, and a sync imports completed runs.
 *
 * The Garmin client is a port: the tests inject a fake so no network is involved, and the real client is exercised
 * separately by the live check documented in docs/integrations/garmin-personal-api.md.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import type { GarminActivity, GarminClient } from "../src/garmin";
import { createApi } from "../src/server";

const USER = "31313131-3131-4131-8131-313131313131";
const TOKEN = "token-connections";
const NOW = "2026-11-05T22:40:00.000Z";

let repository: Repository;
let server: Server;
let base = "";

const activities: GarminActivity[] = [
  { activityId: 9001, activityType: { typeKey: "running" }, distance: 5000, duration: 1800, startTimeLocal: "2026-11-04 08:00:00" },
  { activityId: 9002, activityType: { typeKey: "indoor_cardio" }, distance: 0, duration: 1200, startTimeLocal: "2026-11-04 21:00:00" },
];

const garmin: GarminClient = {
  obtainToken: async (apiKey) => {
    if (apiKey !== "good-key") throw new Error("bad key");
    return "token-value";
  },
  profile: async () => ({ displayName: "Mark Yang" }),
  activities: async () => activities,
};

const call = async (path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  });
  const text = await response.text();
  return { status: response.status, body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>) };
};

beforeAll(async () => {
  process.env.GARMIN_PERSONAL_API_KEY = "good-key";
  repository = createMemoryRepository();
  server = createServer(createApi({ repository, sessions: createMemorySessions({ [TOKEN]: USER }), now: () => NOW, garminClient: garmin }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  delete process.env.GARMIN_PERSONAL_API_KEY;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("connections", () => {
  it("lists both providers as not connected and manual as the default source", async () => {
    const page = await call("/connections");
    expect(page.status).toBe(200);
    const connections = page.body["connections"] as Array<Record<string, unknown>>;
    expect(connections.map((connection) => connection["provider"])).toEqual(["strava", "garmin"]);
    expect(connections.every((connection) => connection["status"] === "not-connected")).toBe(true);
    expect((page.body["sync"] as Record<string, unknown>)["source"]).toBe("manual");
  });

  it("stores the runner's sync choice and refuses an invented source", async () => {
    const good = await call("/connections/sync-preference", { method: "POST", body: JSON.stringify({ source: "garmin" }) });
    expect(good.status).toBe(200);
    expect(repository.getSyncPreference(USER)?.source).toBe("garmin");

    const bad = await call("/connections/sync-preference", { method: "POST", body: JSON.stringify({ source: "everything" }) });
    expect(bad.status).toBe(400);
    expect(repository.getSyncPreference(USER)?.source).toBe("garmin");
  });

  it("links Garmin with a personal API key without returning the key or the token", async () => {
    const linked = await call("/connections/garmin/token", { method: "POST", body: JSON.stringify({ apiKey: "good-key" }) });
    expect(linked.status).toBe(200);
    const text = JSON.stringify(linked.body);
    expect(text).not.toContain("good-key");
    expect(text).not.toContain("token-value");
    const connection = repository.getConnection(USER, "garmin");
    expect(connection?.status).toBe("connected");
    expect(connection?.displayName).toBe("Mark Yang");
    expect(connection?.hasCredential).toBe(true);
  });

  it("refuses a bad Garmin key with the upstream failure, not a fake success", async () => {
    const linked = await call("/connections/garmin/token", { method: "POST", body: JSON.stringify({ apiKey: "bad-key" }) });
    expect(linked.status).toBe(502);
    expect((linked.body["error"] as Record<string, unknown>)["code"]).toBe("garmin-token-failed");
  });

  it("imports a completed run and skips a zero-distance activity", async () => {
    const synced = await call("/connections/garmin/sync", { method: "POST", body: JSON.stringify({ from: "2026-11-01", to: "2026-11-05" }) });
    expect(synced.status).toBe(200);
    expect(synced.body["imported"]).toBe(1);
    expect(synced.body["skipped"]).toBe(1);
    const entries = repository.listEntriesForDay(USER, "2026-11-04");
    expect(entries.some((entry) => entry.idempotencyKey === "garmin:9001")).toBe(true);
    expect(repository.getConnection(USER, "garmin")?.lastSyncStatus).toBe("ok");
  });

  it("says Strava is not configured instead of pretending to link", async () => {
    const started = await call("/connections/strava/start");
    expect(started.status).toBe(503);
    expect((started.body["error"] as Record<string, unknown>)["code"]).toBe("strava-not-configured");
    const synced = await call("/connections/strava/sync", { method: "POST", body: "{}" });
    expect(synced.status).toBe(503);
  });
});
