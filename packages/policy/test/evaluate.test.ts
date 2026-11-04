/**
 * One test per rule, in precedence order, and each rule has to be able to fire *and* to stay quiet. A rule
 * that cannot be shown firing is not implemented; a rule that fires on everything is worse than absent.
 */
import { describe, expect, it } from "vitest";
import { checkDecision, evaluatePolicy } from "../src/index";
import type { PolicyDecision, PolicyInput } from "../src/index";
import { knowledge, makeEntry, makePlan, weekPlan } from "./helpers";

const decision = (entry: Partial<PolicyInput["entry"]> = {}, history?: PolicyInput["history"]): PolicyDecision =>
  evaluatePolicy({
    entry: makeEntry(entry),
    plan: weekPlan(),
    today: "2026-11-04",
    knowledge,
    ...(history === undefined ? {} : { history }),
  });

const check = (input: PolicyInput, output: PolicyDecision) => checkDecision(output, input, { knowledge });

describe("safety comes first and stops training", () => {
  it("stops on chest symptoms and refers urgently", () => {
    const output = decision({ day: "2026-11-04", outcome: "rest", pain: [{ site: "chest", intensity: 3 }] });
    expect(output.hardStop?.ruleId).toBe("chest-cardiac");
    expect(output.hardStop?.referral).toBe("urgent");
    expect(output.commentFacts.tone.safetyFirst).toBe(true);
    expect(output.commentFacts.redirect[0]?.template).toBe("redirect.safety-instruction");
    expect(output.adjustTomorrow).toBeUndefined();
  });

  it("stops on below-neck illness and downgrades the quality day inside three days", () => {
    const output = decision({ day: "2026-11-04", outcome: "completed", wellness: { illnessSymptoms: ["below-neck"] } });
    expect(output.hardStop?.ruleId).toBe("fever-or-below-neck-illness");
    expect(output.adjustTomorrow?.day).toBe("2026-11-05");
    expect(output.adjustTomorrow?.isSafety).toBe(true);
    expect(output.adjustTomorrow?.afterKm).toBeLessThan(output.adjustTomorrow?.beforeKm ?? 0);
  });

  it("does not fire the illness stop on a rest day that reports nothing", () => {
    const output = decision({ day: "2026-11-04", outcome: "rest" });
    expect(output.hardStop).toBeUndefined();
  });

  it("stops everything on night pain and refers routinely", () => {
    const output = decision({ pain: [{ site: "shin", intensity: 4, nightPain: true }] });
    expect(output.hardStop?.ruleId).toBe("night-pain-or-bone-tenderness");
    expect(output.hardStop?.referral).toBe("routine-urgent");
  });

  it("stops on escalating pain and constrains the next week", () => {
    const output = decision({ pain: [{ site: "achilles", intensity: 8 }] });
    expect(output.hardStop?.ruleId).toBe("pain-escalation");
    expect(output.adjustTomorrow?.day).toBe("2026-11-05");
    expect(output.adjustTomorrow?.isSafety).toBe(true);
  });

  it("suppresses praise when a safety action fires", () => {
    const output = decision({ outcome: "completed", pain: [{ site: "chest", intensity: 2 }] });
    expect(output.commentFacts.tone.praiseSuppressed).toBe(true);
    expect(output.commentFacts.suppressed).toContain("praise");
  });
});

