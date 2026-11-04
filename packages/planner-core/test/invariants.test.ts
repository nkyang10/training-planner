import { describe, expect, it } from "vitest";
import { checkInvariants, generatePlan, weekStart } from "../src/index";
import type { PlanOutput } from "../src/types";
import { knowledge, makeInput } from "./helpers";

const good = (): PlanOutput => generatePlan(makeInput());
const broken = (): PlanOutput => structuredClone(good());
const names = (output: PlanOutput): string[] => checkInvariants(output, { knowledge }).map((violation) => violation.invariant);

describe("the good plan is clean", () => {
  it("has no violations", () => {
    expect(checkInvariants(good(), { knowledge })).toEqual([]);
  });
});

describe("every invariant can fail, or it is not an invariant", () => {
  it("one-session-per-day", () => {
    const output = broken();
    const first = output.version.sessions[0];
    const second = output.version.sessions[1];
    if (!first || !second) throw new Error("plan too short");
    second.day = first.day;
    expect(names(output)).toContain("one-session-per-day");
  });

  it("no-gaps", () => {
    const output = broken();
    output.version.sessions.splice(3, 1);
    expect(names(output)).toContain("no-gaps");
  });

  it("sorted-and-unique", () => {
    const output = broken();
    const first = output.version.sessions[0];
    const second = output.version.sessions[1];
    if (!first || !second) throw new Error("plan too short");
    output.version.sessions[0] = second;
    output.version.sessions[1] = first;
    expect(names(output)).toContain("sorted-and-unique");
  });

  it("rest-is-rest", () => {
    const output = broken();
    const session = output.version.sessions.find((candidate) => candidate.kind !== "rest");
    if (!session) throw new Error("no running session");
    session.restDay = true;
    expect(names(output)).toContain("rest-is-rest");
  });

  it("hard-day-spacing", () => {
    const output = broken();
    const running = output.version.sessions.filter((session) => session.kind !== "rest");
    const first = running[0];
    const second = running[1];
    if (!first || !second) throw new Error("plan too short");
    for (const session of [first, second]) {
      session.kind = "tempo";
      session.hardDay = true;
    }
    expect(names(output)).toContain("hard-day-spacing");
  });

  it("hard-days-cap", () => {
    const output = broken();
    // Three hard days inside one Monday-to-Sunday week. The first seven days of the horizon are not one
    // week when the plan starts on a Thursday, which is the mistake this test made on its first run.
    const byWeek = new Map<string, string[]>();
    for (const session of output.version.sessions) {
      if (session.kind === "rest") continue;
      const key = weekStart(session.day);
      byWeek.set(key, [...(byWeek.get(key) ?? []), session.day]);
    }
    const target = [...byWeek.values()].find((days) => days.length >= 3);
    if (!target) throw new Error("no week with three running days");
    for (const day of target.slice(0, 3)) {
      const session = output.version.sessions.find((candidate) => candidate.day === day);
      if (!session) continue;
      session.kind = "vo2max";
      session.hardDay = true;
    }
    expect(names(output)).toContain("hard-days-cap");
  });

  it("weekly-increment-ceiling", () => {
    const output = broken();
    const running = output.version.sessions.filter((session) => session.kind !== "rest");
    for (const session of running.slice(-3)) session.distanceKm = (session.distanceKm ?? 0) * 4;
    expect(names(output)).toContain("weekly-increment-ceiling");
  });

  it("safety-subtracts-only", () => {
    const output = broken();
    output.version.appliedRules.push({ ruleId: "a-rule-that-adds", anchor: "safety-hard-stops.yaml#no-double-hard-weekend", effect: "dosed", isSafety: true });
    expect(names(output)).toContain("safety-subtracts-only");
  });
});

describe("checkInvariants returns, it does not throw", () => {
  it("survives a plan with a single session", () => {
    const output = broken();
    const only = output.version.sessions[0];
    if (!only) throw new Error("plan too short");
    output.version.sessions = [only];
    expect(() => checkInvariants(output, { knowledge })).not.toThrow();
  });
});
