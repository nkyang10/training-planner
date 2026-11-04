/**
 * The policy evaluator's frozen interface.
 *
 * One entry goes in, one decision comes out. The decision is not prose: it is a set of typed actions plus a
 * structured fact object, and the narrator's only job is to turn the fact object into sentences. That split
 * is AGENTS rule 2 made structural - a number in the comment can only come from `allowedNumbers`, because
 * the narrator receives no other numbers.
 */
import type { DayEntry, PlanVersion } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";

/**
 * History the evaluator may use, supplied by the caller so the evaluator stays pure: no clock, no
 * database, no "recent" that means something different every time it is called. Every field is optional
 * and absent means "not known yet", never zero - a window that has not filled must not act like a window
 * that filled with a bad number (noise.yaml#min_consecutive_observations).
 */
export interface PolicyHistory {
  /** Consecutive days with no entry, ending yesterday. `missed` days count; unlogged days count. */
  consecutiveMissDays?: number;
  /** Quality sessions skipped in the last 7 days. */
  qualityMisses7d?: number;
  /** Weighted completion rate over the last 14 days, 0..1. */
  completionRate14d?: number;
  /** Misses (skipped + partial) in the last 14 days. */
  misses14d?: number;
  /** Review invitations already sent this ISO week. */
  promptsThisWeek?: number;
  /** Days since the last accepted review, or null when there has never been one. */
  daysSinceAcceptedReview?: number | null;
  /** Days since each review trigger last fired, keyed by trigger kind; absent means never. */
  daysSinceTrigger?: Record<string, number | null>;
}

export interface PolicyInput {
  /** The runner's entry for today. Immutable by contract; the evaluator never mutates it. */
  entry: DayEntry;
  /** The plan version today belongs to. The evaluator reads it, never rewrites it. */
  plan: PlanVersion;
  /** Today as a civil day, injected. The evaluator never reads a clock. */
  today: string;
  knowledge: KnowledgeBundle;
  history?: PolicyHistory;
}

/** Template ids, not sentences. The narrator owns the words; this owns the facts. */
export type FactTemplate =
  | "acknowledge.completed"
  | "acknowledge.partial"
  | "acknowledge.alternate"
  | "acknowledge.rest"
  | "acknowledge.skipped"
  | "interpret.effort-gap"
  | "interpret.legs-heavy"
  | "interpret.sleep-short"
  | "interpret.illness"
  | "interpret.missed-not-zero"
  | "interpret.extra-subtracts"
  | "interpret.pain-reported"
  | "redirect.tomorrow-kept"
  | "redirect.tomorrow-downgraded"
  | "redirect.tomorrow-rest"
  | "redirect.tomorrow-swapped"
  | "redirect.safety-instruction"
  | "redirect.review-offered"
  | "redirect.nudge-unlogged";

export interface FactLine {
  template: FactTemplate;
  /** Slot values the narrator may fill. A numeric slot is also listed in `allowedNumbers`. */
  slots: Record<string, string | number>;
  ruleId: string;
  anchor: string;
}

/**
 * The structured fact object. Every number the narrator is allowed to print is in `allowedNumbers`, and
 * nothing else is: the guardrail check (daily-feedback-rules.yaml#comment-numbers-are-facts) becomes a
 * comparison rather than a promise.
 */
export interface CommentFacts {
  day: string;
  outcome: DayEntry["outcome"];
  acknowledge: FactLine[];
  interpret: FactLine[];
  redirect: FactLine[];
  allowedNumbers: number[];
  tone: {
    register: "coach-to-runner";
    /** True when a safety action fired: sentence one is the instruction, praise is suppressed. */
    safetyFirst: boolean;
    praiseSuppressed: boolean;
  };
  /**
   * A nudge is not a comment: it goes to the inbox when the day was not logged, and it exists even when
   * `silence` is true. Keeping it in `redirect` would have made "silence" mean two different things.
   */
  nudge?: FactLine;
  /** True means the narrator prints nothing at all. Silence is a valid outcome, not a failure. */
  silence: boolean;
  /** Why content was suppressed, so the decision is explainable months later. */
  suppressed: string[];
}

export type AdjustKind = "keep" | "downgrade" | "insert-rest" | "shorten" | "swap" | "shift" | "reduce-dose";

export interface MicroAdjustment {
  /** The future day that changes. Never today, never a past day, never at or before the plan's generation day. */
  day: string;
  kind: AdjustKind;
  beforeSummary: string;
  afterSummary: string;
  /** Why, in the runner's language; the rule id and anchor carry the audit trail. */
  reason: string;
  ruleId: string;
  anchor: string;
  /** What the runner gives up. A change with no stated cost is not consent (review-trigger-policy.md). */
  expectedCost: string;
  isSafety: boolean;
  /** Load before and after, so "subtracts only" is a comparison rather than an adjective. */
  beforeKm?: number;
  afterKm?: number;
}

export type ReviewKind =
  | "plan-too-big"
  | "load-shape"
  | "overreach-check"
  | "goal-conversation"
  | "capacity-change"
  | "re-test"
  | "pain-pattern"
  | "readiness-refer";

export interface ReviewFlag {
  kind: ReviewKind;
  ruleId: string;
  anchor: string;
  why: string;
  proposals: string[];
}

export interface HardStop {
  ruleId: string;
  anchor: string;
  /** What the stop covers, e.g. "today", "all-future-sessions-in-phase". */
  scope: string;
  /** The one sentence the comment must open with (daily-feedback-rules.yaml#safety-text-first). */
  instruction: string;
  referral: "urgent" | "routine-urgent" | "clinician-with-sports-medicine" | null;
  suppressCoaching: boolean;
}

export interface AppliedPolicyRule {
  ruleId: string;
  anchor: string;
  tier: "advisory" | "constraint" | "hard-stop";
  effect: "informed" | "dosed" | "suppressed";
  note?: string;
}

export interface PolicyDecision {
  commentFacts: CommentFacts;
  /** At most one. The brief's `adjustTomorrow?`. */
  adjustTomorrow?: MicroAdjustment;
  /** At most one. The brief's `flagReview?`. */
  flagReview?: ReviewFlag;
  hardStop?: HardStop;
  /** In precedence order: safety, missed, daily, load, review. */
  appliedRules: AppliedPolicyRule[];
  /** Questions the entry raised but could not answer, for the next screen rather than for the comment. */
  openQuestions: string[];
}

export interface PolicyViolation {
  invariant: string;
  detail: string;
}
