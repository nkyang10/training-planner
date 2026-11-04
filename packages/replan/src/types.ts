/**
 * The re-planning engine's frozen interface.
 *
 * A review is only worth opening if it can offer a way out. This package takes the plan and a fired trigger and
 * proposes **bounded** candidate changes - each one exactly one diff, each one after the freeze window, each one
 * checked against the planner's invariants before it is offered - plus the "keep the plan" option that must always
 * exist.
 *
 * It does not store anything and it does not decide: `packages/review` opens and the runner chooses.
 */
import type { PlanDiff, PlanVersion } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import type { ReviewCandidate } from "@training-planner/review";

export interface ReplanRequest {
  plan: PlanVersion;
  /** The runner's local day, injected. */
  today: string;
  candidate: ReviewCandidate;
  knowledge: KnowledgeBundle;
  /** Days of future the review may touch; defaults to review-triggers.yaml#horizon_days. */
  horizonDays?: number;
}

export interface ProposedPlan {
  optionId: string;
  /** ADR-0010: absent means edit. A replan carries a staged plan version and its honest size instead of a diff. */
  kind?: "edit" | "replan";
  planVersionId?: string | null;
  changeSummary?: import("@training-planner/domain").ReviewOptionChangeSummary | null;
  /** A message key, never a sentence: the narrator owns the words. */
  labelKey: string;
  keepAsIs: boolean;
  /** The prospective child version. Null for "keep the plan". */
  version: PlanVersion | null;
  diff: PlanDiff | null;
  diffId: string | null;
  costKey: string;
  /** Numbers only, so the narrator can render the cost in either language. */
  costSlots: Record<string, string | number>;
  loadDeltaPct: number;
}

export interface ReplanRefusal {
  optionId: string;
  reason: string;
}

export interface ReplanResult {
  /** Keep-the-plan first, then the change options that survived the guards. */
  options: ProposedPlan[];
  /** Options that could not be offered, with the reason. Never silently dropped. */
  refusals: ReplanRefusal[];
  /** The first day any option may change: today and tomorrow are frozen. */
  firstEditableDay: string;
}