describe("missed work is gone, never made up", () => {
  it("says nothing on an unlogged day and nudges instead", () => {
    const output = decision({ outcome: "missed" });
    expect(output.commentFacts.silence).toBe(true);
    expect(output.adjustTomorrow).toBeUndefined();
    expect(output.appliedRules.map((rule) => rule.ruleId)).toContain("no-comment-on-unlogged");
    expect(output.commentFacts.nudge?.template).toBe("redirect.nudge-unlogged");
  });

  it("offers a review when the miss streak is long enough to distrust the plan's capacity", () => {
    const output = decision({ outcome: "missed" }, { consecutiveMissDays: 2 });
    expect(output.flagReview?.kind).toBe("capacity-change");
    expect(output.flagReview?.ruleId).toBe("streak-reanchors-volume");
  });

  it("deletes an easy miss instead of rescheduling it", () => {
    const output = decision({ day: "2026-11-03", outcome: "skipped", outcomeDetail: "work" });
    expect(output.adjustTomorrow).toBeUndefined();
    expect(output.appliedRules.map((rule) => rule.ruleId)).toContain("missed-easy-delete");
  });

  it("moves a missed quality session to the nearest legal slot", () => {
    // Saturday is easy and there is no long run, so Saturday is a legal home for Thursday s quality session.
    const plan = makePlan([
      { day: "2026-11-02", kind: "rest", km: 0 },
      { day: "2026-11-03", kind: "easy", km: 6 },
      { day: "2026-11-04", kind: "rest", km: 0 },
      { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
      { day: "2026-11-06", kind: "rest", km: 0 },
      { day: "2026-11-07", kind: "easy", km: 5 },
      { day: "2026-11-08", kind: "rest", km: 0 },
      { day: "2026-11-09", kind: "easy", km: 6 },
    ]);
    const input: PolicyInput = {
      entry: makeEntry({ day: "2026-11-05", outcome: "skipped", outcomeDetail: "work" }),
      plan,
      today: "2026-11-05",
      knowledge,
    };
    const output = evaluatePolicy(input);
    expect(output.adjustTomorrow?.kind).toBe("swap");
    expect(output.adjustTomorrow?.day).toBe("2026-11-07");
    expect(output.adjustTomorrow?.afterKm).toBe(output.adjustTomorrow?.beforeKm);
    expect(check(input, output)).toEqual([]);
  });

  it("drops the quality session when no legal slot exists", () => {
    // The only easy day left is the day before the long run, and a quality session does not sit there.
    const input: PolicyInput = {
      entry: makeEntry({ day: "2026-11-05", outcome: "skipped", outcomeDetail: "work" }),
      plan: weekPlan(),
      today: "2026-11-05",
      knowledge,
    };
    const output = evaluatePolicy(input);
    expect(output.adjustTomorrow).toBeUndefined();
    expect(output.appliedRules.map((rule) => rule.ruleId)).toContain("missed-quality-drop-if-illegal");
  });

  it("counts an alternate as met without adding a session", () => {
    const output = decision({ outcome: "completed", sessionTaken: "alternate" });
    expect(output.adjustTomorrow).toBeUndefined();
    expect(output.commentFacts.acknowledge[0]?.template).toBe("acknowledge.alternate");
    expect(output.appliedRules.map((rule) => rule.ruleId)).toContain("alternate-counts-as-met");
  });

  it("downgrades the next quality day after extra activity inside the guard window", () => {
    const output = decision({ outcome: "completed", sessionTaken: "extra" });
    expect(output.adjustTomorrow?.day).toBe("2026-11-05");
    expect(output.adjustTomorrow?.isSafety).toBe(false);
    expect(output.adjustTomorrow?.afterKm).toBeLessThan(output.adjustTomorrow?.beforeKm ?? 0);
  });
});

describe("the day's own report subtracts, never adds", () => {
  it("downgrades tomorrow's quality day after heavy legs", () => {
    const output = decision({ outcome: "completed", legs: 4 });
    expect(output.adjustTomorrow?.day).toBe("2026-11-05");
    expect(output.adjustTomorrow?.kind).toBe("downgrade");
    expect(output.adjustTomorrow?.afterKm).toBe(28);
    expect(output.adjustTomorrow?.beforeKm).toBe(35);
    expect(output.commentFacts.interpret.some((line) => line.template === "interpret.legs-heavy")).toBe(true);
  });

  it("never upgrades from a good report", () => {
    const output = decision({ outcome: "completed", legs: 1, wellness: { sleepQuality: 5, fatigue: 1, stress: 1 } });
    expect(output.adjustTomorrow).toBeUndefined();
  });

  it("asks the pain question when a heavy report has no pain attached", () => {
    const output = decision({ outcome: "completed", legs: 5 });
    expect(output.openQuestions).toContain("pain-site-and-duration");
    expect(output.appliedRules.map((rule) => rule.ruleId)).toContain("pain-question-trigger");
  });

  it("reports pain without diagnosing it", () => {
    const output = decision({ outcome: "completed", pain: [{ site: "knee", intensity: 3 }] });
    expect(output.commentFacts.interpret.some((line) => line.template === "interpret.pain-reported")).toBe(true);
    expect(output.openQuestions).toContain("pain-trajectory");
    expect(output.hardStop).toBeUndefined();
  });
});

describe("review candidates are offers, not edits", () => {
  it("flags a plan too big for the completion rate", () => {
    const output = decision({ outcome: "completed" }, { completionRate14d: 0.5 });
    expect(output.flagReview?.kind).toBe("plan-too-big");
    expect(output.adjustTomorrow).toBeUndefined();
  });

  it("flags on quality misses alone", () => {
    const output = decision({ outcome: "completed" }, { qualityMisses7d: 2 });
    expect(output.flagReview?.kind).toBe("plan-too-big");
  });

  it("suppresses the prompt when this week's budget is spent", () => {
    const output = decision({ outcome: "completed" }, { completionRate14d: 0.5, promptsThisWeek: 1 });
    expect(output.flagReview).toBeUndefined();
    expect(output.appliedRules.map((rule) => rule.ruleId)).toContain("suppression-and-dwell");
    expect(output.commentFacts.suppressed.some((item) => item.startsWith("review:"))).toBe(true);
  });

  it("suppresses the prompt inside the cooldown after an accepted review", () => {
    const output = decision({ outcome: "completed" }, { completionRate14d: 0.5, daysSinceAcceptedReview: 3 });
    expect(output.flagReview).toBeUndefined();
  });

  it("does not suppress a first prompt", () => {
    const output = decision({ outcome: "completed" }, { completionRate14d: 0.5, promptsThisWeek: 0, daysSinceAcceptedReview: null });
    expect(output.flagReview?.kind).toBe("plan-too-big");
  });
});

describe("the comment is a fact object, not prose", () => {
  it("stays inside the sentence contract", () => {
    const output = decision({ outcome: "completed", legs: 4, wellness: { sleepQuality: 2 } });
    const lines = output.commentFacts.acknowledge.length + output.commentFacts.interpret.length + output.commentFacts.redirect.length;
    expect(lines).toBeLessThanOrEqual(4);
  });

  it("lists every number it lets the narrator print", () => {
    const output = decision({ outcome: "completed", legs: 4 });
    expect(output.commentFacts.allowedNumbers).toContain(4);
    expect(output.commentFacts.allowedNumbers).toContain(5);
  });

  it("is deterministic for the same inputs", () => {
    const first = decision({ outcome: "completed", legs: 4 });
    const second = decision({ outcome: "completed", legs: 4 });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("orders applied rules by precedence", () => {
    const output = decision({ outcome: "skipped", outcomeDetail: "work", legs: 4 }, { qualityMisses7d: 2 });
    const groups = output.appliedRules.map((rule) => rule.ruleId);
    expect(groups.length).toBeGreaterThan(1);
    const output2 = checkDecision(output, { entry: makeEntry({ outcome: "skipped", outcomeDetail: "work", legs: 4 }), plan: weekPlan(), today: "2026-11-04", knowledge }, { knowledge });
    expect(output2).toEqual([]);
  });
});
