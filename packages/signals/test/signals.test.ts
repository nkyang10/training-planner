/**
 * The signals layer's tests. Two things are being tested: the arithmetic, and the honesty.
 *
 * The honesty tests matter more. A signal that cannot see anything must say so (`insufficient` plus a note), and a
 * corpus signal this build cannot compute must appear in `unavailable` rather than be quietly absent. "No HRV" and
 * "HRV is fine" are different claims, and a plan must never confuse them.
 */
import { describe, expect, it } from "vitest";
import { signalSchema } from "@training-planner/domain";
import type { DayEntry, PlanVersion } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { addDays } from "@training-planner/planner-core";
import { computeSignals, signalByKey } from "../src/index";
import type { SignalInput } from "../src/index";
import { makeEntry, makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "12121212-1212-4212-8212-121212121212";
const COMPUTED_AT = "2026-11-08T22:40:00.000Z";

/** A week with effort targets on every day, so rpe_gap has something to compare against. */
const weekSpecs: SessionSpec[] = [
  { day: "2026-11-02", kind: "rest", km: 0 },
  { day: "2026-11-03", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-04", kind: "rest", km: 0 },
  { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-06", kind: "rest", km: 0 },
  { day: "2026-11-07", kind: "easy", km: 5, rpe: 4 },
  { day: "2026-11-08", kind: "long", km: 14, hard: true, rpe: 6 },
];

const weekPlan = (): PlanVersion => makePlan(weekSpecs);

const input = (overrides: Partial<SignalInput> = {}): SignalInput => ({
  userId: USER,
  today: "2026-11-08",
  entries: [],
  plan: weekPlan(),
  knowledge,
  computedAt: COMPUTED_AT,
  ...overrides,
});

const entry = (day: string, overrides: Partial<DayEntry> = {}): DayEntry => makeEntry({ day, ...overrides });

describe("rollups describe the week the runner actually had", () => {
  it("covers the plan up to today, never the future", () => {
    const output = computeSignals(input({ today: "2026-11-05" }));
    expect(output.rollups.map((rollup) => rollup.day)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
    ]);
  });

  it("knows which days were rest, which were planned and which were logged", () => {
    const output = computeSignals(input({ entries: [entry("2026-11-03", { outcome: "completed" })] }));
    const tuesday = output.rollups.find((rollup) => rollup.day === "2026-11-03");
    const monday = output.rollups.find((rollup) => rollup.day === "2026-11-02");
    const thursday = output.rollups.find((rollup) => rollup.day === "2026-11-05");
    expect(tuesday?.plannedSessions).toBe(1);
    expect(tuesday?.logged).toBe(true);
    expect(tuesday?.outcome).toBe("completed");
    expect(monday?.restDay).toBe(true);
    expect(monday?.unlogged).toBe(true);
    expect(thursday?.unlogged).toBe(true);
    expect(thursday?.plannedHardDays).toBe(1);
  });

  it("computes adherence from kilometres, and leaves it null on a rest day", () => {
    const output = computeSignals(
      input({ entries: [entry("2026-11-05", { outcome: "partial", completedKm: 6 })] }),
    );
    const thursday = output.rollups.find((rollup) => rollup.day === "2026-11-05");
    const monday = output.rollups.find((rollup) => rollup.day === "2026-11-02");
    expect(thursday?.adherence).toBe(0.6);
    expect(monday?.adherence).toBeNull();
  });

  it("uses the newest revision of a corrected day", () => {
    const output = computeSignals(
      input({
        entries: [
          entry("2026-11-05", { revision: 1, outcome: "missed" }),
          entry("2026-11-05", { revision: 2, outcome: "completed", correctedFromRevision: 1 }),
        ],
      }),
    );
    const thursday = output.rollups.find((rollup) => rollup.day === "2026-11-05");
    expect(thursday?.outcome).toBe("completed");
    expect(thursday?.completedKm).toBe(10);
  });
});

describe("completion_rate is a fraction of planned days that happened", () => {
  it("counts completed and partial days, and says it crossed the threshold", () => {
    const output = computeSignals(
      input({
        entries: [
          entry("2026-11-03", { outcome: "completed" }),
          entry("2026-11-05", { outcome: "completed" }),
          entry("2026-11-07", { outcome: "partial" }),
          entry("2026-11-08", { outcome: "missed" }),
        ],
      }),
    );
    const signal = signalByKey(output, "completion_rate");
    expect(signal?.value).toBe(0.75);
    expect(signal?.crossedThreshold).toBe(false);
    // The plan is a week long and the window is fourteen days, so the window is not fully covered.
    expect(signal?.confidence).toBe("medium");
  });

  it("crosses when the week mostly did not happen", () => {
    const output = computeSignals(
      input({ entries: [entry("2026-11-03", { outcome: "completed" }), entry("2026-11-05", { outcome: "missed" })] }),
    );
    const signal = signalByKey(output, "completion_rate");
    expect(signal?.value).toBe(0.25);
    expect(signal?.crossedThreshold).toBe(true);
  });

  it("refuses to claim a rate from one day of evidence", () => {
    const output = computeSignals(input({ today: "2026-11-03", entries: [entry("2026-11-03", { outcome: "completed" })] }));
    const signal = signalByKey(output, "completion_rate");
    expect(signal?.value).toBeNull();
    expect(signal?.confidence).toBe("insufficient");
    expect(signal?.confidenceNote).toContain("at least 2");
  });
});

describe("rpe_gap reports the median and the streak, and leaves the judgement to the trigger", () => {
  it("is the median of reported minus prescribed effort", () => {
    const output = computeSignals(
      input({
        entries: [
          entry("2026-11-03", { rpe: 6 }), // prescribed 4 -> +2
          entry("2026-11-05", { rpe: 8 }), // prescribed 7 -> +1
          entry("2026-11-07", { rpe: 7 }), // prescribed 4 -> +3
        ],
      }),
    );
    const signal = signalByKey(output, "rpe_gap");
    expect(signal?.value).toBe(2);
    expect(signal?.crossedThreshold).toBe(true);
    expect(signal?.consecutiveDays).toBe(1);
  });

  it("counts consecutive readings, so a rest day between sessions does not break the streak", () => {
    const output = computeSignals(
      input({
        today: "2026-11-07",
        entries: [
          entry("2026-11-05", { rpe: 10 }), // +3
          entry("2026-11-07", { rpe: 8 }), // +4, and 11-06 is a rest day with no entry
        ],
      }),
    );
    const signal = signalByKey(output, "rpe_gap");
    expect(signal?.consecutiveDays).toBe(2);
    expect(signal?.confidence).toBe("low");
  });

  it("is insufficient with one sample, and says why", () => {
    const output = computeSignals(input({ entries: [entry("2026-11-05", { rpe: 9 })] }));
    const signal = signalByKey(output, "rpe_gap");
    expect(signal?.value).toBeNull();
    expect(signal?.confidence).toBe("insufficient");
    expect(signal?.confidenceNote).toContain("reported and a prescribed effort");
  });
});

describe("continuity, load and ramp", () => {
  it("measures how much of the planned week was logged", () => {
    const output = computeSignals(
      input({
        entries: [
          entry("2026-11-03", { outcome: "completed" }),
          entry("2026-11-05", { outcome: "completed" }),
          entry("2026-11-07", { outcome: "completed" }),
        ],
      }),
    );
    const signal = signalByKey(output, "log_continuity");
    expect(signal?.value).toBe(0.75);
    expect(signal?.dataQuality?.presentDays).toBe(3);
    expect(signal?.dataQuality?.expectedDays).toBe(4);
  });

  it("reports the ISO week's planned kilometres", () => {
    const output = computeSignals(input());
    expect(signalByKey(output, "weekly_load")?.value).toBe(35);
  });

  it("refuses monotony when every day carries the same load", () => {
    const flat: SessionSpec[] = Array.from({ length: 7 }, (_, index) => ({
      day: addDays("2026-11-02", index),
      kind: "easy",
      km: 5,
      rpe: 4,
    }));
    const output = computeSignals(input({ plan: makePlan(flat) }));
    const signal = signalByKey(output, "load_monotony");
    expect(signal?.value).toBeNull();
    expect(signal?.confidence).toBe("insufficient");
  });

  it("computes monotony from a varied week", () => {
    const output = computeSignals(input());
    const signal = signalByKey(output, "load_monotony");
    expect(signal?.value).toBeGreaterThan(0);
    expect(signal?.crossedThreshold).toBe(false);
  });

  it("has no ramp without a previous week to compare", () => {
    const output = computeSignals(input());
    const signal = signalByKey(output, "ramp_rate");
    expect(signal?.value).toBeNull();
    expect(signal?.confidence).toBe("insufficient");
    expect(signal?.confidenceNote).toContain("denominator");
  });

  it("computes a ramp when the previous week is in the plan", () => {
    const twoWeeks: SessionSpec[] = [
      ...weekSpecs.map((spec) => ({ ...spec, day: addDays(spec.day, -7) })),
      ...weekSpecs,
    ];
    const output = computeSignals(input({ plan: makePlan(twoWeeks) }));
    const signal = signalByKey(output, "ramp_rate");
    // Same volume in both weeks, so the ramp is exactly zero rather than a divide-by-zero.
    expect(signal?.value).toBe(0);
    expect(signal?.confidence).toBe("medium");
  });
});

describe("pain is reported, never inferred", () => {
  it("says insufficient when nothing was reported, and says what that does not mean", () => {
    const output = computeSignals(input());
    const signal = signalByKey(output, "pain_trend");
    expect(signal?.value).toBeNull();
    expect(signal?.confidence).toBe("insufficient");
    expect(signal?.confidenceNote).toContain("not the same as no pain");
  });

  it("takes the maximum and the direction when reports exist", () => {
    const output = computeSignals(
      input({
        entries: [
          entry("2026-11-05", { pain: [{ site: "knee", intensity: 3 }] }),
          entry("2026-11-07", { pain: [{ site: "knee", intensity: 8 }] }),
        ],
      }),
    );
    const signal = signalByKey(output, "pain_trend");
    expect(signal?.value).toBe(8);
    expect(signal?.direction).toBe("rising");
    expect(signal?.crossedThreshold).toBe(true);
  });
});

describe("what this build cannot see is named, not guessed", () => {
  it("reports device coverage as insufficient with its data quality", () => {
    const signal = signalByKey(computeSignals(input()), "device_coverage");
    expect(signal?.confidence).toBe("insufficient");
    expect(signal?.value).toBe(0);
    expect(signal?.dataQuality?.source).toBe("assumed");
    expect(signal?.confidenceNote).toContain("M4");
  });

  it("lists the corpus signals that need a device or a test", () => {
    const output = computeSignals(input());
    const keys = output.unavailable.map((item) => item.key);
    for (const key of ["hrv_lnrmssd_dev", "rhr_dev", "sleep_debt", "acwr", "pace_bands"]) {
      expect(keys).toContain(key);
    }
    for (const item of output.unavailable) expect(item.reason.length).toBeGreaterThan(10);
  });

  it("counts imported days when there are any", () => {
    const output = computeSignals(input({ importedDays: ["2026-11-07", "2026-11-08"] }));
    const signal = signalByKey(output, "device_coverage");
    expect(signal?.dataQuality?.presentDays).toBe(2);
  });
});

describe("every signal is a contract-valid, reproducible fact", () => {
  it("validates against signal.schema.json", () => {
    const output = computeSignals(
      input({
        entries: [
          entry("2026-11-03", { outcome: "completed", rpe: 6 }),
          entry("2026-11-05", { outcome: "partial", rpe: 8, completedKm: 6 }),
          entry("2026-11-07", { outcome: "skipped", outcomeDetail: "travel", pain: [{ site: "shin", intensity: 4 }] }),
        ],
      }),
    );
    expect(output.signals.length).toBeGreaterThanOrEqual(7);
    for (const signal of output.signals) {
      const parsed = signalSchema.safeParse(signal);
      if (!parsed.success) throw new Error(`${signal.key}: ${JSON.stringify(parsed.error.issues)}`);
      expect(parsed.success).toBe(true);
    }
  });

  it("is byte-identical for the same input", () => {
    const first = computeSignals(input({ entries: [entry("2026-11-05", { rpe: 8 })] }));
    const second = computeSignals(input({ entries: [entry("2026-11-05", { rpe: 8 })] }));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("carries the knowledge hash and a sha256 inputs hash on every signal", () => {
    for (const signal of computeSignals(input()).signals) {
      expect(signal.knowledgeHash).toBe(knowledge.hash);
      expect(signal.inputsHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(signal.asOfDay).toBe("2026-11-08");
      expect(signal.computedAt).toBe(COMPUTED_AT);
    }
  });

  it("never emits NaN or Infinity", () => {
    const output = computeSignals(input({ entries: [entry("2026-11-05", { rpe: 10 })] }));
    const text = JSON.stringify(output);
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
    // The round trip must be lossless: a signal the browser cannot re-read is a signal that did not exist.
    expect(JSON.parse(text)).toEqual(output);
  });

  it("sorts signals by key, so a diff between two runs is readable", () => {
    const keys = computeSignals(input()).signals.map((signal) => signal.key);
    expect(keys).toEqual([...keys].sort());
  });
});
