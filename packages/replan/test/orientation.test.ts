/**
 * A re-plan proposal's tests: the past is untouchable, the invariants hold, the count is honest, and nothing mutates.
 *
 * ADR-0010's argument only holds if these are measured: a proposal that quietly rewrites a past day, or that reports
 * "two changes" while re-cutting the block, would be the failure the ADR exists to prevent.
 */
import { describe, expect, it } from "vitest";
import { addDays, canonicalJson, generatePlan, weekStart } from "@training-planner/planner-core";
import type { AthleteProfile, PlanVersion } from "@training-planner/domain";
import { proposeOrientationReplan } from "../src/index";
import type { OrientationReplanInput } from "../src/index";
import { baseEvidence, baseProfile, knowledge } from "../../planner-core/test/helpers";

const TODAY = "2026-11-09";

/** The plan in force is a real planner output: a plan built by hand would not exercise the invariants honestly. */
const plan = (): PlanVersion =>
  generatePlan({
    profile: baseProfile,
    evidence: baseEvidence,
    state: { planStartDay: "2026-11-02", horizonDays: 21 },
    clock: { today: "2026-11-01" },
    seed: "old-plan",
    knowledge,
  }).version;

const blockStartOf = (): string => {
  const freezeDays = knowledge.number("review-triggers.yaml#freeze_window_days");
  return weekStart(addDays(TODAY, freezeDays + 6));
};

const profile = (overrides: Partial<AthleteProfile> = {}): AthleteProfile => ({
  userId: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  age: 33,
  availability: { days: ["Tue", "Thu", "Sat"] },
  goal: { type: "finish", event: null },
  preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
  health: {},
  ...overrides,
});

const input = (overrides: Partial<OrientationReplanInput> = {}): OrientationReplanInput => ({
  plan: plan(),
  profile: profile(),
  evidence: baseEvidence,
  today: TODAY,
  seed: "orientation-replan",
  knowledge,
  ...overrides,
});

describe("a re-plan proposal is deterministic and leaves its input alone", () => {
  it("same inputs give the same version and the same canonical bytes", () => {
    const first = proposeOrientationReplan(input());
    const second = proposeOrientationReplan(input());
    expect(second.version.versionId).toBe(first.version.versionId);
    expect(canonicalJson(second.version)).toBe(canonicalJson(first.version));
  });

  it("never mutates the plan in force", () => {
    const current = plan();
    const before = canonicalJson(current);
    proposeOrientationReplan(input({ plan: current }));
    expect(canonicalJson(current)).toBe(before);
  });
});

describe("the past is untouchable, whatever the new orientation asks for", () => {
  it("keeps every session before the new block exactly as the runner is committed to it", () => {
    const proposal = proposeOrientationReplan(input());
    const blockStart = blockStartOf();
    for (const before of plan().sessions.filter((session) => session.day < blockStart)) {
      const after = proposal.version.sessions.find((session) => session.day === before.day);
      expect(after?.kind, before.day).toBe(before.kind);
      expect(after?.distanceKm, before.day).toBe(before.distanceKm);
      expect(after?.summaryText, before.day).toBe(before.summaryText);
    }
  });

  it("the stored diff never names a day inside the past or the freeze window", () => {
    const proposal = proposeOrientationReplan(input());
    const blockStart = blockStartOf();
    for (const change of proposal.diff.changes) expect(change.day >= blockStart).toBe(true);
  });

  it("a changed availability moves sessions instead of rewriting history", () => {
    const proposal = proposeOrientationReplan(input({ profile: profile({ availability: { days: ["Mon", "Wed", "Fri", "Sun"] } }) }));
    const blockStart = blockStartOf();
    expect(proposal.summary.changes).toBeGreaterThan(0);
    expect(proposal.summary.firstChangedDay).not.toBe(null);
    expect(proposal.summary.firstChangedDay !== null && proposal.summary.firstChangedDay >= blockStart).toBe(true);
  });
});

describe("the new version still has to pass the planner's invariants", () => {
  it("violates none", () => {
    const proposal = proposeOrientationReplan(input());
    expect(proposal.invariantViolations).toEqual([]);
  });

  it("is honest about exceeding the two-change rule", () => {
    const proposal = proposeOrientationReplan(input({ profile: profile({ availability: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] } }) }));
    expect(proposal.exceedsReviewChangeLimit).toBe(!proposal.diff.changeCountWithinLimit);
    expect(proposal.summary.changes).toBeGreaterThanOrEqual(proposal.diff.changes.length);
    if (proposal.summary.changes > 2) expect(proposal.exceedsReviewChangeLimit).toBe(true);
  });
});
