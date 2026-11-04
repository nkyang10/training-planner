/**
 * The wizard's rules: answers are validated against their step, revisions append, and the original survives a change.
 *
 * These are the assertions the "original versus current" view depends on. If `originalWizardAnswers` ever returned the
 * latest answer, the console would quietly rewrite what the runner first chose - the exact thing ADR-0009 records
 * answers to avoid.
 */
import { describe, expect, it } from "vitest";
import {
  GOAL_TYPES,
  RISK_APPETITES,
  latestWizardAnswers,
  nextWizardRevision,
  nextWizardStep,
  originalWizardAnswers,
  validateWizardAnswer,
  wizardProgress,
  WIZARD_STEPS,
} from "../src/wizard";
import type { WizardAnswerRecord } from "../src/wizard";

const answer = (stepId: WizardAnswerRecord["stepId"], value: Record<string, unknown>, revision = 1): WizardAnswerRecord => ({
  stepId,
  answer: value,
  revision,
  source: revision === 1 ? "wizard" : "settings",
});

describe("an answer is validated against its step, never coerced", () => {
  it("accepts the step's own options and refuses others", () => {
    expect(validateWizardAnswer("goal", { value: "finish" }).ok).toBe(true);
    expect(validateWizardAnswer("goal", { value: "win-the-olympics" }).ok).toBe(false);
    expect(validateWizardAnswer("risk-appetite", { value: "moderate" }).ok).toBe(true);
    expect(validateWizardAnswer("risk-appetite", { value: "reckless" }).ok).toBe(false);
  });

  it("refuses an unknown step", () => {
    const verdict = validateWizardAnswer("favourite-colour", { value: "blue" });
    expect(verdict.ok).toBe(false);
    expect(verdict.detail).toContain("not a wizard step");
  });

  it("needs at least one day, and only real days, for availability", () => {
    expect(validateWizardAnswer("availability", { values: [] }).ok).toBe(false);
    expect(validateWizardAnswer("availability", { values: ["Tue", "Someday"] }).ok).toBe(false);
    const verdict = validateWizardAnswer("availability", { values: ["Tue", "Tue", "Thu"] });
    expect(verdict.ok).toBe(true);
    expect(verdict.answer).toEqual({ values: ["Tue", "Thu"] });
  });

  it("bounds the weekly hours", () => {
    expect(validateWizardAnswer("weekly-hours", { value: 5 }).ok).toBe(true);
    expect(validateWizardAnswer("weekly-hours", { value: 100 }).ok).toBe(false);
    expect(validateWizardAnswer("weekly-hours", { value: "five" }).ok).toBe(false);
  });
});

describe("the record keeps the original next to the current answer", () => {
  const answers = [answer("goal", { value: "finish" }), answer("goal", { value: "time" }, 2), answer("availability", { values: ["Tue", "Sat"] })];

  it("latest answers are the newest revision per step", () => {
    expect(latestWizardAnswers(answers)).toEqual({ goal: { value: "time" }, availability: { values: ["Tue", "Sat"] } });
  });

  it("original answers are the first revision per step, even after a change", () => {
    expect(originalWizardAnswers(answers)).toEqual({ goal: { value: "finish" }, availability: { values: ["Tue", "Sat"] } });
  });

  it("the next revision follows the highest one, and starts at one", () => {
    expect(nextWizardRevision(answers, "goal")).toBe(3);
    expect(nextWizardRevision(answers, "risk-appetite")).toBe(1);
  });
});

describe("progress walks the steps in order", () => {
  it("asks the first required unanswered step", () => {
    expect(nextWizardStep([])).toBe("goal");
    expect(nextWizardStep([answer("goal", { value: "finish" })])).toBe("availability");
    expect(
      nextWizardStep([
        answer("goal", { value: "finish" }),
        answer("availability", { values: ["Tue"] }),
        answer("risk-appetite", { value: "moderate" }),
      ]),
    ).toBe(null);
  });

  it("counts optional answers in progress but not as a reason to keep going", () => {
    const answers = [answer("weekly-hours", { value: 5 })];
    expect(wizardProgress(answers)).toEqual({ answered: 1, total: WIZARD_STEPS.length, next: "goal" });
  });

  it("the step list is the contract the API serves, so its ids are stable", () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual(["goal", "availability", "risk-appetite", "weekly-hours"]);
    expect(GOAL_TYPES).toContain("return-to-running");
    expect(RISK_APPETITES).toHaveLength(3);
  });
});
