/**
 * The evaluator's invariants, kept outside the evaluator for the same reason the planner's are kept outside
 * the planner: a check written by the code it checks agrees with it by construction.
 *
 * Every invariant here has a deliberately broken decision in test/check.test.ts. A green invariant with no
 * red case is a comment with a boolean in front of it.
 */
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { PRECEDENCE, ruleOf } from "./rules";
import type { PolicyDecision, PolicyInput, PolicyViolation } from "./types";

export interface CheckOptions {
  knowledge: KnowledgeBundle;
}

/** Numbers a narrator is allowed to print: the fact object's list, sorted, unique. */
export function allowedNumbersOf(decision: PolicyDecision): number[] {
  return [...new Set(decision.commentFacts.allowedNumbers)].sort((a, b) => a - b);
}

/** Every number that appears in a string, as integers or decimals. The narrator guardrail compares this to allowedNumbers. */
export function extractNumbers(text: string): number[] {
  const found = text.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.map((value) => Number(value)))].sort((a, b) => a - b);
}

export function checkDecision(decision: PolicyDecision, input: PolicyInput, options: CheckOptions): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const facts = decision.commentFacts;
  const adjust = decision.adjustTomorrow;
  const maxSentences = (() => {
    const value = options.knowledge.knob("daily-feedback-rules.yaml#comment-contract").value;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return 4;
    const candidate = (value as Record<string, unknown>)["max_sentences"];
    return typeof candidate === "number" ? candidate : 4;
  })();

  // 1. Never change the past (AGENTS rule 4). A change may not land today, yesterday, or before the plan existed.
  if (adjust !== undefined) {
    if (adjust.day <= input.today) {
      violations.push({ invariant: "no-past-edit", detail: `adjustment targets ${adjust.day}, at or before today ${input.today}` });
    }
    if (adjust.day <= input.plan.generatedAtDay) {
      violations.push({
        invariant: "no-past-edit",
        detail: `adjustment targets ${adjust.day}, at or before the plan's generation day ${input.plan.generatedAtDay}`,
      });
    }
    // 2. A micro-adjustment never adds load: missed work is gone, and readiness only subtracts.
    if (adjust.beforeKm === undefined || adjust.afterKm === undefined) {
      violations.push({ invariant: "load-is-stated", detail: `${adjust.ruleId} did not state before/after weekly km` });
    } else if (adjust.afterKm > adjust.beforeKm) {
      violations.push({
        invariant: "never-adds-load",
        detail: `${adjust.kind} takes the week from ${adjust.beforeKm} km to ${adjust.afterKm} km`,
      });
    } else if (adjust.isSafety && adjust.afterKm >= adjust.beforeKm) {
      violations.push({
        invariant: "safety-subtracts-only",
        detail: `safety adjustment ${adjust.ruleId} did not reduce load (${adjust.beforeKm} -> ${adjust.afterKm})`,
      });
    }
  }

  // 3. Every sentence traces to a registered rule and anchor, and that rule appears in appliedRules[].
  const appliedIds = new Set(decision.appliedRules.map((rule) => rule.ruleId));
  for (const line of [...facts.acknowledge, ...facts.interpret, ...facts.redirect]) {
    let anchor: string | null = null;
    try {
      anchor = ruleOf(line.ruleId).anchor;
    } catch {
      violations.push({ invariant: "facts-anchored", detail: `fact ${line.template} cites unregistered rule ${line.ruleId}` });
      continue;
    }
    if (line.anchor !== anchor) {
      violations.push({ invariant: "facts-anchored", detail: `fact ${line.template} anchor ${line.anchor} is not ${anchor}` });
    }
    if (!appliedIds.has(line.ruleId)) {
      violations.push({ invariant: "facts-anchored", detail: `fact ${line.template} cites ${line.ruleId}, which is not in appliedRules` });
    }
  }
  for (const rule of decision.appliedRules) {
    try {
      const spec = ruleOf(rule.ruleId);
      if (rule.anchor !== spec.anchor) {
        violations.push({ invariant: "facts-anchored", detail: `applied rule ${rule.ruleId} anchor ${rule.anchor} is not ${spec.anchor}` });
      }
      if (rule.tier !== spec.tier) {
        violations.push({ invariant: "tier-matches-registry", detail: `${rule.ruleId} claims tier ${rule.tier}, registry says ${spec.tier}` });
      }
    } catch {
      violations.push({ invariant: "facts-anchored", detail: `applied rule ${rule.ruleId} is not registered` });
    }
  }
  if (decision.flagReview !== undefined) {
    const flag = decision.flagReview;
    let anchor: string | null = null;
    try {
      anchor = ruleOf(flag.ruleId).anchor;
    } catch {
      violations.push({ invariant: "review-anchored", detail: `review flag cites unregistered rule ${flag.ruleId}` });
    }
    if (anchor !== null && flag.anchor !== anchor) {
      violations.push({ invariant: "review-anchored", detail: `review flag anchor ${flag.anchor} is not ${anchor}` });
    }
    if (!appliedIds.has(flag.ruleId)) {
      violations.push({ invariant: "review-anchored", detail: `review flag cites ${flag.ruleId}, which is not in appliedRules` });
    }
  }

  if (facts.nudge !== undefined) {
    const nudge = facts.nudge;
    try {
      if (nudge.anchor !== ruleOf(nudge.ruleId).anchor) {
        violations.push({ invariant: "facts-anchored", detail: `nudge anchor ${nudge.anchor} is not ${ruleOf(nudge.ruleId).anchor}` });
      }
      if (!appliedIds.has(nudge.ruleId)) {
        violations.push({ invariant: "facts-anchored", detail: `nudge cites ${nudge.ruleId}, which is not in appliedRules` });
      }
    } catch {
      violations.push({ invariant: "facts-anchored", detail: `nudge cites unregistered rule ${nudge.ruleId}` });
    }
    for (const value of Object.values(nudge.slots)) {
      if (typeof value === "number" && !new Set(facts.allowedNumbers).has(value)) {
        violations.push({ invariant: "numbers-grounded", detail: `nudge prints ${value}, which is not in allowedNumbers` });
      }
    }
  }

  // 4. A number in the comment can only be a number the facts allowed (daily-feedback-rules.yaml#comment-numbers-are-facts).
  const allowed = new Set(facts.allowedNumbers);
  for (const line of [...facts.acknowledge, ...facts.interpret, ...facts.redirect]) {
    for (const value of Object.values(line.slots)) {
      if (typeof value === "number" && !allowed.has(value)) {
        violations.push({ invariant: "numbers-grounded", detail: `fact ${line.template} prints ${value}, which is not in allowedNumbers` });
      }
    }
  }

  // 5. Rules are applied in precedence order, so the audit trail reads the way the engine ran.
  let previous = -1;
  for (const rule of decision.appliedRules) {
    try {
      const index = PRECEDENCE.indexOf(ruleOf(rule.ruleId).group);
      if (index < previous) {
        violations.push({ invariant: "precedence-order", detail: `${rule.ruleId} appears after a lower-precedence rule` });
      }
      previous = Math.max(previous, index);
    } catch {
      // reported above
    }
  }

  // 6. The comment contract: at most max_sentences sentences, and silence means silence.
  const lineCount = facts.acknowledge.length + facts.interpret.length + facts.redirect.length;
  if (lineCount > maxSentences) {
    violations.push({ invariant: "comment-length", detail: `${lineCount} fact lines exceeds the ${maxSentences}-sentence contract` });
  }
  if (facts.silence && lineCount > 0) {
    violations.push({ invariant: "silence-is-silent", detail: `silence is true but ${lineCount} fact lines are present` });
  }
  if (facts.outcome === "missed" && !facts.silence) {
    violations.push({ invariant: "no-comment-on-unlogged", detail: "a missed day produced a comment" });
  }

  // 7. A hard stop is first, non-overridable, and suppresses coaching (daily-feedback-rules.yaml#safety-text-first).
  if (decision.hardStop !== undefined) {
    const stop = decision.hardStop;
    if (!facts.tone.safetyFirst) violations.push({ invariant: "hard-stop-first", detail: "hard stop did not set safetyFirst" });
    if (!stop.suppressCoaching) violations.push({ invariant: "hard-stop-first", detail: "hard stop did not suppress coaching" });
    const first = facts.redirect[0];
    if (first === undefined || first.template !== "redirect.safety-instruction") {
      violations.push({ invariant: "hard-stop-first", detail: "the first redirect sentence is not the safety instruction" });
    }
    try {
      if (ruleOf(stop.ruleId).tier !== "hard-stop") {
        violations.push({ invariant: "hard-stop-first", detail: `${stop.ruleId} is not a hard-stop tier rule` });
      }
    } catch {
      violations.push({ invariant: "hard-stop-first", detail: `hard stop cites unregistered rule ${stop.ruleId}` });
    }
  }

  return violations;
}
