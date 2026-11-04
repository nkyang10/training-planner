/**
 * Every invariant has a decision that breaks it. This is the file that decides whether checkDecision is a
 * checker or a decoration: an invariant that cannot be shown red is a comment with a boolean in front of it.
 */
import { describe, expect, it } from "vitest";
import { checkDecision, evaluatePolicy } from "../src/index";
import type { PolicyDecision, PolicyInput, PolicyViolation } from "../src/index";
import { knowledge, makeEntry, weekPlan } from "./helpers";

const input: PolicyInput = { entry: makeEntry({ outcome: "completed", legs: 4 }), plan: weekPlan(), today: "2026-11-04", knowledge };
const base = evaluatePolicy(input);
const check = (candidate: PolicyDecision, on: PolicyInput = input): PolicyViolation[] =>
  checkDecision(candidate, on, { knowledge });
const broken = (mutate: (candidate: PolicyDecision) => void): PolicyViolation[] => {
  const copy = structuredClone(base);
  mutate(copy);
  return check(copy);
};

const invariants = (violations: PolicyViolation[]): string[] => violations.map((violation) => violation.invariant);

describe("the checker passes a decision the evaluator produced", () => {
  it("reports nothing", () => {
    expect(check(base)).toEqual([]);
  });

  it("also passes a safety decision", () => {
    const safetyInput: PolicyInput = {
      entry: makeEntry({ outcome: "rest", pain: [{ site: "chest", intensity: 2 }] }),
      plan: weekPlan(),
      today: "2026-11-04",
      knowledge,
    };
    expect(check(evaluatePolicy(safetyInput), safetyInput)).toEqual([]);
  });
});

describe("no-past-edit", () => {
  it("catches an adjustment aimed at today", () => {
    expect(invariants(broken((decision) => {
      if (decision.adjustTomorrow) decision.adjustTomorrow.day = "2026-11-04";
    }))).toContain("no-past-edit");
  });

  it("catches an adjustment aimed at the plan's generation day", () => {
    expect(invariants(broken((decision) => {
      if (decision.adjustTomorrow) decision.adjustTomorrow.day = "2026-11-01";
    }))).toContain("no-past-edit");
  });
});

describe("never-adds-load and safety-subtracts-only", () => {
  it("catches an adjustment that raises the week's load", () => {
    expect(invariants(broken((decision) => {
      if (decision.adjustTomorrow) decision.adjustTomorrow.afterKm = (decision.adjustTomorrow.beforeKm ?? 0) + 1;
    }))).toContain("never-adds-load");
  });

  it("catches a safety adjustment that does not reduce load", () => {
    expect(invariants(broken((decision) => {
      if (decision.adjustTomorrow) {
        decision.adjustTomorrow.isSafety = true;
        decision.adjustTomorrow.afterKm = decision.adjustTomorrow.beforeKm;
      }
    }))).toContain("safety-subtracts-only");
  });

  it("catches an adjustment that does not state its load", () => {
    expect(invariants(broken((decision) => {
      if (decision.adjustTomorrow) delete decision.adjustTomorrow.beforeKm;
    }))).toContain("load-is-stated");
  });
});

describe("facts-anchored", () => {
  it("catches a fact citing an unregistered rule", () => {
    expect(invariants(broken((decision) => {
      const line = decision.commentFacts.acknowledge[0];
      if (line) line.ruleId = "invented-rule";
    }))).toContain("facts-anchored");
  });

  it("catches a fact with the wrong anchor", () => {
    expect(invariants(broken((decision) => {
      const line = decision.commentFacts.acknowledge[0];
      if (line) line.anchor = "made-up.yaml#nothing";
    }))).toContain("facts-anchored");
  });

  it("catches a fact citing a registered rule that did not fire", () => {
    expect(invariants(broken((decision) => {
      const line = decision.commentFacts.acknowledge[0];
      if (line) {
        line.ruleId = "missed-easy-delete";
        line.anchor = "missed-session-rules.yaml#missed-easy-delete";
      }
    }))).toContain("facts-anchored");
  });

  it("catches an applied rule whose tier disagrees with the registry", () => {
    expect(invariants(broken((decision) => {
      const rule = decision.appliedRules.find((candidate) => candidate.ruleId === "readiness-subtracts-only");
      if (rule) rule.tier = "advisory";
    }))).toContain("tier-matches-registry");
  });
});

