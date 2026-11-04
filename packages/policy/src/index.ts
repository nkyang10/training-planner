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
export * from "./types";
