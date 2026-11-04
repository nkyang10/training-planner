/**
 * The daily prompt's rules, one gate at a time. The tests that matter are the refusals: a prompt that cannot be
 * withheld is not a policy, it is a notification.
 */
import { describe, expect, it } from "vitest";
import { loadKnowledge } from "@training-planner/knowledge";
import type { DayEntry, PlanVersion } from "@training-planner/domain";
import { decideNudge } from "../src/index";
import type { DeliveredPrompt, NudgeInput } from "../src/index";
import { makeEntry, makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "57575757-5757-4757-8757-575757575757";

const specs: SessionSpec[] = [
  { day: "2026-11-02", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-03", kind: "rest", km: 0 },
  { day: "2026-11-04", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-05", kind: "rest", km: 0 },
  { day: "2026-11-06", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-07", kind: "rest", km: 0 },
  { day: "2026-11-08", kind: "long", km: 14, rpe: 6 },
  { day: "2026-11-09", kind: "rest", km: 0 },
];

const plan = (): PlanVersion => makePlan(specs, "2026-11-01");
const entry = (day: string): DayEntry => makeEntry({ day, outcome: "completed" });

const input = (overrides: Partial<NudgeInput> = {}): NudgeInput => ({
  userId: USER,
  today: "2026-11-09",
  nowMinute: 12 * 60,
  entries: [],
  plan: plan(),
  delivered: [],
  loggingHours: [],
  knowledge,
  ...overrides,
});

const delivered = (kind: DeliveredPrompt["kind"], day: string): DeliveredPrompt => ({ kind, day });

describe("nothing to ask about means no prompt", () => {
  it("says no-plan when no plan covers the day", () => {
    expect(decideNudge(input({ plan: null })).reason).toBe("no-plan");
  });

  it("says no-plan when the day is outside the plan window", () => {
    expect(decideNudge(input({ today: "2026-12-24" })).reason).toBe("no-plan");
  });

  it("says nothing-pending when today and every past day are answered", () => {
    const entries = specs.map((spec) => entry(spec.day));
    const decision = decideNudge(input({ entries }));
    expect(decision.prompt).toBeNull();
    expect(decision.reason).toBe("already-answered");
  });
});

describe("the runner's own hour wins over the default", () => {
  it("uses the default hour until there is enough history", () => {
    const decision = decideNudge(input({ entries: [entry("2026-11-02")], loggingHours: [20] }));
    expect(decision.evidence.source).toBe("default");
    expect(decision.evidence.nudgeHour).toBe(19);
    expect(decision.prompt?.atMinute).toBe(19 * 60);
  });

  it("uses the median local logging hour once there is enough history", () => {
    const decision = decideNudge(
      input({
        entries: [entry("2026-11-02"), entry("2026-11-03"), entry("2026-11-04"), entry("2026-11-05")],
        loggingHours: [20, 18, 19, 21],
      }),
    );
    expect(decision.evidence.source).toBe("behaviour");
    expect(decision.evidence.nudgeHour).toBe(19);
    expect(decision.evidence.samples).toBe(4);
  });

  it("takes the lower middle value for an even sample, never an invented average", () => {
    const decision = decideNudge(
      input({
        entries: [entry("2026-11-02"), entry("2026-11-03"), entry("2026-11-04"), entry("2026-11-05")],
        loggingHours: [18, 18, 21, 22],
      }),
    );
    expect(decision.evidence.nudgeHour).toBe(18);
  });
});

describe("quiet hours are a hard stop, not a preference", () => {
  it("moves a candidate hour inside the quiet window to the end of it", () => {
    const decision = decideNudge(
      input({
        entries: [entry("2026-11-02"), entry("2026-11-03"), entry("2026-11-04")],
        loggingHours: [22, 23, 22],
      }),
    );
    expect(decision.evidence.nudgeHour).toBe(22);
    expect(decision.prompt?.atMinute).toBe(7 * 60);
  });

  it("says quiet-hours once the window has opened", () => {
    const decision = decideNudge(input({ nowMinute: 21 * 60 + 30 }));
    expect(decision.prompt).toBeNull();
    expect(decision.reason).toBe("quiet-hours");
  });
});

describe("one budget is shared by every kind of prompt", () => {
  it("refuses when the day's budget is spent, whatever the kind", () => {
    const decision = decideNudge(
      input({ delivered: [delivered("review", "2026-11-09"), delivered("nudge", "2026-11-09")] }),
    );
    expect(decision.reason).toBe("budget");
    expect(decision.budget).toMatchObject({ usedToday: 2, perDay: 2 });
  });

  it("refuses when the week's budget is spent, even on a quiet day", () => {
    const week = ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"];
    const decision = decideNudge(input({ delivered: week.map((day) => delivered("weekly-summary", day)) }));
    expect(decision.reason).toBe("budget");
    expect(decision.budget.usedThisWeek).toBe(5);
  });

  it("does not count a prompt older than the week", () => {
    const decision = decideNudge(input({ delivered: [delivered("weekly-summary", "2026-10-20")] }));
    expect(decision.reason).toBe("ok");
    expect(decision.budget.usedThisWeek).toBe(0);
  });

  it("does not send a second nudge for the same day", () => {
    const decision = decideNudge(input({ delivered: [delivered("nudge", "2026-11-09")] }));
    expect(decision.reason).toBe("delivered");
  });
});

describe("the silence ladder asks three times and then stops", () => {
  it("prompts on day 1 after an unanswered gap", () => {
    const entries = [entry("2026-11-09")];
    const decision = decideNudge(input({ today: "2026-11-09", entries, plan: makePlan(specs, "2026-11-01") }));
    // Today is answered, so the target is the newest gap: 2026-11-08 is unlogged and one day back.
    expect(decision.prompt?.forDay).toBe("2026-11-08");
    expect(decision.evidence.ladderStep).toBe(1);
  });

  it("says nothing on day 2", () => {
    const entries = [entry("2026-11-09"), entry("2026-11-08")];
    const decision = decideNudge(input({ entries }));
    // 2026-11-07 is the newest gap and two days back.
    expect(decision.prompt).toBeNull();
    expect(decision.reason).toBe("silence-ladder");
    expect(decision.evidence.ladderStep).toBe(2);
  });

  it("prompts again on day 3", () => {
    const entries = [entry("2026-11-09"), entry("2026-11-08"), entry("2026-11-07")];
    const decision = decideNudge(input({ entries }));
    expect(decision.prompt?.forDay).toBe("2026-11-06");
    expect(decision.evidence.ladderStep).toBe(3);
  });
});

describe("the decision is reproducible and carries its own evidence", () => {
  it("gives the same answer twice", () => {
    expect(JSON.stringify(decideNudge(input()))).toBe(JSON.stringify(decideNudge(input())));
  });

  it("reports the quiet window and the ladder step it used", () => {
    const decision = decideNudge(input());
    expect(decision.evidence.quietHours).toEqual({ start: 21, end: 7 });
    expect(decision.evidence.ladderStep).toBeNull();
    expect(decision.budget.perDay).toBe(2);
    expect(decision.budget.perWeek).toBe(5);
  });
});
