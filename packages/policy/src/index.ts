/**
 * The policy package's public surface: one pure evaluator, one invariant checker, and the registry that makes
 * every decision explainable. The narrator is a different package on purpose - this one is allowed to decide
 * nothing about words, and that one is allowed to decide nothing about numbers.
 */
export { evaluatePolicy } from "./evaluate";
export { checkDecision, allowedNumbersOf, extractNumbers } from "./check";
export type { CheckOptions } from "./check";
export { RULES, NOT_IMPLEMENTED, PRECEDENCE, ruleOf, precedenceOf } from "./rules";
export type { RuleSpec, RuleGroup, RuleTier, RuleAction } from "./rules";
export { dailyCostOf } from "./daily-cost";
export type { DailyCost, DailyCostInput, DailyCostKey } from "./daily-cost";
export * from "./types";
export { FACT_TEMPLATES, ADJUST_REASON_KEYS, ADJUST_COST_KEYS, STOP_INSTRUCTION_KEYS, TEMPLATE_LIST_IS_COMPLETE } from "./templates";
