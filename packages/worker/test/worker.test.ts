/**
 * The sweep's tests. The two that matter: running it twice must not close anything twice, and a day that closed
 * with no entry must be named rather than turned into a zero.
 */
import { describe, expect, it } from "vitest";
import { eventSchema, signalSchema } from "@training-planner/domain";
import type { DayEntry, PlanVersion } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { runNightlySweep } from "../src/index";
import type { NightlyInput } from "../src/index";
import { makeEntry, makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "67676767-6767-4767-8767-676767676767";
const COMPUTED_AT = "2026-11-09T03:00:00.000Z";

const specs: SessionSpec[] = [
  { day: "2026-11-02", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-03", kind: "rest", km: 0 },
  { day: "2026-11-04", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-05", kind: "rest", km: 0 },
  { day: "2026-11-06", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-07", kind: "rest", km: 0 },
  { day: "2026-11-08", kind: "long", km: 14, rpe: 6 },
  // The second week exists so the sweep day (11-09) is inside the plan, which is what makes the signal cache
  // meaningful: a sweep for a day the plan does not cover still closes days, but has no bundle to snapshot.
  { day: "2026-11-09", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-10", kind: "rest", km: 0 },
  { day: "2026-11-11", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-12", kind: "rest", km: 0 },
  { day: "2026-11-13", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-14", kind: "rest", km: 0 },
  { day: "2026-11-15", kind: "long", km: 16, rpe: 6 },
];

const plan = (): PlanVersion => makePlan(specs, "2026-11-01");
const entry = (day: string, overrides: Partial<DayEntry> = {}): DayEntry => makeEntry({ day, ...overrides });

const input = (overrides: Partial<NightlyInput> = {}): NightlyInput => ({
  userId: USER,
  today: "2026-11-09",
  entries: [],
  plan: plan(),
  knowledge,
  computedAt: COMPUTED_AT,
  timezone: "Asia/Taipei",
  ...overrides,
});

describe("the sweep closes the days that ended, and only those", () => {
  it("closes every planned day before today", () => {
    const result = runNightlySweep(input());
    expect(result.newlyClosed.map((closed) => closed.day)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
      "2026-11-08",
    ]);
    expect(result.newlyClosed[0]?.plannedKm).toBe(6);
    expect(result.newlyClosed[0]?.plannedSessions).toBe(1);
  });

  it("never closes today or a future day", () => {
    const result = runNightlySweep(input({ today: "2026-11-05" }));
    expect(result.newlyClosed.map((closed) => closed.day)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  });

  it("closes nothing when the plan has not started yet", () => {
    const result = runNightlySweep(input({ today: "2026-11-01" }));
    expect(result.newlyClosed).toEqual([]);
    expect(result.pending).toEqual([]);
  });
});

describe("running it twice closes nothing twice", () => {
  it("skips the days already closed, and still reports the whole pending list", () => {
    const first = runNightlySweep(input());
    const second = runNightlySweep(input({ closedDays: first.newlyClosed.map((closed) => closed.day) }));
    expect(second.newlyClosed).toEqual([]);
    expect(second.skipped).toHaveLength(first.newlyClosed.length);
    // Pending is a property of the log, not of this run: the gap does not disappear because the sweep ran twice.
    expect(second.pending).toEqual(first.pending);
  });

  it("closes only the new days when given a partial history", () => {
    const result = runNightlySweep(input({ closedDays: ["2026-11-02", "2026-11-03"] }));
    expect(result.newlyClosed.map((closed) => closed.day)).not.toContain("2026-11-02");
    expect(result.newlyClosed.map((closed) => closed.day)).toContain("2026-11-04");
    expect(result.skipped).toEqual(["2026-11-02", "2026-11-03"]);
  });
});

describe("a day that closed with no entry is named, never zeroed", () => {
  it("marks it closed-unlogged and puts it in pending", () => {
    const result = runNightlySweep(input({ entries: [entry("2026-11-02", { outcome: "completed" })] }));
    const monday = result.newlyClosed.find((closed) => closed.day === "2026-11-02");
    const tuesday = result.newlyClosed.find((closed) => closed.day === "2026-11-03");
    expect(monday?.status).toBe("logged");
    expect(monday?.outcome).toBe("completed");
    expect(monday?.completedKm).toBe(6);
    expect(tuesday?.status).toBe("closed-unlogged");
    expect(tuesday?.outcome).toBeNull();
    expect(result.pending).toContain("2026-11-03");
    expect(result.pending).not.toContain("2026-11-02");
  });

  it("uses the newest revision of a corrected day", () => {
    const result = runNightlySweep(
      input({
        entries: [
          entry("2026-11-04", { revision: 1, outcome: "missed" }),
          entry("2026-11-04", { revision: 2, outcome: "completed", correctedFromRevision: 1 }),
        ],
      }),
    );
    const thursday = result.newlyClosed.find((closed) => closed.day === "2026-11-04");
    expect(thursday?.outcome).toBe("completed");
    expect(thursday?.completedKm).toBe(10);
    expect(result.pending).not.toContain("2026-11-04");
  });
});

describe("the sweep names each day it closed, in the catalogue's own vocabulary", () => {
  it("emits one day.closed event per newly closed day, with the status and the amounts", () => {
    const result = runNightlySweep(input({ entries: [entry("2026-11-02", { outcome: "completed" })] }));
    expect(result.events).toHaveLength(result.newlyClosed.length);
    expect(result.events.every((event) => event.type === "day.closed")).toBe(true);
    expect(result.events.every((event) => event.actor === "worker")).toBe(true);
    expect(result.events.map((event) => event.trainingDay)).toEqual(result.newlyClosed.map((closed) => closed.day));
    expect(result.events[0]?.trainingDay).toBe("2026-11-02");
    expect(result.events[0]?.payload).toMatchObject({ status: "logged", plannedKm: 6, completedKm: 6 });
    expect(result.events[1]?.payload).toMatchObject({ status: "closed-unlogged", plannedKm: 0, completedKm: 0, outcome: null });
    expect(result.events[0]?.timezone).toBe("Asia/Taipei");
  });

  it("emits nothing for days an earlier sweep already closed", () => {
    const first = runNightlySweep(input());
    const second = runNightlySweep(input({ closedDays: first.newlyClosed.map((closed) => closed.day) }));
    expect(first.events.length).toBeGreaterThan(0);
    expect(second.events).toEqual([]);
  });

  it("produces events that satisfy the events contract", () => {
    const result = runNightlySweep(input({ entries: [entry("2026-11-02", { outcome: "completed" })] }));
    for (const event of result.events) {
      const parsed = eventSchema.safeParse(event);
      if (!parsed.success) throw new Error(`${event.type} ${event.trainingDay}: ${JSON.stringify(parsed.error.issues)}`);
    }
  });

  it("gives the same day the same event id twice", () => {
    const first = runNightlySweep(input());
    const second = runNightlySweep(input());
    expect(first.events.map((event) => event.eventId)).toEqual(second.events.map((event) => event.eventId));
  });
});

describe("the signal cache is a snapshot with its own provenance", () => {
  it("carries the bundle, the knowledge hash and the input hash", () => {
    const result = runNightlySweep(input());
    expect(result.signalCache).not.toBeNull();
    expect(result.signalCache?.asOfDay).toBe("2026-11-09");
    expect(result.signalCache?.knowledgeHash).toBe(knowledge.hash);
    expect(result.signalCache?.inputsHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(result.signalCache?.computedAt).toBe(COMPUTED_AT);
    expect(result.signalCache?.signals.length).toBeGreaterThanOrEqual(7);
    for (const signal of result.signalCache?.signals ?? []) {
      const parsed = signalSchema.safeParse(signal);
      if (!parsed.success) throw new Error(`${signal.key}: ${JSON.stringify(parsed.error.issues)}`);
    }
  });

  it("has no cache when the plan does not cover the sweep day", () => {
    const result = runNightlySweep(input({ today: "2026-12-24" }));
    expect(result.signalCache).toBeNull();
    // The days still closed: closing is about the plan's window, not about today being inside it.
    expect(result.newlyClosed.length).toBe(specs.length);
  });

  it("is reproducible: the same input gives the same cache key", () => {
    const first = runNightlySweep(input());
    const second = runNightlySweep(input());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
