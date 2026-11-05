/**
 * The advisor's tests: the request is deterministic and the gates can fail.
 *
 * A validator that has never been red is a comment with a boolean in front of it. Every test below is one way a
 * fluent model output could be wrong, and the assertion is that the gate names the rule rather than letting the
 * proposal reach a runner.
 */
import { describe, expect, it } from "vitest";
import type { GuidelineContract, PlanVersion } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import {
  ADVISOR_REASON_CODES,
  buildAdvisorRequest,
  effectiveGuidelines,
  validateProposal,
} from "../src/index";
import type { AdvisorInput, AdvisorSettings, ModelPort } from "../src/index";
import { makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const TODAY = "2026-11-09";

const specs: SessionSpec[] = [
  // One day in the past, inside the plan, so the "never editable" gate has something real to refuse.
  { day: "2026-11-08", kind: "easy", km: 5, rpe: 4 },
  { day: "2026-11-10", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-11", kind: "rest", km: 0 },
  { day: "2026-11-12", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-13", kind: "rest", km: 0 },
  { day: "2026-11-14", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-15", kind: "long", km: 14, rpe: 6 },
];

const plan = (): PlanVersion => makePlan(specs, "2026-11-01");

const guideline = (overrides: Partial<GuidelineContract> = {}): GuidelineContract => ({
  guidelineId: "progression-ceiling",
  version: 1,
  tier: "constraint",
  scope: "progression",
  visibility: "public",
  text: "Weekly volume rises by at most 10 percent.",
  rationale: "Stated once, kept once.",
  effectiveFrom: "2026-11-01",
  createdBy: "operator",
  ...overrides,
});

const settings: AdvisorSettings = {
  riskAppetite: "conservative",
  weeklyHours: 5,
  dislikedKinds: ["hills"],
  preferredLongDay: "Sun",
};

const input = (overrides: Partial<AdvisorInput> = {}): AdvisorInput => ({
  plan: plan(),
  entries: [
    {
      day: "2026-11-08",
      outcome: "completed",
      revision: 1,
      tzAtEvent: "Asia/Taipei",
      completedKm: 6,
      rpe: 4,
    },
  ],
  wizardAnswers: [
    { stepId: "goal", answer: { type: "finish" }, revision: 1, source: "wizard" },
    { stepId: "availability", answer: { days: ["Tue", "Thu", "Sat"] }, revision: 2, source: "settings" },
  ],
  settings,
  guidelines: [guideline()],
  today: TODAY,
  knowledge,
  allowedCostKeys: ["easy-day-becomes-quality", "quality-becomes-easy", "no-intensity-this-week"],
  allowedReasonCodes: [...ADVISOR_REASON_CODES],
  ...overrides,
});

const validProposal = (overrides: Record<string, unknown> = {}) => ({
  decision: "propose-change",
  reasonCode: "load-high",
  facts: [{ key: "plannedKm", value: 6 }],
  proposedChanges: [
    {
      day: "2026-11-14",
      kind: "easy",
      fromKm: 6,
      toKm: 4,
      costKey: "quality-becomes-easy",
      costSlots: { km: 2 },
    },
  ],
  confidence: "medium",
  needsHuman: false,
  ...overrides,
});

const validate = (output: unknown, requestInput: AdvisorInput = input()) => {
  const call = buildAdvisorRequest(requestInput);
  return validateProposal({ output, request: call.request, plan: requestInput.plan, today: TODAY, knowledge });
};

describe("the request is deterministic and carries the hashes the audit needs", () => {
  it("is byte-identical for identical inputs", () => {
    const first = buildAdvisorRequest(input());
    const second = buildAdvisorRequest(input());
    expect(first.hashes).toEqual(second.hashes);
  });

  it("changes its prompt hash when a guideline changes", () => {
    const before = buildAdvisorRequest(input());
    const after = buildAdvisorRequest(input({ guidelines: [guideline({ version: 2, text: "Rises by at most 8 percent." })] }));
    expect(after.hashes.promptHash).not.toBe(before.hashes.promptHash);
    expect(after.hashes.guidelineVersionHash).not.toBe(before.hashes.guidelineVersionHash);
  });

  it("resolves the effective version per guideline id, not the newest row blindly", () => {
    const guidelines = [
      guideline({ version: 1, effectiveFrom: "2026-11-01" }),
      guideline({ version: 2, effectiveFrom: "2026-11-01" }),
      guideline({ version: 3, effectiveFrom: "2026-12-01" }),
    ];
    const digest = effectiveGuidelines(guidelines, TODAY);
    expect(digest).toHaveLength(1);
    expect(digest[0]?.version).toBe(2);
  });

  it("carries the folded profile when one is supplied, and null when it is not", () => {
    const withoutProfile = buildAdvisorRequest(input());
    expect(withoutProfile.request.runner.profile).toBe(null);
    const withProfile = buildAdvisorRequest(
      input({
        profile: {
          userId: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
          revision: 1,
          age: 33,
          availability: { days: ["Tue", "Thu", "Sat"] },
          goal: { type: "finish", event: null, riskAppetite: "conservative" },
          preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
          health: {},
        },
      }),
    );
    expect(withProfile.request.runner.profile).toEqual({
      goalType: "finish",
      riskAppetite: "conservative",
      availabilityDays: ["Tue", "Thu", "Sat"],
    });
  });

  it("carries the first editable day from the freeze window and the plan's own facts", () => {
    const { request } = buildAdvisorRequest(input());
    // review-triggers.yaml#freeze_window_days = 2
    expect(request.vocabulary.firstEditableDay).toBe("2026-11-11");
    expect(request.vocabulary.plannedKmByDay["2026-11-12"]).toBe(10);
    expect(request.vocabulary.hardDays).toContain("2026-11-12");
    expect(request.runner.revisedSteps).toEqual(["availability"]);
    expect(request.system.rules.length).toBeGreaterThan(0);
  });
});

describe("a proposal that respects the plan is askable", () => {
  it("accepts a future, freeze-cleared change that does not add load", () => {
    const verdict = validate(validProposal());
    expect(verdict.accepted).toBe(true);
    expect(verdict.violations).toEqual([]);
    expect(verdict.proposal?.proposedChanges).toHaveLength(1);
  });

  it("accepts a no-change decision with no changes", () => {
    const verdict = validate({ decision: "no-change", reasonCode: "no-action-needed", facts: [], proposedChanges: [], confidence: "high", needsHuman: false });
    expect(verdict.accepted).toBe(true);
  });
});

describe("every gate can fail, and names the rule it broke", () => {
  it("refuses more than two changes", () => {
    const verdict = validate(
      validProposal({
        proposedChanges: [
          { day: "2026-11-14", kind: "easy", fromKm: 6, toKm: 5, costKey: "quality-becomes-easy", costSlots: {} },
          { day: "2026-11-15", kind: "long", fromKm: 14, toKm: 12, costKey: "quality-becomes-easy", costSlots: {} },
          { day: "2026-11-10", kind: "easy", fromKm: 6, toKm: 4, costKey: "quality-becomes-easy", costSlots: {} },
        ],
      }),
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.fallback).toBe("deterministic-replan");
    expect(verdict.violations.join(" ")).toContain("proposal");
  });

  it("refuses a past day and today", () => {
    const past = validate(validProposal({ proposedChanges: [{ day: "2026-11-08", kind: "easy", fromKm: 5, toKm: 4, costKey: "quality-becomes-easy", costSlots: {} }] }));
    expect(past.accepted).toBe(false);
    expect(past.violations.join(" ")).toContain("never editable");
  });

  it("refuses a day inside the freeze window", () => {
    const verdict = validate(validProposal({ proposedChanges: [{ day: "2026-11-10", kind: "easy", fromKm: 6, toKm: 4, costKey: "quality-becomes-easy", costSlots: {} }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("freeze window");
  });

  it("accepts a fact whose number is in the request's vocabulary", () => {
    // The request shows the model `vocabulary.maxChanges: 2`; citing it is grounded, and the gate must say so.
    const verdict = validate(
      validProposal({ facts: [{ key: "maxChanges", value: 2 }] }),
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.violations).toEqual([]);
  });

  it("still refuses a fact whose number appears nowhere in the request", () => {
    const verdict = validate(validProposal({ facts: [{ key: "weeklyKm", value: 7.4 }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("did not contain");
  });

  it("refuses an invented baseline", () => {
    const verdict = validate(validProposal({ proposedChanges: [{ day: "2026-11-14", kind: "easy", fromKm: 9, toKm: 4, costKey: "quality-becomes-easy", costSlots: {} }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("fromKm 9");
  });

  it("refuses a kind the plan does not use", () => {
    const verdict = validate(validProposal({ proposedChanges: [{ day: "2026-11-14", kind: "vo2max", fromKm: 6, toKm: 4, costKey: "quality-becomes-easy", costSlots: {} }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("not a kind this plan uses");
  });

  it("refuses a cost key outside the vocabulary", () => {
    const verdict = validate(validProposal({ proposedChanges: [{ day: "2026-11-14", kind: "easy", fromKm: 6, toKm: 4, costKey: "invented-cost", costSlots: {} }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("costKey invented-cost");
  });

  it("refuses a number the request did not contain", () => {
    const verdict = validate(validProposal({ facts: [{ key: "plannedKm", value: 123 }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("which the request did not contain");
  });

  it("refuses a proposal that adds weekly load", () => {
    // 2026-11-14 is easy 6 km; raising it to 8 km makes the week heavier even though it is still a "small" change.
    const verdict = validate(validProposal({ proposedChanges: [{ day: "2026-11-14", kind: "easy", fromKm: 6, toKm: 8, costKey: "easy-day-becomes-quality", costSlots: {} }] }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("adds load");
  });

  it("refuses adding kilometres when a safety guideline is in effect", () => {
    const verdict = validate(
      validProposal({ proposedChanges: [{ day: "2026-11-14", kind: "easy", fromKm: 6, toKm: 8, costKey: "easy-day-becomes-quality", costSlots: {} }] }),
      input({
        guidelines: [guideline({ guidelineId: "pain-hold", scope: "safety", tier: "non-negotiable", visibility: "internal" })],
      }),
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("may not add kilometres");
  });

  it("refuses a decision that contradicts its own changes", () => {
    const noChangeWithChanges = validate(validProposal({ decision: "no-change" }));
    expect(noChangeWithChanges.accepted).toBe(false);
    expect(noChangeWithChanges.violations.join(" ")).toContain("no-change but changes were proposed");
    const changeWithNothing = validate(validProposal({ proposedChanges: [] }));
    expect(changeWithNothing.accepted).toBe(false);
    expect(changeWithNothing.violations.join(" ")).toContain("no change was proposed");
  });

  it("refuses a reason code outside the vocabulary", () => {
    const verdict = validate(validProposal({ reasonCode: "vibes" }));
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("reasonCode vibes");
  });

  it("requires the human flag when a 7+ pain report is in the context", () => {
    const verdict = validate(
      validProposal({ needsHuman: false }),
      input({
        entries: [
          {
            day: "2026-11-08",
            outcome: "completed",
            revision: 1,
            tzAtEvent: "Asia/Taipei",
            completedKm: 6,
            pain: [{ site: "achilles", intensity: 8 }],
          },
        ],
      }),
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.violations.join(" ")).toContain("needsHuman");
  });
});

describe("the model is a port, and its output goes through the same gates", () => {
  it("a fake model's proposal is validated, not trusted", async () => {
    const fake: ModelPort = {
      complete: async () => validProposal({ proposedChanges: [{ day: "2026-11-10", kind: "easy", fromKm: 6, toKm: 4, costKey: "quality-becomes-easy", costSlots: {} }] }),
    };
    const call = buildAdvisorRequest(input());
    const output = await fake.complete(call);
    const verdict = validateProposal({ output, request: call.request, plan: input().plan, today: TODAY, knowledge });
    // The fake model answered fluently and wrongly: the day is inside the freeze window.
    expect(verdict.accepted).toBe(false);
    expect(verdict.fallback).toBe("deterministic-replan");
    expect(verdict.violations.join(" ")).toContain("freeze window");
  });


  it("carries the coach's references into the request and hashes them", () => {
    const references = [
      {
        id: "safety-subtract-only",
        title: "Safety can only subtract",
        text: "A safety rule may remove or downgrade a session; it may never add load.",
        tier: "safety" as const,
        sourcePath: "knowledge/heuristics/safety-hard-stops.yaml",
        sourceHeading: "subtract_only: true",
      },
    ];
    const call = buildAdvisorRequest(input({ references }));
    expect(call.request.system.references).toHaveLength(1);
    expect(call.hashes.referenceHash).toContain("sha256");
    const empty = buildAdvisorRequest(input());
    expect(empty.request.system.references).toEqual([]);
    expect(empty.hashes.referenceHash).not.toBe(call.hashes.referenceHash);
  });
});
