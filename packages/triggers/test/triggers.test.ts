/**
 * The trigger layer's tests: each rule must be able to fire, to stay quiet, and to say it could not be evaluated.
 *
 * The rules are fed hand-built signal bundles for precision (a rule test should not depend on the signals package's
 * arithmetic) and one end-to-end test builds the bundle with `computeSignals`, so the two packages are proven to
 * fit as well as to work.
 */
import { describe, expect, it } from "vitest";
import type { DayEntry, PlanVersion, Signal, SignalKey } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { computeSignals } from "@training-planner/signals";
import type { SignalOutput } from "@training-planner/signals";
import { evaluateTriggers } from "../src/index";
import type { TriggerContext } from "../src/index";
import { makeEntry, makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "34343434-3434-4434-8434-343434343434";
const TODAY = "2026-11-08";

const signal = (key: SignalKey, value: Signal["value"], overrides: Partial<Signal> = {}): Signal => ({
  key,
  userId: USER,
  asOfDay: TODAY,
  window: { kind: "rolling-days", days: 7 },
  value,
  confidence: "high",
  mayDrive: ["review"],
  computedAt: "2026-11-08T22:40:00.000Z",
  inputsHash: `sha256:${"0".repeat(64)}`,
  knowledgeHash: knowledge.hash,
  ...overrides,
});

const rollup = (day: string, overrides: Partial<SignalOutput["rollups"][number]> = {}): SignalOutput["rollups"][number] => ({
  day,
  plannedSessions: 1,
  plannedKm: 10,
  plannedHardDays: 1,
  restDay: false,
  logged: true,
  outcome: "completed",
  completedKm: 10,
  adherence: 1,
  unlogged: false,
  ...overrides,
});

const bundle = (signals: Signal[], rollups: SignalOutput["rollups"] = []): SignalOutput => ({
  rollups,
  signals: [...signals].sort((a, b) => (a.key < b.key ? -1 : 1)),
  unavailable: [],
});

const context = (overrides: Partial<TriggerContext> = {}): TriggerContext => ({
  userId: USER,
  today: TODAY,
  signals: bundle([]),
  knowledge,
  ...overrides,
});

describe("plan-too-big fires on chronic under-completion or on the hard days not happening", () => {
  it("fires when completion is below the corpus threshold", () => {
    const output = evaluateTriggers(context({ signals: bundle([signal("completion_rate", 0.5, { crossedThreshold: true })]) }));
    const fired = output.fired.find((item) => item.ruleId === "plan-too-big");
    expect(fired).toBeDefined();
    expect(fired?.presentation).toBe("offer-at-next-open");
    expect(fired?.anchor).toContain("plan_too_big_thresholds");
    expect(fired?.detail).toContain("completion 0.5");
  });

  it("fires when two hard sessions were missed in seven days, even with a fine completion rate", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle(
          [signal("completion_rate", 0.9)],
          [rollup("2026-11-05", { outcome: "missed" }), rollup("2026-11-07", { outcome: "skipped" })],
        ),
      }),
    );
    expect(output.fired.map((item) => item.ruleId)).toContain("plan-too-big");
  });

  it("stays quiet when completion is fine and no hard day was missed", () => {
    const output = evaluateTriggers(context({ signals: bundle([signal("completion_rate", 0.9)], [rollup("2026-11-05")]) }));
    expect(output.fired.map((item) => item.ruleId)).not.toContain("plan-too-big");
  });

  it("says it could not evaluate rather than guessing, when the completion signal is blind", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([
          signal("completion_rate", null, { confidence: "insufficient", confidenceNote: "1 planned day inside the window" }),
        ]),
      }),
    );
    const unevaluable = output.unevaluable.find((item) => item.ruleId === "plan-too-big");
    expect(unevaluable?.missing).toBe("completion_rate");
    expect(unevaluable?.reason).toContain("planned day");
  });

  it("does not count an unlogged day as a missed hard session", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle(
          [signal("completion_rate", 0.9)],
          [
            rollup("2026-11-05", { logged: false, outcome: null, unlogged: true }),
            rollup("2026-11-07", { logged: false, outcome: null, unlogged: true }),
          ],
        ),
      }),
    );
    expect(output.fired.map((item) => item.ruleId)).not.toContain("plan-too-big");
  });
});

describe("load-rising-too-fast fires on a ramp above the corpus ceiling or on a shapeless week", () => {
  it("fires when the ramp is above the increment knob", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([
          signal("ramp_rate", 12, { confidence: "medium" }),
          signal("load_monotony", 1.2, { crossedThreshold: false }),
        ]),
      }),
    );
    const fired = output.fired.find((item) => item.ruleId === "load-rising-too-fast");
    expect(fired?.presentation).toBe("weekly-summary");
    expect(fired?.detail).toContain("12%");
    expect(fired?.detail).toContain("8%");
  });

  it("fires on monotony above the band even when the ramp is fine", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([
          signal("ramp_rate", 2),
          signal("load_monotony", 2.6, { crossedThreshold: true }),
        ]),
      }),
    );
    expect(output.fired.map((item) => item.ruleId)).toContain("load-rising-too-fast");
  });

  it("stays quiet on a shaped week with a small ramp", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([signal("ramp_rate", 3), signal("load_monotony", 1.1, { crossedThreshold: false })]),
      }),
    );
    expect(output.fired.map((item) => item.ruleId)).not.toContain("load-rising-too-fast");
  });
});