describe("numbers-grounded", () => {
  it("catches a number the facts did not allow", () => {
    expect(invariants(broken((decision) => {
      const line = decision.commentFacts.interpret[0];
      if (line) line.slots["leaked"] = 99;
    }))).toContain("numbers-grounded");
  });
});

describe("precedence-order", () => {
  it("catches rules recorded out of precedence order", () => {
    const skippedInput: PolicyInput = {
      entry: makeEntry({ outcome: "skipped", outcomeDetail: "work", legs: 4 }),
      plan: weekPlan(),
      today: "2026-11-04",
      knowledge,
      history: { qualityMisses7d: 2 },
    };
    const decision = evaluatePolicy(skippedInput);
    expect(check(decision, skippedInput)).toEqual([]);
    const reversed = structuredClone(decision);
    reversed.appliedRules.reverse();
    expect(invariants(check(reversed, skippedInput))).toContain("precedence-order");
  });
});

describe("the comment contract", () => {
  it("catches more sentences than the contract allows", () => {
    expect(invariants(broken((decision) => {
      const line = decision.commentFacts.acknowledge[0];
      if (line) {
        for (let index = 0; index < 5; index += 1) decision.commentFacts.interpret.push({ ...line });
      }
    }))).toContain("comment-length");
  });

  it("catches silence that still carries sentences", () => {
    expect(invariants(broken((decision) => {
      decision.commentFacts.silence = true;
    }))).toContain("silence-is-silent");
  });

  it("catches a comment on an unlogged day", () => {
    const missedInput: PolicyInput = { entry: makeEntry({ outcome: "missed" }), plan: weekPlan(), today: "2026-11-04", knowledge };
    const decision = evaluatePolicy(missedInput);
    expect(check(decision, missedInput)).toEqual([]);
    decision.commentFacts.silence = false;
    expect(invariants(check(decision, missedInput))).toContain("no-comment-on-unlogged");
  });
});

describe("hard-stop-first", () => {
  const safetyInput: PolicyInput = {
    entry: makeEntry({ outcome: "rest", pain: [{ site: "chest", intensity: 2 }] }),
    plan: weekPlan(),
    today: "2026-11-04",
    knowledge,
  };
  const safety = evaluatePolicy(safetyInput);

  it("catches a hard stop without safetyFirst", () => {
    const copy = structuredClone(safety);
    copy.commentFacts.tone.safetyFirst = false;
    expect(invariants(check(copy, safetyInput))).toContain("hard-stop-first");
  });

  it("catches a hard stop whose first sentence is not the instruction", () => {
    const copy = structuredClone(safety);
    const first = copy.commentFacts.redirect[0];
    if (first) first.template = "redirect.tomorrow-kept";
    expect(invariants(check(copy, safetyInput))).toContain("hard-stop-first");
  });

  it("catches a hard stop that does not suppress coaching", () => {
    const copy = structuredClone(safety);
    if (copy.hardStop) copy.hardStop.suppressCoaching = false;
    expect(invariants(check(copy, safetyInput))).toContain("hard-stop-first");
  });
});

describe("review-anchored", () => {
  it("catches a review flag with the wrong anchor", () => {
    const bigInput: PolicyInput = {
      entry: makeEntry({ outcome: "completed" }),
      plan: weekPlan(),
      today: "2026-11-04",
      knowledge,
      history: { completionRate14d: 0.5 },
    };
    const decision = evaluatePolicy(bigInput);
    expect(check(decision, bigInput)).toEqual([]);
    const copy = structuredClone(decision);
    if (copy.flagReview) copy.flagReview.anchor = "review-triggers.yaml#nothing";
    expect(invariants(check(copy, bigInput))).toContain("review-anchored");
  });
});
