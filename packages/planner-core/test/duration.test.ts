/**
 * Elapsed time: the plan says how long a session takes, from a pace the plan already prescribes.
 *
 * The rule is in knowledge/heuristics/pace-bands.yaml#elapsed_estimate and the prose is in
 * knowledge/plan-construction/key-workout-dosage.md. The tests that matter: the estimate is never a second pace
 * invented for the display, and a runner with no pace evidence gets no duration rather than a fabricated one.
 */
import { describe, expect, it } from "vitest";
import { generatePlan } from "../src/index";
import { makeInput } from "./helpers";

const planFor = (overrides: Parameters<typeof makeInput>[0] = {}) => generatePlan(makeInput(overrides));

describe("a session with pace evidence says how long it takes", () => {
  it("estimates easy days from the midpoint of their own prescribed band", () => {
    const plan = planFor().version;
    const easy = plan.sessions.find((session) => session.kind === "easy" && (session.distanceKm ?? 0) > 0);
    expect(easy).toBeDefined();
    const baseline = 330;
    const bandWidth = 6;
    // pace-bands.yaml#elapsed_estimate.easy_band_midpoint_widths = 1.5, so 330 + 9 = 339 s/km.
    const estimatePace = baseline + bandWidth * 1.5;
    const expected = Math.max(1, Math.round(((easy?.distanceKm ?? 0) * estimatePace) / 60));
    expect(easy?.durationMin).toBe(expected);
    // The estimate sits inside the prescribed band, which is the point: it is not a second pace. The band's edges
    // are multiples of 5 s/km, so the comparison is against the edges, not against the raw offset.
    expect(easy?.targetPaceMinSecPerKm).toBeLessThanOrEqual(estimatePace);
    expect(easy?.targetPaceMaxSecPerKm).toBeGreaterThanOrEqual(estimatePace);
    expect(easy?.durationMin).not.toBeNull();
  });

  it("estimates quality days at the slow end of the easy band, not at a quality pace it never prescribed", () => {
    const plan = planFor().version;
    const quality = plan.sessions.find((session) => session.hardDay === true && (session.distanceKm ?? 0) > 0);
    expect(quality).toBeDefined();
    const expected = Math.max(1, Math.round(((quality?.distanceKm ?? 0) * (330 + 6 * 2)) / 60));
    expect(quality?.durationMin).toBe(expected);
    // The plan still prescribes quality by effort: no pace target on the quality session itself.
    expect(quality?.targetPaceMinSecPerKm ?? null).toBeNull();
    expect(quality?.primaryTarget).toBe("rpe");
  });

  it("keeps a rest day at no time at all", () => {
    const plan = planFor().version;
    const rest = plan.sessions.find((session) => session.kind === "rest");
    expect(rest).toBeDefined();
    expect(rest?.durationMin ?? null).toBeNull();
  });

  it("says nothing when there is no pace evidence", () => {
    const plan = planFor({ evidence: { recentWeeklyKm: [30, 32, 31], layoffDays: 0, baselinePaceSecPerKm: null } }).version;
    const running = plan.sessions.filter((session) => session.kind !== "rest");
    expect(running.length).toBeGreaterThan(0);
    for (const session of running) expect(session.durationMin ?? null).toBeNull();
  });

  it("stays inside the contract's bound", () => {
    // plan-version.schema.json caps durationMin at 1500; a long run at an easy pace must not cross it.
    const plan = planFor({ evidence: { recentWeeklyKm: [70, 72, 71], layoffDays: 0, baselinePaceSecPerKm: 420 } }).version;
    for (const session of plan.sessions) {
      if (session.durationMin === null || session.durationMin === undefined) continue;
      expect(session.durationMin).toBeGreaterThanOrEqual(1);
      expect(session.durationMin).toBeLessThanOrEqual(1500);
    }
  });
});
