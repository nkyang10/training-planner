/**
 * The trigger layer's frozen interface.
 *
 * This is where `review-triggers.yaml`'s `when` clauses become code: signals in, review candidates out. It does not
 * open reviews and it does not suppress them - `packages/review` owns the budget, dwell and cooldown, and it is the
 * only place that can refuse to open one. Two layers deciding the same thing is how a product ends up with a review
 * that opens twice.
 */
import type { Review, ReviewEvidence, SignalKey } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import type { Presentation, ReviewCandidate } from "@training-planner/review";
import type { SignalOutput } from "@training-planner/signals";

export interface TriggerContext {
  userId: string;
  today: string;
  signals: SignalOutput;
  knowledge: KnowledgeBundle;
  /** The runner asked for a review. Manual is always allowed and wins a tie. */
  manual?: { kind: string; intent?: string } | undefined;
}

export interface TriggerFired {
  ruleId: string;
  anchor: string;
  presentation: Presentation;
  evidence: ReviewEvidence;
  /** The sentence a review's evidence section can quote, built from the signal values, not from prose. */
  detail: string;
}

export interface UnevaluableTrigger {
  ruleId: string;
  anchor: string;
  /** The signal whose absence blocks the rule, or null when the input is not a signal at all. */
  missing: SignalKey | null;
  reason: string;
}

export interface TriggerOutput {
  fired: TriggerFired[];
  /** The one candidate a caller should hand to `openReview`, chosen by arbitration. */
  candidate: ReviewCandidate | undefined;
  /** Corpus rules this build cannot run, with the reason. Never silently skipped. */
  unevaluable: UnevaluableTrigger[];
}

/** Prior reviews and prompt counts are inputs to the caller's `openReview`, not to this layer. */
export type TriggerHistory = readonly Review[];
