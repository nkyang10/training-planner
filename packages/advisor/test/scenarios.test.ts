/**
 * The advisor's evaluation harness (ADR-0009, P4).
 *
 * The gates in `validate.ts` are only worth their code if they are measured against plausible wrong answers. Each
 * scenario in `eval/advisor-scenarios/scenarios.json` is one such answer, and the expectation is what the validator
 * must say about it. Two properties matter and both are asserted: a gate that accepts everything fails the rejected
 * scenarios, and a gate that rejects everything fails the accepted ones.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { GuidelineContract, PlanVersion } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { buildAdvisorRequest, validateProposal } from "../src/index";
import type { AdvisorInput, AdvisorSettings } from "../src/index";
import { makePlan } from "../../policy/test/helpers";
import type { SessionSpec } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const TODAY = "2026-11-09";

interface Scenario {
  name: string;
  why: string;
  guidelines?: GuidelineContract[];
  entries?: AdvisorInput["entries"];
  expect: { accepted: boolean; violationContains?: string };
  proposal: unknown;
}

const file = JSON.parse(readFileSync(join(process.cwd(), "eval", "advisor-scenarios", "scenarios.json"), "utf8")) as {
  scenarios: Scenario[];
};

const specs: SessionSpec[] = [
  { day: "2026-11-08", kind: "easy", km: 5, rpe: 4 },
  { day: "2026-11-10", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-11", kind: "rest", km: 0 },
  { day: "2026-11-12", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-13", kind: "rest", km: 0 },
  { day: "2026-11-14", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-15", kind: "long", km: 14, rpe: 6 },
];

const plan = (): PlanVersion => makePlan(specs, "2026-11-01");

const settings: AdvisorSettings = {
  riskAppetite: "conservative",
  weeklyHours: 5,
  dislikedKinds: ["hills"],
  preferredLongDay: "Sun",
};

const baseGuideline: GuidelineContract = {
  guidelineId: "progression-ceiling",
  version: 1,
  tier: "constraint",
  scope: "progression",
  visibility: "public",
  text: "Weekly volume rises by at most 10 percent.",
  rationale: "Stated once, kept once.",
  effectiveFrom: "2026-11-01",
  createdBy: "operator",
};

const defaultEntries: AdvisorInput["entries"] = [
  { day: "2026-11-08", outcome: "completed", revision: 1, tzAtEvent: "Asia/Taipei", completedKm: 6, rpe: 4 },
];

const inputFor = (scenario: Scenario): AdvisorInput => ({
  plan: plan(),
  entries: scenario.entries ?? defaultEntries,
  wizardAnswers: [{ stepId: "goal", answer: { type: "finish" }, revision: 1, source: "wizard" }],
  settings,
  guidelines: scenario.guidelines ?? [baseGuideline],
  today: TODAY,
  knowledge,
  allowedCostKeys: ["easy-day-becomes-quality", "quality-becomes-easy", "no-intensity-this-week"],
  allowedReasonCodes: ["adherence-low", "pain-rising", "load-high", "goal-changed", "preference-changed", "phase-boundary", "no-action-needed"],
});

const verdictOf = (scenario: Scenario) => {
  const input = inputFor(scenario);
  const call = buildAdvisorRequest(input);
  return validateProposal({ output: scenario.proposal, request: call.request, plan: input.plan, today: TODAY, knowledge });
};

describe("every scenario is measured, and the harness can fail in both directions", () => {
  it("holds at least ten scenarios, with accepted and rejected both represented", () => {
    expect(file.scenarios.length).toBeGreaterThanOrEqual(10);
    expect(file.scenarios.some((scenario) => scenario.expect.accepted)).toBe(true);
    expect(file.scenarios.some((scenario) => !scenario.expect.accepted)).toBe(true);
    // Names are unique, so a copy-paste cannot silently double-count a rule.
    expect(new Set(file.scenarios.map((scenario) => scenario.name)).size).toBe(file.scenarios.length);
  });

  it("every scenario has a stated reason, so a fixture is not just an assertion", () => {
    for (const scenario of file.scenarios) {
      expect(scenario.why.length, scenario.name).toBeGreaterThan(20);
    }
  });
});

describe("the gates answer each scenario the way its expectation says", () => {
  for (const scenario of file.scenarios) {
    it(`${scenario.name}: ${scenario.why}`, () => {
      const verdict = verdictOf(scenario);
      expect(verdict.accepted, `${scenario.name}: ${verdict.violations.join("; ")}`).toBe(scenario.expect.accepted);
      if (scenario.expect.accepted) {
        expect(verdict.fallback).toBe("none");
        expect(verdict.proposal).toBeDefined();
      } else {
        expect(verdict.fallback).toBe("deterministic-replan");
        expect(verdict.violations.length).toBeGreaterThan(0);
        if (scenario.expect.violationContains !== undefined) {
          expect(verdict.violations.join(" ")).toContain(scenario.expect.violationContains);
        }
      }
    });
  }
});

describe("a rejected proposal never reaches the runner, and the fallback is named", () => {
  it("a plausible wrong answer is refused with the deterministic replan as the only next step", () => {
    const scenario = file.scenarios.find((candidate) => candidate.name === "freeze-window-change-is-refused");
    expect(scenario).toBeDefined();
    const verdict = verdictOf(scenario as Scenario);
    expect(verdict.accepted).toBe(false);
    expect(verdict.fallback).toBe("deterministic-replan");
    expect(verdict.proposal).toBeUndefined();
  });
});
