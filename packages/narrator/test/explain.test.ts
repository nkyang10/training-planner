/**
 * The explanation surface's tests. The interesting claim is F3: a plan that starts mid-week must say both the
 * raw number and the comparable one, because the raw number alone reads as a jump.
 */
import { describe, expect, it } from "vitest";
import { loadKnowledge } from "@training-planner/knowledge";
import { athleteProfileSchema } from "@training-planner/domain";
import type { PlanVersion } from "@training-planner/domain";
import { fixtureSchema } from "@training-planner/golden-fixtures";
import { generatePlan } from "@training-planner/planner-core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderPlanExplanation, summariseWeeks } from "../src/index";
import { numbersIn } from "../src/index";
import { makePlan } from "../../policy/test/helpers";

const knowledge = loadKnowledge("knowledge/heuristics");
const directory = join(process.cwd(), "eval", "golden-plans");

const planFrom = (id: string): PlanVersion => {
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync(join(directory, `${id}.json`), "utf8")));
  const profile = athleteProfileSchema.parse(fixture.input.profile);
  return generatePlan({
    profile,
    evidence: fixture.input.evidence,
    state: fixture.input.state,
    clock: fixture.input.clock,
    seed: fixture.input.seed,
    knowledge,
  }).version;
};

/** A plan that begins on a Monday, so no week is partial. */
const fullWeekPlan = (): PlanVersion =>
  makePlan([
    { day: "2026-11-02", kind: "rest", km: 0 },
    { day: "2026-11-03", kind: "easy", km: 6 },
    { day: "2026-11-04", kind: "rest", km: 0 },
    { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
    { day: "2026-11-06", kind: "rest", km: 0 },
    { day: "2026-11-07", kind: "easy", km: 5 },
    { day: "2026-11-08", kind: "long", km: 14 },
  ]);

describe("the weeks are summarised from the plan, not from a screenshot", () => {
  it("marks the partial first week and computes its 7-day rate", () => {
    const weeks = summariseWeeks(planFrom("novice-5k"));
    const first = weeks[0];
    if (!first) throw new Error("no first week");
    expect(first.sessions).toBe(4);
    expect(first.isPartial).toBe(true);
    expect(first.km).toBe(3.9);
    expect(first.rateKm).toBe(6.8);
  });

  it("has no partial week when the plan begins on a Monday", () => {
    const weeks = summariseWeeks(fullWeekPlan());
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.isPartial).toBe(false);
    expect(weeks[0]?.km).toBe(35);
    expect(weeks[0]?.rateKm).toBe(35);
    expect(weeks[0]?.hardDays).toBe(1);
    expect(weeks[0]?.longRunKm).toBe(14);
  });
});

describe("the explanation says the raw number and the comparable one", () => {
  it("renders the partial-week sentence with both numbers", () => {
    const explanation = renderPlanExplanation(planFrom("novice-5k"), { locale: "en" });
    expect(explanation.sentences.join(" ")).toContain("partial");
    expect(explanation.sentences.join(" ")).toContain("3.9");
    expect(explanation.sentences.join(" ")).toContain("6.8");
  });

  it("does not claim a partial week when there is none", () => {
    const explanation = renderPlanExplanation(fullWeekPlan(), { locale: "en" });
    expect(explanation.sentences.join(" ")).not.toContain("partial");
  });

  it("names the peak week from the data", () => {
    const plan = planFrom("competitive-marathon");
    const explanation = renderPlanExplanation(plan, { locale: "en" });
    const peakKm = Math.max(...explanation.weeks.map((week) => week.km));
    expect(explanation.sentences.join(" ")).toContain(String(peakKm));
  });

  it("speaks both languages and never leaks a number", () => {
    for (const locale of ["en", "zh-Hant"] as const) {
      const explanation = renderPlanExplanation(planFrom("competitive-marathon"), { locale });
      const allowed = new Set(explanation.weeks.flatMap((week) => [week.km, week.rateKm, week.hardDays, week.longRunKm, week.sessions]));
      const literals = new Set(explanation.sentences.flatMap((sentence) => numbersIn(sentence)));
      expect(explanation.text.length).toBeGreaterThan(0);
      if (locale === "zh-Hant") expect(explanation.text).toMatch(/[\u4e00-\u9fff]/);
      else expect(explanation.text).not.toMatch(/[\u4e00-\u9fff]/);
      // Every number either came from the summary (allowed) or is part of the sentence's fixed copy.
      for (const value of numbersIn(explanation.text)) {
        expect(allowed.has(value) || literals.has(value)).toBe(true);
      }
    }
  });

  it("is deterministic", () => {
    const plan = planFrom("trail-ultra");
    const first = renderPlanExplanation(plan, { locale: "zh-Hant" });
    const second = renderPlanExplanation(plan, { locale: "zh-Hant" });
    expect(first.text).toBe(second.text);
  });

  it("keeps the explanation inside four sentences", () => {
    for (const id of ["novice-5k", "competitive-marathon", "masters-40", "three-days-a-week", "returning-after-layoff", "trail-ultra", "two-phase-10k"]) {
      const explanation = renderPlanExplanation(planFrom(id), { locale: "en" });
      expect(explanation.sentences.length).toBeLessThanOrEqual(4);
    }
  });
});
