/**
 * Contract tests for the Garmin activity → entry-draft mapping, driven by the sanitized capture.
 *
 * The fixture is the source of truth here: every expectation below is computed from the 20 captured
 * activities rather than from a hand-written list, so a changed capture fails loudly instead of drifting.
 *
 * Note on counts: the brief said "14 with distance > 0 and 6 zero-distance", but the capture as it exists in
 * the repository holds 15 distance-bearing activities and 5 zero-distance ones (zeros: 900001, 900011,
 * 900012, 900017, 900018). The assertions below encode the verified fixture contents.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { mapGarminActivity, type GarminActivity } from "../src/garmin";

const FIXTURE_PATH = fileURLToPath(new URL("../../../eval/fixtures/garmin/activities-2026-11.json", import.meta.url));
const TZ = "Asia/Taipei";

interface GarminFixture {
  note: string;
  capturedAt: string;
  profile: Record<string, unknown>;
  activities: GarminActivity[];
}

// A PowerShell-generated capture can carry a UTF-8 BOM; JSON.parse would reject it.
const fixtureText = readFileSync(FIXTURE_PATH, "utf8").replace(/^\uFEFF/, "");
const fixture = JSON.parse(fixtureText) as GarminFixture;
const activities = fixture.activities;

const distanceOf = (activity: GarminActivity): number => (typeof activity.distance === "number" ? activity.distance : 0);
const withDistance = activities.filter((activity) => distanceOf(activity) > 0);
const zeroDistance = activities.filter((activity) => distanceOf(activity) === 0);

describe("Garmin fixture shape", () => {
  it("holds 20 activities: 15 with distance > 0 and 5 zero-distance", () => {
    expect(activities).toHaveLength(20);
    expect(withDistance).toHaveLength(15);
    expect(zeroDistance).toHaveLength(5);
    expect(withDistance.length + zeroDistance.length).toBe(activities.length);
  });
});

describe("mapGarminActivity", () => {
  it("returns a draft for every distance-bearing activity and undefined for every zero-distance one", () => {
    for (const activity of withDistance) {
      const draft = mapGarminActivity(activity, TZ);
      expect(draft, `activity ${activity.activityId} (${distanceOf(activity)} m) should map`).toBeDefined();
      expect(draft?.idempotencyKey).toBe(`garmin:${activity.activityId}`);
    }

    for (const activity of zeroDistance) {
      expect(mapGarminActivity(activity, TZ), `activity ${activity.activityId} should be skipped`).toBeUndefined();
    }
  });

  it("maps the 5.43927978515625 km activity to a completed, as-prescribed draft", () => {
    const activity = activities.find((candidate) => candidate.distance === 5439.27978515625);
    expect(activity, "fixture must still contain the 5439.27978515625 m activity").toBeDefined();

    const draft = mapGarminActivity(activity as GarminActivity, TZ);

    expect(draft).toEqual({
      day: "2026-11-03",
      outcome: "completed",
      tzAtEvent: TZ,
      sessionTaken: "as-prescribed",
      completedKm: 5.4,
      durationMin: 29,
      source: "import-assistant",
      idempotencyKey: "garmin:900003",
    });
    expect(draft?.completedKm).toBe(5.4);
    expect(draft?.durationMin).toBe(Math.round((activity?.duration ?? 0) / 60));
    expect(draft?.day).toBe(activity?.startTimeLocal?.slice(0, 10));
    expect(draft?.outcome).toBe("completed");
    expect(draft?.sessionTaken).toBe("as-prescribed");
    expect(draft?.source).toBe("import-assistant");
    expect(draft?.idempotencyKey).toBe(`garmin:${activity?.activityId}`);
  });

  it("is deterministic: two calls produce deeply equal objects", () => {
    for (const activity of activities) {
      const first = mapGarminActivity(activity, TZ);
      const second = mapGarminActivity(activity, TZ);
      expect(first).toEqual(second);
      // Same key order too, so a replayed sync serialises identically.
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    }
  });

  it("rejects an unparseable startTimeLocal and a negative distance", () => {
    const base: GarminActivity = {
      activityId: 900999,
      activityName: null as unknown as string | undefined,
      activityType: { typeKey: "running" },
      distance: 1000,
      duration: 600,
      startTimeLocal: "2026-11-03 10:00:00",
    };

    expect(mapGarminActivity({ ...base, startTimeLocal: "not-a-day" }, TZ)).toBeUndefined();
    expect(mapGarminActivity({ ...base, distance: -1 }, TZ)).toBeUndefined();
  });
});

describe("Garmin fixture privacy", () => {
  it("carries no owner identity fields and no real activity ids", () => {
    for (const field of ["ownerId", "ownerFullName", "ownerDisplayName", "ownerProfileImageUrl"]) {
      expect(fixtureText).not.toContain(field);
    }

    const ids = [...fixtureText.matchAll(/"activityId"\s*:\s*(\d+)/g)].map((match) => Number(match[1]));
    expect(ids).toHaveLength(20);
    expect(ids.every((id) => id >= 900000)).toBe(true);
    expect(Math.min(...ids)).toBe(900001);
  });
});

describe("pace and heart-rate note", () => {
  it("writes a factual note from the activity's own averages", () => {
    const draft = mapGarminActivity(
      { activityId: 999, distance: 5000, duration: 1800, startTimeLocal: "2026-11-04 08:00:00", averageSpeed: 2.7777778, averageHR: 150 },
      "Asia/Taipei",
    );
    expect(draft?.note).toBe("Garmin: 6:00 min/km, avg HR 150 bpm");
  });

  it("writes no note when the averages are absent", () => {
    const draft = mapGarminActivity({ activityId: 998, distance: 5000, duration: 1800, startTimeLocal: "2026-11-04 08:00:00" }, "Asia/Taipei");
    expect(draft?.note).toBeUndefined();
  });
});

