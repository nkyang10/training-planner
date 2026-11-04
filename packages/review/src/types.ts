/**
 * The review lifecycle's frozen interface.
 *
 * A review is expensive in attention, so the discipline is the product: a review opens only when it is allowed
 * to (budget, dwell, cooldown), it always offers "keep the plan", it never offers one option or a change with
 * no cost, and it never touches today or tomorrow. Those are the rules this package exists to hold.
 */
import type { Review, ReviewEvidence, ReviewOption } from "@training-planner/domain";

/** How hard a candidate would interrupt the runner (review-trigger-policy.md §1.2). */
export type Presentation = "interrupt-now" | "offer-at-next-open" | "weekly-summary" | "recorded";

export interface ReviewCandidate {
  /** The trigger family, or `manual` when the runner asked. */
  kind: string;
  /** The rule that raised it, with its knowledge anchor; null for a manual review. */
  ruleId: string | null;
  anchor: string | null;
  evidence: ReviewEvidence;
  presentation: Presentation;
}

export interface OpenReviewInput {
  userId: string;
  /** Today as a civil day, injected. */
  today: string;
  candidate: ReviewCandidate;
  knowledge: import("@training-planner/knowledge").KnowledgeBundle;
  /** Days of future visible to the review; defaults to review-triggers.yaml#horizon_days. */
  horizonDays?: number;
  /** Days before tomorrow with no changes; defaults to review-triggers.yaml#freeze_window_days. */
  freezeDays?: number;
  promptsThisWeek?: number;
  daysSinceAcceptedReview?: number | null;
  daysSinceTrigger?: Record<string, number | null>;
  /**
   * The candidate options. A review is never stored without them: the wire contract requires at least two, and
   * "present a single option" is on the list of things a review must never do.
   */
  options: ProposedOption[];
  /** Renders an option cost for the wire; injected so this package never composes prose. */
  renderCost: (option: ProposedOption) => string;
}

export type SuppressionReason = "budget" | "cooldown" | "dwell";

export type OpenReviewResult =
  | { status: "opened"; review: Review }
  | { status: "suppressed"; reason: SuppressionReason; ruleId: "suppression-and-dwell"; detail: string }
  | { status: "refused"; code: AssembleRejectCode; detail: string };

/**
 * An option before it becomes wire data. The cost is a message key plus slots, not a sentence: the narrator
 * owns the words (AGENTS rule 2), and this package is injected with a renderer when it assembles the review.
 */
export interface ProposedOption {
  optionId: string;
  labelKey: string;
  keepAsIs: boolean;
  /** ADR-0010: absent means edit. A replan carries a staged plan version instead of a diff. */
  kind?: "edit" | "replan";
  planVersionId?: string | null;
  changeSummary?: import("@training-planner/domain").ReviewOptionChangeSummary | null;
  /** Null only for "keep the plan": an option with no diff proposes no change, which is the point of it. */
  diffId: string | null;
  costKey: string;
  costSlots: Record<string, string | number>;
  /** Percentage change to weekly load; required when the review is safety-critical (reductions only). */
  loadDeltaPct?: number;
}

export interface AssembleOptionsInput {
  review: Review;
  options: ProposedOption[];
  today: string;
  knowledge: import("@training-planner/knowledge").KnowledgeBundle;
  /** Renders an option's cost for the wire. Injected so the lifecycle never composes prose. */
  renderCost: (option: ProposedOption) => string;
}

export type AssembleResult =
  | { status: "assembled"; review: Review }
  | { status: "refused"; code: AssembleRejectCode; detail: string };

export type AssembleRejectCode =
  | "not-open"
  | "keep-as-is-must-be-first"
  | "keep-as-is-must-exist-once"
  | "too-few-options"
  | "too-many-options"
  | "missing-diff"
  | "missing-cost"
  | "adds-load-under-safety"
  | "missing-plan-version"
  | "missing-change-summary"
  | "replan-with-diff";

export type Decision =
  | { kind: "accept"; optionId: string }
  | { kind: "decline"; reason?: string }
  | { kind: "defer"; untilDay: string };

export type DecisionRejectCode = "not-open" | "expired" | "unknown-option" | "defer-in-the-past";

export type DecisionResult =
  | {
      status: "accepted";
      review: Review;
      option: ReviewOption;
      /** The first day the new version may change: never today, never tomorrow. */
      applyFromDay: string;
      /** Null when the runner kept the plan: keeping is a decision, not a diff. */
      resultDiffId: string | null;
    }
  | { status: "rejected"; review: Review; reason: string | null }
  | { status: "deferred"; review: Review; recheckDay: string }
  | { status: "refused"; code: DecisionRejectCode; detail: string };
