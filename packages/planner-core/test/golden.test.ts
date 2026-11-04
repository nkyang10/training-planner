/**
 * The six golden plans. These are the specification (docs/roadmap/milestones.md, M1): the planner is
 * correct when these pass, and a rule change is *allowed* to break exactly the fixtures it should break.
 *
 * Every expectation is an invariant of a correct plan, not a snapshot of a run. A snapshot the planner
 * produced itself proves only that the planner is deterministic, which determinism.test.ts already
 * proves; `expect.planHash` is the snapshot that matters, and it stays null until a coach has read the
 * plan (the M1 coach-signoff criterion).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { athleteProfileSchema, planVersionSchema } from "@training-planner/domain";
import { GOLDEN_FIXTURE_COUNT, fixtureSchema } from "@training-planner/golden-fixtures";
import { canonicalJson, hashOf } from "@training-planner/knowledge/canonical";
import { checkInvariants, generatePlan, weekStart } from "../src/index";
import type { Session } from "@training-planner/domain";
import { knowledge } from "./helpers";

const directory = join(process.cwd(), "eval", "golden-plans");
// schema.json describes the fixture format; it is not a fixture, and parsing it as one is how this test
// first failed (at module load, before a single plan was generated).
const files = readdirSync(directory)
  .filter((name) => name.endsWith(".json") && name !== "schema.json")
  .sort();
const isHard = (session: Session): boolean => session.hardDay === true || ["tempo", "vo2max", "hills", "mp", "test", "race"].includes(session.kind);

describe("the golden fixture set", () => {
  it(`holds exactly ${GOLDEN_FIXTURE_COUNT} fixtures`, () => {
    expect(files.length).toBe(GOLDEN_FIXTURE_COUNT);
  });
});

describe.each(files)("%s", (file) => {
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync(join(directory, file), "utf8")));

  it("generates a valid, deterministic plan that meets its expectations", () => {
    const profile = athleteProfileSchema.parse(fixture.input.profile);
    const input = {
      profile,
      evidence: fixture.input.evidence,
      state: fixture.input.state,
      clock: fixture.input.clock,
      seed: fixture.input.seed,
      knowledge,
    };

    const first = generatePlan(input);
    const second = generatePlan(input);
    expect(canonicalJson(first.version)).toBe(canonicalJson(second.version));

    const parsed = planVersionSchema.safeParse(first.version);
    expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 4))).toBe(true);

    const violations = checkInvariants(first, { knowledge });
    if (fixture.expect.invariantsHold) expect(violations).toEqual([]);

    const sessions = first.version.sessions;
    expect(first.version.firstDay).toBe(fixture.expect.firstDay);
    expect(first.version.lastDay).toBe(fixture.expect.lastDay);
    expect(sessions.length).toBe(fixture.expect.sessionCount);

    const restDays = sessions.filter((session) => session.kind === "rest");
    expect(restDays.length).toBeGreaterThanOrEqual(fixture.expect.restDaysMin);

    const hardDays = sessions.filter(isHard).map((session) => session.day).sort();
    const perWeek = new Map<string, number>();
    for (const day of hardDays) perWeek.set(weekStart(day), (perWeek.get(weekStart(day)) ?? 0) + 1);
    const busiest = Math.max(0, ...perWeek.values());
    expect(busiest).toBeLessThanOrEqual(fixture.expect.hardDaysMaxPerWeek);

    if (fixture.expect.qualityKinds !== undefined) {
      // Quality includes the cheap neuromuscular kind, which is not a hard day: the ordering rule is about the
      // sequence of quality exposures, not about the hard-day count.
      const quality = sessions.filter((session) => isHard(session) || session.kind === "strides").map((session) => session.kind);
      expect(quality.slice(0, fixture.expect.qualityKinds.length)).toEqual(fixture.expect.qualityKinds);
    }

    if (fixture.expect.sessionDurations !== undefined) {
      // Elapsed time is an estimate from a pace the plan already prescribes (pace-bands.yaml#elapsed_estimate),
      // so it is asserted per day rather than summed: a plan that moved a day but kept the total is a different plan.
      const byDay = new Map(sessions.map((session) => [session.day, session]));
      for (const expectation of fixture.expect.sessionDurations) {
        const session = byDay.get(expectation.day);
        expect(session, `no session on ${expectation.day}`).toBeDefined();
        expect(session?.durationMin, `duration on ${expectation.day}`).toBe(expectation.durationMin);
      }
    }

    for (let index = 1; index < hardDays.length; index += 1) {
      const previous = hardDays[index - 1];
      const current = hardDays[index];
      if (!previous || !current) continue;
      const hours = (Date.parse(`${current}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 3_600_000;
      expect(hours).toBeGreaterThanOrEqual(fixture.expect.minHoursBetweenHardDays);
    }

    const weeklyTotals = new Map<string, { km: number; days: number }>();
    for (const session of sessions) {
      const key = weekStart(session.day);
      const current = weeklyTotals.get(key) ?? { km: 0, days: 0 };
      weeklyTotals.set(key, { km: current.km + (session.distanceKm ?? 0), days: current.days + 1 });
    }
    const rates = [...weeklyTotals.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, total]) => ({ rate: (total.km * 7) / total.days, days: total.days }));
    for (let index = 1; index < rates.length; index += 1) {
      const previous = rates[index - 1];
      const current = rates[index];
      if (!previous || !current || previous.rate <= 0) continue;
      const growthPct = ((current.rate - previous.rate) / previous.rate) * 100;
      const tolerance = (0.05 * 7 * 100) / previous.rate / previous.days;
      if (growthPct > 0) expect(growthPct).toBeLessThanOrEqual(fixture.expect.weeklyIncrementPctMax + tolerance);
    }

    // The first week of a block is reduced, and this is the expectation that would fail if the rule
    // disappeared: a reverted engine puts week 1 at the same rate as week 2, which is a share of ~1.0.
    if (fixture.expect.firstWeekVsRecentMax !== undefined) {
      const totals = new Map<string, { km: number; days: number }>();
      for (const session of sessions) {
        const key = weekStart(session.day);
        const current = totals.get(key) ?? { km: 0, days: 0 };
        totals.set(key, { km: current.km + (session.distanceKm ?? 0), days: current.days + 1 });
      }
      const keys = [...totals.keys()].sort();
      const firstTotal = keys[0] === undefined ? undefined : totals.get(keys[0]);
      const firstRate = firstTotal === undefined || firstTotal.days === 0 ? 0 : (firstTotal.km * 7) / firstTotal.days;
      const recent = [...fixture.input.evidence.recentWeeklyKm].sort((a, b) => a - b);
      const middle = Math.floor(recent.length / 2);
      const median = recent.length % 2 === 1 ? (recent[middle] ?? 0) : ((recent[middle - 1] ?? 0) + (recent[middle] ?? 0)) / 2;
      expect(median).toBeGreaterThan(0);
      expect(firstRate / median).toBeLessThanOrEqual(fixture.expect.firstWeekVsRecentMax);
    }

    const longRuns = sessions.filter((session) => session.kind === "long");
    for (const longRun of longRuns) expect(longRun.distanceKm ?? 0).toBeLessThanOrEqual(fixture.expect.longRunMaxKm);

    if (fixture.expect.planHash !== null) expect(hashOf(first.version)).toBe(fixture.expect.planHash);

    console.log(
      `  ${fixture.id}: ${sessions.length} sessions, ${restDays.length} rest days, ${hardDays.length} hard days (max ${busiest}/week), ` +
        `longest ${Math.max(0, ...longRuns.map((session) => session.distanceKm ?? 0)).toFixed(1)} km, ${first.version.knowledgeHash.slice(0, 16)}...`,
    );
  });
});
