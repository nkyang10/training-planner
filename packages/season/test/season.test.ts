/**
 * The season summary's tests. The ones that matter: a week that has not happened is not a failure, a partial
 * week is smaller than seven days, and a day is counted from its latest revision only.
 */
import { describe, expect, it } from "vitest";
import type { PlanVersion } from "@training-planner/domain";
import { seasonSummary } from "../src/index";
import { makeEntry, makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const specs: SessionSpec[] = [
  // Week 1 is partial on purpose: the plan starts on a Wednesday, so the week has five plan days.
  { day: "2026-11-04", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-05", kind: "rest", km: 0 },
  { day: "2026-11-06", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-07", kind: "rest", km: 0 },
  { day: "2026-11-08", kind: "long", km: 14, rpe: 6 },
  // Week 2 is full and in the future for the first test's `today`.
  { day: "2026-11-09", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-10", kind: "rest", km: 0 },
  { day: "2026-11-11", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-12", kind: "rest", km: 0 },
  { day: "2026-11-13", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-14", kind: "rest", km: 0 },
  { day: "2026-11-15", kind: "long", km: 16, rpe: 6 },
];

const plan = (): PlanVersion => makePlan(specs, "2026-11-01");

describe("the season is weeks, and a week that has not happened is not a failure", () => {
  it("groups by calendar week, not by seven days from the first day", () => {
    const summary = seasonSummary({ plan: plan(), entries: [], today: "2026-11-04" });
    expect(summary.weeks.map((week) => week.weekStart)).toEqual(["2026-11-02", "2026-11-09"]);
    // 11-04 is a Wednesday: the first week has five plan days, not seven.
    expect(summary.weeks[0]?.plannedDays).toBe(5);
    expect(summary.weeks[1]?.plannedDays).toBe(7);
  });

  it("marks the current week current and the rest future", () => {
    const summary = seasonSummary({ plan: plan(), entries: [], today: "2026-11-06" });
    expect(summary.weeks.map((week) => week.status)).toEqual(["current", "future"]);
    expect(summary.weeksElapsed).toBe(1);
    expect(summary.weeksTotal).toBe(2);
  });

  it("calls a finished week past and moves on", () => {
    const summary = seasonSummary({ plan: plan(), entries: [], today: "2026-11-09" });
    expect(summary.weeks.map((week) => week.status)).toEqual(["past", "current"]);
    expect(summary.weeksElapsed).toBe(2);
  });
});

describe("planned and completed kilometres", () => {
  it("adds up what the plan asked for", () => {
    const summary = seasonSummary({ plan: plan(), entries: [], today: "2026-11-08" });
    expect(summary.weeks[0]?.plannedKm).toBe(30);
    expect(summary.weeks[0]?.plannedSessions).toBe(3);
    expect(summary.weeks[0]?.hardDays).toBe(1);
    expect(summary.totals.plannedKm).toBe(68);
  });

  it("uses the reported distance when there is one, and the prescription when the day was done as planned", () => {
    const entries = [
      // As planned: the prescribed 6 km counts even though the entry reports no distance.
      makeEntry({ day: "2026-11-04", outcome: "completed" }),
      // Reported distance wins over the prescription: the runner ran 8 where 10 was asked for.
      makeEntry({ day: "2026-11-06", outcome: "partial", completedKm: 8, sessionTaken: "partial" }),
      // A skipped day contributes nothing, and neither does a rest day with no entry.
      makeEntry({ day: "2026-11-08", outcome: "skipped", outcomeDetail: "weather" }),
    ];
    const summary = seasonSummary({ plan: plan(), entries, today: "2026-11-08" });
    expect(summary.weeks[0]?.completedKm).toBe(14);
    expect(summary.weeks[0]?.completedSessions).toBe(2);
    expect(summary.weeks[0]?.loggedDays).toBe(3);
  });

  it("counts a day once, from its latest revision", () => {
    const entries = [
      makeEntry({ day: "2026-11-04", outcome: "completed", revision: 1 }),
      makeEntry({ day: "2026-11-04", outcome: "partial", completedKm: 4, sessionTaken: "partial", revision: 2 }),
    ];
    const summary = seasonSummary({ plan: plan(), entries, today: "2026-11-04" });
    expect(summary.weeks[0]?.loggedDays).toBe(1);
    expect(summary.weeks[0]?.completedKm).toBe(4);
  });

  it("does not count a distance for a day that was missed", () => {
    const entries = [makeEntry({ day: "2026-11-04", outcome: "missed" })];
    const summary = seasonSummary({ plan: plan(), entries, today: "2026-11-04" });
    expect(summary.weeks[0]?.completedKm).toBe(0);
    expect(summary.weeks[0]?.completedSessions).toBe(0);
    expect(summary.weeks[0]?.loggedDays).toBe(1);
  });
});

describe("adherence only counts days that have happened", () => {
  it("does not call a half-finished season 50 percent behind", () => {
    // 11-04 asks for 6 km and it was done; the remaining 24 km of the week are still in the future.
    const summary = seasonSummary({
      plan: plan(),
      entries: [makeEntry({ day: "2026-11-04", outcome: "completed" })],
      today: "2026-11-04",
    });
    expect(summary.adherencePct).toBe(100);
  });

  it("moves on a Wednesday rather than only on Mondays", () => {
    // By Friday 11-06 the plan has asked for 16 km and 10 of it is reported.
    const summary = seasonSummary({
      plan: plan(),
      entries: [
        makeEntry({ day: "2026-11-04", outcome: "completed" }),
        makeEntry({ day: "2026-11-06", outcome: "partial", completedKm: 4, sessionTaken: "partial" }),
      ],
      today: "2026-11-06",
    });
    expect(summary.adherencePct).toBe(62.5);
  });

  it("answers null, not zero, before the first day has happened", () => {
    const summary = seasonSummary({ plan: plan(), entries: [], today: "2026-11-01" });
    expect(summary.adherencePct).toBeNull();
  });
});
