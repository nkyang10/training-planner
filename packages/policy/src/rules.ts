/**
 * The rule registry: one row per rule this evaluator implements, with the knowledge anchor that owns its
 * numbers and tier.
 *
 * Two vocabularies are kept apart on purpose (docs/engineering/contract-vocabulary.md): a **tier** is a noun
 * (`advisory | constraint | hard-stop`, how overrideable the rule is) and an **action** is a verb
 * (`hard_stop | constrain | advise | inform | suppress`, what the evaluator emits). A row that conflated
 * them would make "constraint" mean both "you may not ignore this" and "this is what we did", and the two
 * are read by different parts of the product.
 *
 * A rule that is in the corpus but not here is listed in `NOT_IMPLEMENTED` with the input it is missing.
 * Silence about a missing rule is how a rule quietly stops existing.
 */
export type RuleGroup = "safety" | "missed" | "daily" | "load" | "review";
export type RuleTier = "advisory" | "constraint" | "hard-stop";
export type RuleAction = "hard_stop" | "constrain" | "advise" | "inform" | "suppress";

export interface RuleSpec {
  id: string;
  /** `file.yaml#rule-or-knob-id`; the anchor is what makes a decision explainable months later. */
  anchor: string;
  tier: RuleTier;
  action: RuleAction;
  group: RuleGroup;
}

/** Precedence, from docs/engine/feedback-loop.md §3: safety first, review last. */
export const PRECEDENCE: RuleGroup[] = ["safety", "missed", "daily", "load", "review"];

const spec = (id: string, anchor: string, tier: RuleTier, action: RuleAction, group: RuleGroup): RuleSpec => ({
  id,
  anchor,
  tier,
  action,
  group,
});

