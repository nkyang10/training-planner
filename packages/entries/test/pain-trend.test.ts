/**
 * The trajectory's tests. The one that matters most: one report is a point, not a trend, and the function says so
 * instead of calling a single number "stable".
 */
import { describe, expect, it } from "vitest";
import type { PainReport } from "@training-planner/domain";
import { PAIN_TREND_WINDOW_DAYS, painTrendOf } from "../src/index";

const report = (day: string, intensity: number, overrides: Partial<PainReport> = {}): PainReport => ({
  userId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  id: `id-${day}-${intensity}`,
  day,
  site: "achilles",
  side: "left",
  intensity,
  duringRun: false,
  nextMorning: false,
  trendGaitChange: false,
  nightPain: false,
  duration: null,
  knownInjury: false,
  note: null,
  ...overrides,
});

const today = "2026-11-09";

describe("the pain trajectory is a direction over a window", () => {
  it("calls a rise a rise and a fall a fall", () => {
    expect(painTrendOf({ reports: [report("2026-11-07", 3), report("2026-11-09", 6)], today }).direction).toBe("rising");
    expect(painTrendOf({ reports: [report("2026-11-07", 6), report("2026-11-09", 3)], today }).direction).toBe("falling");
    expect(painTrendOf({ reports: [report("2026-11-07", 4), report("2026-11-09", 4)], today }).direction).toBe("stable");
  });

  it("refuses to call one report a trend", () => {
    const trend = painTrendOf({ reports: [report("2026-11-09", 6)], today });
    expect(trend).toMatchObject({ direction: "unknown", days: 1, peak: 6, latest: 6, note: "one-report" });
  });

  it("answers no-reports with nulls rather than zero", () => {
    const trend = painTrendOf({ reports: [], today });
    expect(trend).toMatchObject({ direction: "unknown", days: 0, peak: null, latest: null, note: "no-reports" });
  });

  it("ignores a report older than the window", () => {
    const trend = painTrendOf({ reports: [report("2026-10-01", 9), report("2026-11-09", 2)], today });
    // The old report is outside the seven days, so the window holds one report: a point, not a trend.
    expect(trend.days).toBe(1);
    expect(trend.peak).toBe(2);
    expect(trend.note).toBe("one-report");
    expect(PAIN_TREND_WINDOW_DAYS).toBe(7);
  });

  it("carries the two decisive flags when any report in the window has them", () => {
    const trend = painTrendOf({
      reports: [report("2026-11-08", 4, { nightPain: true }), report("2026-11-09", 5, { trendGaitChange: true })],
      today,
    });
    expect(trend.nightPain).toBe(true);
    expect(trend.gaitChange).toBe(true);
    expect(trend.direction).toBe("rising");
  });
});