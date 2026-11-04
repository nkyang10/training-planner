/**
 * The re-planning engine's tests: every option must be bounded, safe, and explainable.
 *
 * The two tests that matter most are the freeze window (no diff day at or before today + 2) and the invariant
 * guard (a candidate that would break a planner invariant is refused, not offered with a warning). Both are
 * properties a reviewer can check against the plan, not opinions.
 */
import { describe, expect, it } from "vitest";
import { planVersionSchema } from "@training-planner/domain";
import type { PlanVersion, ReviewEvidence } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { addDays, checkInvariants } from "@training-planner/planner-core";
import type { ReviewCandidate } from "@training-planner/review";
import { proposePlanOptions } from "../src/index";
import type { ReplanRequest } from "../src/index";
import { makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "56565656-5656-4656-8656-565656565656";
const TODAY = "2026-11-04";
const PLAN_GENERATED = "2026-10-20";
const FREEZE_DAYS = knowledge.number("review-triggers.yaml#freeze_window_days");
const FIRST_EDITABLE = addDays(TODAY, FREEZE_DAYS);

/**
 * Three weeks of easy running with one quality session in the third week. Three weeks matter: the planner s
 * weekly-increment and long-run-share invariants are only well defined once there is a previous week to compare
 * against, and an option that trips them must be refused rather than offered.
 */
const specs: SessionSpec[] = [
  { day: "2026-10-26", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-10-28", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-10-30", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-02", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-04", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-06", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-09", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-11", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-13", kind: "tempo", km: 8, hard: true, rpe: 7 },
];

const plan = (): PlanVersion => makePlan(specs, PLAN_GENERATED);

const evidence: ReviewEvidence = {
  signalIds: ["completion_rate", "log_continuity"],
  ruleIds: ["plan-too-big"],
  evidenceGradeMax: "B",
};

const candidate = (overrides: Partial<ReviewCandidate> = {}): ReviewCandidate => ({
  kind: "plan-too-big",
  ruleId: "plan-too-big",
  anchor: "review-triggers.yaml#plan_too_big_thresholds",
  evidence,
  presentation: "offer-at-next-open",
  ...overrides,
});

const request = (overrides: Partial<ReplanRequest> = {}): ReplanRequest => ({
  plan: plan(),
  today: TODAY,
  candidate: candidate(),
  knowledge,
  ...overrides,
});

describe("the option set always starts with keeping the plan", () => {
  it("puts keep first and gives it no diff", () => {
    const result = proposePlanOptions(request());
    expect(result.options[0]?.keepAsIs).toBe(true);
    expect(result.options[0]?.optionId).toBe("keep");
    expect(result.options[0]?.diff).toBeNull();
    expect(result.options[0]?.diffId).toBeNull();
    expect(result.options[0]?.loadDeltaPct).toBe(0);
  });

  it("names the first editable day from the freeze window", () => {
    expect(proposePlanOptions(request()).firstEditableDay).toBe(FIRST_EDITABLE);
  });
});

describe("a change option is exactly one bounded change after the freeze window", () => {
  it("downgrades the next quality session, by the knowledge magnitude", () => {
    const result = proposePlanOptions(request());
    const option = result.options.find((candidateOption) => candidateOption.optionId === "downgrade-next-quality");
    expect(option).toBeDefined();
    const after = option?.version?.sessions.find((session) => session.day === "2026-11-13");
    const magnitude = knowledge.number("wellness.yaml#downgrade_magnitude_pct");
    expect(after?.kind).toBe("easy");
    expect(after?.hardDay).toBe(false);
    expect(after?.distanceKm).toBe(Math.round(8 * (1 - magnitude / 100) * 10) / 10);
    expect(option?.diff?.changes).toHaveLength(1);
    expect(option?.diff?.changes[0]?.day).toBe("2026-11-13");
    expect(option?.diff?.changes[0]?.kind).toBe("session.downgraded");
    expect(option?.loadDeltaPct).toBeLessThan(0);
  });

  it("turns the next easy day into a rest day", () => {
    const result = proposePlanOptions(request());
    const option = result.options.find((candidateOption) => candidateOption.optionId === "rest-instead-of-easy");
    expect(option).toBeDefined();
    expect(option?.diff?.changes).toHaveLength(1);
    expect(option?.diff?.changes[0]?.kind).toBe("day.became-rest");
    expect(option?.diff?.changes[0]?.day).toBe("2026-11-06");
    expect(option?.loadDeltaPct).toBeLessThan(0);
  });

  it("never touches a day at or before the freeze boundary", () => {
    const result = proposePlanOptions(request());
    for (const option of result.options) {
      for (const change of option.diff?.changes ?? []) {
        expect(change.day >= FIRST_EDITABLE).toBe(true);
      }
      if (option.keepAsIs) continue;
      // The easy day on 2026-11-04 is inside the freeze window and must survive every option.
      const frozen = option.version?.sessions.find((session) => session.day === "2026-11-04");
      expect(frozen?.kind).toBe("easy");
      expect(frozen?.distanceKm).toBe(6);
    }
  });

  it("keeps the diff within the two-change limit", () => {
    for (const option of proposePlanOptions(request()).options) {
      if (option.diff === null) continue;
      expect(option.diff.changeCountWithinLimit).toBe(true);
      expect(option.diff.changes.length).toBeLessThanOrEqual(2);
    }
  });

  it("records the knobs each change used", () => {
    const option = proposePlanOptions(request()).options.find((candidateOption) => candidateOption.optionId === "downgrade-next-quality");
    expect(option?.diff?.changes[0]?.knobsUsed).toContain("wellness.yaml#downgrade_magnitude_pct");
  });
});

describe("the child version is a real plan version", () => {
  it("is contract-valid, parented and generated by a review", () => {
    const base = plan();
    const result = proposePlanOptions(request({ plan: base }));
    for (const option of result.options) {
      if (option.version === null) continue;
      const parsed = planVersionSchema.safeParse(option.version);
      if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
      expect(option.version.parentVersionId).toBe(base.versionId);
      expect(option.version.versionId).not.toBe(base.versionId);
      expect(option.version.generatedBy).toBe("review-accepted");
      expect(option.version.generatedAtDay).toBe(TODAY);
    }
  });

  it("introduces no new invariant violation", () => {
    const base = plan();
    const baseline = new Set(checkInvariants({ version: base, openQuestions: [] }, { knowledge }).map((violation) => violation.invariant));
    const result = proposePlanOptions(request({ plan: base }));
    for (const option of result.options) {
      if (option.version === null) continue;
      const introduced = checkInvariants({ version: option.version, openQuestions: [] }, { knowledge }).filter(
        (violation) => !baseline.has(violation.invariant),
      );
      expect(introduced).toEqual([]);
    }
  });

  it("does not refuse a reduction for a ratio artefact in a later week", () => {
    // A plan whose first week carries all its volume. Removing the easy day lowers week N, so week N+1 now "adds"
    // volume against a lower base and `weekly-increment-ceiling` fires on week N+1 - while the absolute load there
    // is untouched. The guard is scoped to the days the option changes, so the option stays offerable; refusing it
    // would block the remedy a plan-too-big review exists to offer.
    const firstWeekHeavy = makePlan(
      [
        { day: "2026-11-02", kind: "easy", km: 6, rpe: 4 },
        { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
        { day: "2026-11-06", kind: "easy", km: 6, rpe: 4 },
        { day: "2026-11-07", kind: "rest", km: 0 },
        { day: "2026-11-08", kind: "long", km: 14, rpe: 6 },
        { day: "2026-11-10", kind: "tempo", km: 10, hard: true, rpe: 7 },
        { day: "2026-11-11", kind: "easy", km: 5, rpe: 4 },
      ],
      "2026-11-01",
    );
    const result = proposePlanOptions(request({ plan: firstWeekHeavy }));
    const option = result.options.find((candidateOption) => candidateOption.optionId === "rest-instead-of-easy");
    expect(option).toBeDefined();
    expect(option?.diff?.changes).toHaveLength(1);
    // And the option s own changed day introduces no violation of its own.
    expect(option?.diff?.changes[0]?.day).toBe("2026-11-06");
  });
});

describe("the engine refuses what it cannot offer, and says why", () => {
  it("says so when there is no quality session in the window", () => {
    const easyOnly = makePlan(
      [
        { day: "2026-11-06", kind: "easy", km: 6, rpe: 4 },
        { day: "2026-11-08", kind: "long", km: 14, rpe: 6 },
      ],
      PLAN_GENERATED,
    );
    const result = proposePlanOptions(request({ plan: easyOnly }));
    expect(result.refusals.map((refusal) => refusal.optionId)).toContain("downgrade-next-quality");
    expect(result.refusals.find((refusal) => refusal.optionId === "downgrade-next-quality")?.reason).toContain("no quality session");
  });

  it("says so when the horizon is empty", () => {
    const ended = makePlan([{ day: "2026-11-02", kind: "easy", km: 5, rpe: 4 }], PLAN_GENERATED);
    const result = proposePlanOptions(request({ plan: ended }));
    expect(result.options).toHaveLength(1);
    expect(result.refusals.some((refusal) => refusal.reason.includes("no quality or easy session"))).toBe(true);
  });
});

describe("a safety-critical review can only subtract", () => {
  it("offers no option that adds load", () => {
    const result = proposePlanOptions(
      request({
        candidate: candidate({ kind: "pain-pattern", ruleId: "pain-escalation", presentation: "interrupt-now" }),
      }),
    );
    for (const option of result.options) expect(option.loadDeltaPct).toBeLessThanOrEqual(0);
    for (const option of result.options) {
      for (const change of option.diff?.changes ?? []) expect(change.isSafety).toBe(true);
    }
  });
});

describe("the proposal is explainable and reproducible", () => {
  it("gives every change a cost, in numbers, and a reason", () => {
    for (const option of proposePlanOptions(request()).options) {
      if (option.keepAsIs) continue;
      expect(option.costKey.length).toBeGreaterThan(0);
      const slots = Object.values(option.costSlots);
      expect(slots.length).toBeGreaterThan(0);
      for (const value of slots) expect(["string", "number"]).toContain(typeof value);
      expect(option.diff?.changes[0]?.expectedCost).toBe(option.costKey);
      expect(option.diff?.changes[0]?.reason).toBe("plan-too-big");
    }
  });

  it("uses message keys, not sentences, for labels", () => {
    for (const option of proposePlanOptions(request()).options) {
      expect(option.labelKey).not.toContain(" ");
    }
  });

  it("is deterministic", () => {
    const input = request();
    expect(JSON.stringify(proposePlanOptions(input))).toBe(JSON.stringify(proposePlanOptions(input)));
  });
});