describe("response-not-landing needs a crossed gap and a streak", () => {
  it("fires when the gap is crossed and the streak reaches the corpus number", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([
          signal("rpe_gap", 2.1, { confidence: "medium", crossedThreshold: true, consecutiveDays: 3 }),
        ]),
      }),
    );
    const fired = output.fired.find((item) => item.ruleId === "response-not-landing");
    expect(fired?.evidence.streakDays).toBe(3);
    expect(fired?.detail).toContain("3 consecutive readings");
  });

  it("stays quiet when the streak is shorter than the corpus number", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([signal("rpe_gap", 2.1, { confidence: "medium", crossedThreshold: true, consecutiveDays: 2 })]),
      }),
    );
    expect(output.fired.map((item) => item.ruleId)).not.toContain("response-not-landing");
  });

  it("says it could not evaluate when the gap has too few readings", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([signal("rpe_gap", null, { confidence: "insufficient", confidenceNote: "1 session compared" })]),
      }),
    );
    expect(output.unevaluable.map((item) => item.ruleId)).toContain("response-not-landing");
  });
});

describe("the rules that need inputs this build does not have are named", () => {
  it("lists goal-feasibility, life-changed and stale-evidence with reasons", () => {
    const output = evaluateTriggers(context());
    const ids = output.unevaluable.map((item) => item.ruleId);
    expect(ids).toContain("goal-feasibility");
    expect(ids).toContain("life-changed");
    expect(ids).toContain("stale-evidence");
    const stale = output.unevaluable.find((item) => item.ruleId === "stale-evidence");
    expect(stale?.missing).toBe("pace_bands");
    expect(stale?.reason).toContain("field test");
  });
});

describe("manual always wins a tie, and arbitration is readable", () => {
  it("puts the runner's own request first at the same presentation level", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([signal("completion_rate", 0.4, { crossedThreshold: true })]),
        manual: { kind: "capacity-change", intent: "travel" },
      }),
    );
    expect(output.fired[0]?.ruleId).toBe("manual-always-allowed");
    expect(output.candidate?.ruleId).toBe("manual-always-allowed");
    expect(output.candidate?.presentation).toBe("offer-at-next-open");
  });

  it("prefers the higher presentation over the higher priority", () => {
    const output = evaluateTriggers(
      context({
        signals: bundle([
          signal("completion_rate", 0.4, { crossedThreshold: true }),
          signal("load_monotony", 2.9, { crossedThreshold: true }),
          signal("ramp_rate", 2),
        ]),
      }),
    );
    // weekly-summary ranks below offer-at-next-open, whatever the rule order.
    expect(output.candidate?.ruleId).toBe("plan-too-big");
  });

  it("has no candidate when nothing fires", () => {
    const output = evaluateTriggers(context());
    expect(output.fired).toEqual([]);
    expect(output.candidate).toBeUndefined();
  });

  it("is deterministic", () => {
    const input = context({ signals: bundle([signal("completion_rate", 0.4, { crossedThreshold: true })]) });
    expect(JSON.stringify(evaluateTriggers(input))).toBe(JSON.stringify(evaluateTriggers(input)));
  });
});

describe("the two packages fit: real signals, real plan, real log", () => {
  const specs: SessionSpec[] = [
    { day: "2026-11-02", kind: "rest", km: 0 },
    { day: "2026-11-03", kind: "easy", km: 6, rpe: 4 },
    { day: "2026-11-04", kind: "rest", km: 0 },
    { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
    { day: "2026-11-06", kind: "rest", km: 0 },
    { day: "2026-11-07", kind: "easy", km: 5, rpe: 4 },
    { day: "2026-11-08", kind: "long", km: 14, hard: true, rpe: 6 },
  ];
  const plan: PlanVersion = makePlan(specs);
  const entry = (day: string, overrides: Partial<DayEntry> = {}): DayEntry => makeEntry({ day, ...overrides });

  it("fires plan-too-big from a week that mostly did not happen", () => {
    const signals = computeSignals({
      userId: USER,
      today: TODAY,
      plan,
      knowledge,
      computedAt: "2026-11-08T22:40:00.000Z",
      entries: [
        entry("2026-11-03", { outcome: "missed" }),
        entry("2026-11-05", { outcome: "missed" }),
        entry("2026-11-07", { outcome: "skipped", outcomeDetail: "travel" }),
      ],
    });
    const output = evaluateTriggers({ userId: USER, today: TODAY, signals, knowledge });
    expect(output.fired.map((item) => item.ruleId)).toContain("plan-too-big");
    expect(output.candidate?.kind).toBe("plan-too-big");
  });

  it("stays quiet on a week that happened", () => {
    const signals = computeSignals({
      userId: USER,
      today: TODAY,
      plan,
      knowledge,
      computedAt: "2026-11-08T22:40:00.000Z",
      entries: [
        entry("2026-11-03", { outcome: "completed" }),
        entry("2026-11-05", { outcome: "completed" }),
        entry("2026-11-07", { outcome: "completed" }),
        entry("2026-11-08", { outcome: "completed" }),
      ],
    });
    const output = evaluateTriggers({ userId: USER, today: TODAY, signals, knowledge });
    expect(output.fired.map((item) => item.ruleId)).not.toContain("plan-too-big");
  });

  it("still names what it cannot see, from a real bundle", () => {
    const signals = computeSignals({
      userId: USER,
      today: TODAY,
      plan,
      knowledge,
      computedAt: "2026-11-08T22:40:00.000Z",
      entries: [],
    });
    const output = evaluateTriggers({ userId: USER, today: TODAY, signals, knowledge });
    expect(output.unevaluable.length).toBeGreaterThanOrEqual(3);
  });
});
