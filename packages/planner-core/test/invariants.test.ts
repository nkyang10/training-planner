import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlanVersion, Session } from "@training-planner/domain";
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

describe("the volume curve is judged against the base plan when there is one", () => {
  // The fixture encodes the reason for `baseVersion`: a review reduces week N, and without a base the following
  // week looks like a jump although its absolute load never changed.
  interface ReductionFixture {
    sessions: Array<{ day: string; kind: Session["kind"]; km: number }>;
    reduction: { day: string; toKm: number; toKind: Session["kind"] };
    addition: { day: string; toKm: number };
    extraWeek: Array<{ day: string; kind: Session["kind"]; km: number }>;
  }
  const fixture: ReductionFixture = JSON.parse(
    readFileSync(join(process.cwd(), "packages", "planner-core", "test", "fixtures", "review-reduction.json"), "utf8"),
  ) as ReductionFixture;

  // Start from a real generated version, so the plan carries every frozen field, and replace only what the fixture
  // is about: the sessions and the window. A hand-built literal would drift from the contract.
  const template = (): PlanVersion => generatePlan(makeInput()).version;
  const planOf = (sessions: Array<{ day: string; kind: Session["kind"]; km: number }>, versionId: string): PlanVersion => ({
    ...template(),
    versionId,
    generatedBy: "initial-build",
    generatedAtDay: "2026-11-01",
    firstDay: sessions[0]?.day ?? "2026-11-02",
    lastDay: sessions[sessions.length - 1]?.day ?? "2026-11-02",
    sessions: sessions.map((session) => ({
      day: session.day,
      kind: session.kind,
      outcome: session.kind === "rest" ? ("rest" as const) : ("planned" as const),
      restDay: session.kind === "rest",
      hardDay: false,
      distanceKm: session.km,
      targetRpe: null,
      summaryText: `${session.kind} ${session.km} km`,
    })),
  });

  const base = (): PlanVersion => planOf(fixture.sessions, "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa");
  const withReduction = (): PlanVersion => {
    const version = base();
    return {
      ...version,
      versionId: "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
      parentVersionId: version.versionId,
      generatedBy: "review-accepted",
      generatedAtDay: "2026-11-05",
      sessions: version.sessions.map((session) =>
        session.day === fixture.reduction.day
          ? {
              ...session,
              kind: fixture.reduction.toKind,
              outcome: fixture.reduction.toKind === "rest" ? ("rest" as const) : ("planned" as const),
              restDay: fixture.reduction.toKind === "rest",
              distanceKm: fixture.reduction.toKm,
              summaryText: `${fixture.reduction.toKind} ${fixture.reduction.toKm} km`,
            }
          : session,
      ),
    };
  };

  it("fires on the ratio artefact when it has no base to compare against", () => {
    // Week 11-02 drops from 42.0 to 28.0 km/wk, so week 11-09 now "adds" 14 km/wk against a base the runner was
    // never on. The invariant cannot know that without being told what the base plan was.
    expect(checkInvariants({ version: withReduction(), openQuestions: [] }, { knowledge }).map((violation) => violation.invariant)).toContain(
      "weekly-increment-ceiling",
    );
  });

  it("does not fire on the same reduction when the base plan is given", () => {
    const violations = checkInvariants({ version: withReduction(), openQuestions: [] }, { knowledge, baseVersion: base() });
    expect(violations.map((violation) => violation.invariant)).not.toContain("weekly-increment-ceiling");
  });

  it("still fires when the candidate actually adds load", () => {
    const version = base();
    const added: PlanVersion = {
      ...version,
      versionId: "cccccccc-1111-4111-8111-cccccccccccc",
      parentVersionId: version.versionId,
      generatedAtDay: "2026-11-05",
      sessions: version.sessions.map((session) =>
        session.day === fixture.addition.day ? { ...session, distanceKm: fixture.addition.toKm } : session,
      ),
    };
    expect(checkInvariants({ version: added, openQuestions: [] }, { knowledge, baseVersion: base() }).map((violation) => violation.invariant)).toContain(
      "weekly-increment-ceiling",
    );
  });

  it("still fires for a new week the base plan never had", () => {
    // The base has no week of 11-23, so the fallback baseline is the candidate's own previous week - and the extra
    // week is a genuine jump against it. A base must not blind the check to load the runner never agreed to.
    const version = base();
    const extended: PlanVersion = {
      ...version,
      versionId: "dddddddd-1111-4111-8111-dddddddddddd",
      parentVersionId: version.versionId,
      generatedAtDay: "2026-11-05",
      lastDay: "2026-11-27",
      sessions: [
        ...version.sessions,
        ...fixture.extraWeek.map((session) => ({
          day: session.day,
          kind: session.kind,
          outcome: session.kind === "rest" ? ("rest" as const) : ("planned" as const),
          restDay: session.kind === "rest",
          distanceKm: session.km * 3,
          hardDay: false,
          targetRpe: null,
          summaryText: `${session.kind} ${session.km * 3} km`,
        })),
      ],
    };
    expect(checkInvariants({ version: extended, openQuestions: [] }, { knowledge, baseVersion: base() }).map((violation) => violation.invariant)).toContain(
      "weekly-increment-ceiling",
    );
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


describe("a runner's preference cannot override the corpus's hard-day cap", () => {
  const hardKinds = ["tempo", "vo2max", "hills", "mp", "test", "race"];
  const busiestWeek = (version: PlanVersion): number => {
    const perWeek = new Map<string, number>();
    for (const session of version.sessions) {
      if (session.hardDay === true || hardKinds.includes(session.kind)) {
        perWeek.set(weekStart(session.day), (perWeek.get(weekStart(session.day)) ?? 0) + 1);
      }
    }
    return Math.max(...perWeek.values());
  };

  it("caps hard days at the corpus's cap even when the runner offers seven days", () => {
    const cap = knowledge.number("intensity-distribution.yaml#hard_days_cap");
    const { version } = generatePlan(
      makeInput({
        profile: {
          ...makeInput().profile,
          availability: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
        },
      }),
    );
    const hard = version.sessions.filter((session) => session.hardDay === true || hardKinds.includes(session.kind));
    expect(hard.length).toBeGreaterThan(0);
    expect(busiestWeek(version)).toBeLessThanOrEqual(cap);
  });

  it("the aggressive appetite moves the band, not the cap", () => {
    const cap = knowledge.number("intensity-distribution.yaml#hard_days_cap");
    const aggressive = generatePlan(
      makeInput({
        profile: {
          ...makeInput().profile,
          availability: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
          goal: { type: "finish", event: null, riskAppetite: "aggressive" },
        },
      }),
    );
    expect(busiestWeek(aggressive.version)).toBeLessThanOrEqual(cap);
  });
});