export const RULES: Record<string, RuleSpec> = {
  // Safety. These run before any planning logic and may stop training; nothing later in the order may undo them.
  "chest-cardiac": spec("chest-cardiac", "safety-hard-stops.yaml#chest-cardiac", "hard-stop", "hard_stop", "safety"),
  "fever-or-below-neck-illness": spec(
    "fever-or-below-neck-illness",
    "safety-hard-stops.yaml#fever-or-below-neck-illness",
    "hard-stop",
    "hard_stop",
    "safety",
  ),
  "night-pain-or-bone-tenderness": spec(
    "night-pain-or-bone-tenderness",
    "safety-hard-stops.yaml#night-pain-or-bone-tenderness",
    "hard-stop",
    "hard_stop",
    "safety",
  ),
  "pain-escalation": spec("pain-escalation", "safety-hard-stops.yaml#pain-escalation", "hard-stop", "hard_stop", "safety"),
  "readiness-subtracts-only": spec(
    "readiness-subtracts-only",
    "readiness.yaml#readiness-subtracts-only",
    "hard-stop",
    "constrain",
    "daily",
  ),
  "safety-text-first": spec("safety-text-first", "daily-feedback-rules.yaml#safety-text-first", "constraint", "constrain", "safety"),
  // A knob, not a rule, but a decision cites it: the size of a downgrade is knowledge, and a downgrade whose
  // size is invented in code is a threshold nobody can tune.
  "wellness-downgrade-magnitude": spec(
    "wellness-downgrade-magnitude",
    "wellness.yaml#downgrade_magnitude_pct",
    "constraint",
    "constrain",
    "daily",
  ),

  // Missed work. The governing rule is that missed work is gone: the plan adapts around it and never makes it up.
  "never-make-up": spec("never-make-up", "missed-session-rules.yaml#never-make-up", "constraint", "constrain", "missed"),
  "missed-easy-delete": spec("missed-easy-delete", "missed-session-rules.yaml#missed-easy-delete", "advisory", "advise", "missed"),
  "missed-quality-swap-if-legal": spec(
    "missed-quality-swap-if-legal",
    "missed-session-rules.yaml#missed-quality-swap-if-legal",
    "advisory",
    "advise",
    "missed",
  ),
  "missed-quality-drop-if-illegal": spec(
    "missed-quality-drop-if-illegal",
    "missed-session-rules.yaml#missed-quality-drop-if-illegal",
    "advisory",
    "advise",
    "missed",
  ),
  "alternate-counts-as-met": spec(
    "alternate-counts-as-met",
    "missed-session-rules.yaml#alternate-counts-as-met",
    "advisory",
    "inform",
    "missed",
  ),
  "extra-activity-subtracts": spec(
    "extra-activity-subtracts",
    "missed-session-rules.yaml#extra-activity-subtracts",
    "advisory",
    "advise",
    "missed",
  ),
  "streak-reanchors-volume": spec(
    "streak-reanchors-volume",
    "missed-session-rules.yaml#streak-reanchors-volume",
    "advisory",
    "advise",
    "missed",
  ),
  "unlogged-is-not-zero": spec(
    "unlogged-is-not-zero",
    "missed-session-rules.yaml#unlogged-is-not-zero",
    "constraint",
    "inform",
    "missed",
  ),

  // Daily feedback. The comment contract and the questions the entry raises.
  "no-comment-on-unlogged": spec(
    "no-comment-on-unlogged",
    "daily-feedback-rules.yaml#no-comment-on-unlogged",
    "constraint",
    "suppress",
    "daily",
  ),
  "comment-numbers-are-facts": spec(
    "comment-numbers-are-facts",
    "daily-feedback-rules.yaml#comment-numbers-are-facts",
    "constraint",
    "constrain",
    "daily",
  ),
  // The sentence a runner reads exists because the comment contract fired. A sentence with no rule to cite
  // would make "every comment traces to a rule id" false on the most common day in the product.
  "comment-contract": spec("comment-contract", "daily-feedback-rules.yaml#comment-contract", "constraint", "inform", "daily"),
  "pain-question-trigger": spec(
    "pain-question-trigger",
    "daily-feedback-rules.yaml#pain-question-trigger",
    "advisory",
    "advise",
    "daily",
  ),

  // Review triggers. They raise candidates; they never edit the plan.
  "plan-too-big": spec("plan-too-big", "review-triggers.yaml#plan-too-big", "advisory", "advise", "review"),
  "load-rising-too-fast": spec(
    "load-rising-too-fast",
    "review-triggers.yaml#load-rising-too-fast",
    "advisory",
    "advise",
    "review",
  ),
  "response-not-landing": spec(
    "response-not-landing",
    "review-triggers.yaml#response-not-landing",
    "advisory",
    "advise",
    "review",
  ),
  "suppression-and-dwell": spec(
    "suppression-and-dwell",
    "review-triggers.yaml#suppression-and-dwell",
    "constraint",
    "suppress",
    "review",
  ),
};

/**
 * Rules that exist in the corpus and are deliberately not implemented here, with the reason. An
 * unimplemented rule is a fact about this slice, and the phase that owns it should be able to see it.
 */
export const NOT_IMPLEMENTED: Record<string, string> = {
  "intent-rest-is-plan-evidence":
    "needs profile.intent.restRegistered, which the athlete-profile contract does not have yet; the day entry has `intent`, which is a different question",
  "motivation-miss-shrinks-friction":
    "needs the 14-day miss window and the runner's preferred slot, neither of which is in PolicyInput yet",
  "reds-flag-pattern": "needs a 21-day performance window and an energy-availability screen the entry does not collect",
  "overreach-pattern": "needs load monotony and a 7-day performance decrement series; the first slice reads a single day",
  "rejected-review-is-data": "belongs to the review lifecycle, not the daily evaluator",
  "manual-always-allowed": "belongs to the review lifecycle, not the daily evaluator",
};

export function ruleOf(ruleId: string): RuleSpec {
  const found = RULES[ruleId];
  if (!found) throw new Error(`policy rule not registered: ${ruleId}`);
  return found;
}

/** Numeric order of a rule's group in the precedence list; lower runs first. */
export function precedenceOf(ruleId: string): number {
  return PRECEDENCE.indexOf(ruleOf(ruleId).group);
}
