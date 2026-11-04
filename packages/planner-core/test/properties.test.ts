/**
 * Property tests. Fixtures pin the six runners we thought of; properties look for the runners we did not
 * think of, which is the only way the invariants become true of the calendar rather than true of the
 * examples. fast-check shrinks a failing case to the smallest input that still fails, so a red run here
 * arrives with a reproducible three-day week instead of a 120-day wall of output.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { AthleteProfile } from "@training-planner/domain";
import { checkInvariants, generatePlan } from "../src/index";
import type { PlanInput } from "../src/types";
import { knowledge } from "./helpers";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const KINDS = new Set([
  "rest", "recovery", "easy", "strides", "long", "hills", "tempo",
  "vo2max", "mp", "cross-training", "strength", "test", "race",
]);

interface Case {
  days: (typeof DAYS)[number][];
  horizonDays: number;
  startDay: string;
  weeklyKm: number[];
  age: number | undefined;
  hardDaysAllowed: number | undefined;
  preferredLongRunDay: (typeof DAYS)[number] | undefined;
}

const caseArb: fc.Arbitrary<Case> = fc.record({
  days: fc.uniqueArray(fc.constantFrom(...DAYS), { minLength: 2, maxLength: 6 }),
  horizonDays: fc.integer({ min: 7, max: 120 }),
  startDay: fc.constantFrom("2026-11-05", "2026-11-02", "2026-11-08", "2027-01-07"),
  weeklyKm: fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 1, maxLength: 8 }),
  age: fc.option(fc.integer({ min: 18, max: 70 }), { nil: undefined }),
  hardDaysAllowed: fc.option(fc.integer({ min: 0, max: 2 }), { nil: undefined }),
  preferredLongRunDay: fc.option(fc.constantFrom(...DAYS), { nil: undefined }),
});

function toInput(testCase: Case): PlanInput {
  const profile: AthleteProfile = {
    userId: "22222222-2222-4222-8222-222222222222",
    revision: 1,
    availability: {
      days: testCase.days,
      ...(testCase.hardDaysAllowed === undefined ? {} : { hardDaysAllowed: testCase.hardDaysAllowed }),
      ...(testCase.preferredLongRunDay === undefined ? {} : { preferredLongRunDay: testCase.preferredLongRunDay }),
    },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
    ...(testCase.age === undefined ? {} : { age: testCase.age }),
  };
  return {
    profile,
    evidence: { recentWeeklyKm: testCase.weeklyKm, layoffDays: 0, baselinePaceSecPerKm: 320, baselineConfidence: "medium" },
    state: { planStartDay: testCase.startDay, horizonDays: testCase.horizonDays },
    clock: { today: "2026-11-04" },
    seed: "property-seed",
    knowledge,
  };
}

describe("invariants hold for arbitrary valid inputs", () => {
  it("generates a plan that satisfies every invariant", () => {
    fc.assert(
      fc.property(caseArb, (testCase) => {
        const input = toInput(testCase);
        const output = generatePlan(input);
        expect(output.version.sessions.length).toBe(testCase.horizonDays);
        const days = output.version.sessions.map((session) => session.day);
        expect(new Set(days).size).toBe(days.length);
        expect(days[0]!).toBe(output.version.firstDay);
        expect(days[days.length - 1]!).toBe(output.version.lastDay);
        for (const session of output.version.sessions) {
          expect(KINDS.has(session.kind)).toBe(true);
          if (session.kind === "rest") {
            expect(session.restDay).toBe(true);
            expect(session.distanceKm ?? null).toBeNull();
          }
        }
        expect(checkInvariants(output, { knowledge })).toEqual([]);
      }),
      { numRuns: 60 },
    );
  });

  it("is deterministic for arbitrary inputs, not only for the fixtures", () => {
    fc.assert(
      fc.property(caseArb, (testCase) => {
        const first = generatePlan(toInput(testCase));
        const second = generatePlan(toInput(testCase));
        expect(JSON.stringify(first.version.sessions)).toBe(JSON.stringify(second.version.sessions));
      }),
      { numRuns: 30 },
    );
  });
});
