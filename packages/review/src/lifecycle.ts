/**
 * The review lifecycle: open (or refuse to open), assemble options, decide, expire.
 *
 * Everything here is pure and every number comes from knowledge. The three suppression guards are the
 * anti-nagging discipline of review-trigger-policy.md §2; the option rules are §3.4 and §5; the freeze window
 * is §3.7 plus review-triggers.yaml#freeze_window_days.
 */
import type { Review, ReviewOption } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { addDays, daysBetween, uuidFrom } from "@training-planner/planner-core";
import type {
  AssembleOptionsInput,
  AssembleRejectCode,
  AssembleResult,
  Decision,
  DecisionResult,
  OpenReviewInput,
  OpenReviewResult,
  ProposedOption,
  SuppressionReason,
} from "./types";

const numberAt = (knowledge: KnowledgeBundle, anchor: string): number => knowledge.number(anchor);

/** The first day a change may land: today and tomorrow are frozen (review-triggers.yaml#freeze_window_days). */
export function firstEditableDay(today: string, knowledge: KnowledgeBundle): string {
  return addDays(today, numberAt(knowledge, "review-triggers.yaml#freeze_window_days"));
}

/** A review whose every option has expired is expired: a plan nobody re-checked should say so. */
export function isExpired(review: Review, today: string): boolean {
  if (review.options.length === 0) return false;
  const latest = review.options.map((option) => option.expiresAfterDay).sort().at(-1);
  return latest !== undefined && today > latest;
}

/**
 * Why a candidate may not become a review, or null when it may. `interrupt-now` bypasses the budget: a safety
 * interruption that is suppressed because the runner already got a review this week is the failure mode the
 * whole guard exists to avoid.
 */
function suppressionFor(input: OpenReviewInput): { reason: SuppressionReason; detail: string } | null {
  const { candidate, knowledge } = input;
  if (candidate.presentation === "interrupt-now") return null;

  const maxPrompts = numberAt(knowledge, "review-triggers.yaml#max_prompts_per_week");
  const prompts = input.promptsThisWeek ?? 0;
  if (prompts >= maxPrompts) {
    return { reason: "budget", detail: `${prompts} review prompts already this week` };
  }

  const cooldown = numberAt(knowledge, "review-triggers.yaml#cooldown_after_accepted_review_days");
  const sinceAccepted = input.daysSinceAcceptedReview ?? null;
  if (sinceAccepted !== null && sinceAccepted <= cooldown) {
    return { reason: "cooldown", detail: `a review was accepted ${sinceAccepted} days ago` };
  }

  const dwell = numberAt(knowledge, "review-triggers.yaml#dwell_days");
  const sinceTrigger = input.daysSinceTrigger?.[candidate.kind] ?? null;
  if (sinceTrigger !== null && sinceTrigger < dwell) {
    return { reason: "dwell", detail: `this trigger fired ${sinceTrigger} days ago` };
  }

  return null;
}

export function openReview(input: OpenReviewInput): OpenReviewResult {
  const { candidate, knowledge, today } = input;
  const suppressed = suppressionFor(input);
  if (suppressed !== null) {
    return { status: "suppressed", reason: suppressed.reason, ruleId: "suppression-and-dwell", detail: suppressed.detail };
  }

  const horizonDays = input.horizonDays ?? numberAt(knowledge, "review-triggers.yaml#horizon_days");
  const freezeDays = input.freezeDays ?? numberAt(knowledge, "review-triggers.yaml#freeze_window_days");
  const reviewId = uuidFrom({
    userId: input.userId,
    today,
    kind: candidate.kind,
    ruleId: candidate.ruleId,
    signalIds: candidate.evidence.signalIds,
  });

  const shell: Review = {
    schemaVersion: 1,
    reviewId,
    userId: input.userId,
    openedAtDay: today,
    openedBy: candidate.ruleId === null ? "user-request" : "system-signal",
    evidence: candidate.evidence,
    horizonDays,
    freezeDays,
    options: [],
    status: "open",
  };
  // The wire contract requires at least two options, and a review with one option is a demand. So opening and
  // assembling are one step: a review that cannot carry its options never exists at all.
  const assembledResult = assembleOptions({ review: shell, options: input.options, today, knowledge, renderCost: input.renderCost });
  if (assembledResult.status !== "assembled") {
    return { status: "refused", code: assembledResult.code, detail: assembledResult.detail };
  }
  return { status: "opened", review: assembledResult.review };
}

/**
 * Attach the options. The rules that make a review a review: at least two candidates, exactly one "keep the
 * plan" and it comes first, every other option carries a diff and a stated cost, and a safety-critical review
 * may not offer an option that increases load (review-trigger-policy.md §3.4 and §5).
 */
export function assembleOptions(input: AssembleOptionsInput): AssembleResult {
  const { review, options, knowledge } = input;
  const refuse = (code: AssembleRejectCode, detail: string): AssembleResult => ({ status: "refused", code, detail });

  if (review.status !== "open") return refuse("not-open", `review ${review.reviewId} is ${review.status}`);

  const maxOptions = numberAt(knowledge, "review-triggers.yaml#max_changes_per_review") + 1;
  if (options.length < 2) return refuse("too-few-options", "a review never presents a single option");
  if (options.length > maxOptions) {
    return refuse("too-many-options", `${options.length} options exceeds the ${maxOptions} the change budget allows`);
  }

  const keeps = options.filter((option) => option.keepAsIs);
  if (keeps.length !== 1) return refuse("keep-as-is-must-exist-once", `found ${keeps.length} keep-as-is options`);
  if (options[0]?.keepAsIs !== true) return refuse("keep-as-is-must-be-first", "the first option must be keeping the plan");

  const safetyCritical = review.evidence.ruleIds.some((ruleId) => ruleId.includes("safety")) || review.openedBy === "system-signal";
  for (const option of options) {
    if (option.keepAsIs) continue;
    if (option.diffId === null) return refuse("missing-diff", `${option.optionId} proposes a change with no diff`);
    if (option.costKey.length === 0) return refuse("missing-cost", `${option.optionId} states no cost`);
    if (safetyCritical && (option.loadDeltaPct ?? 0) > 0) {
      return refuse("adds-load-under-safety", `${option.optionId} adds load in a safety-critical review`);
    }
  }

  const expiresAfterDay = addDays(review.openedAtDay, review.horizonDays);
  const wireOptions: ReviewOption[] = options.map((option) => ({
    optionId: option.optionId,
    labelKey: option.labelKey,
    keepAsIs: option.keepAsIs,
    diffId: option.diffId,
    costSummary: input.renderCost(option),
    expiresAfterDay,
  }));

  return { status: "assembled", review: { ...review, options: wireOptions } };
}

/**
 * The runner's decision. Accepting "keep the plan" is a decision with no diff; accepting a change returns the
 * first day it may land, which is never today and never tomorrow.
 */
export function decideReview(review: Review, decision: Decision, today: string, knowledge: KnowledgeBundle): DecisionResult {
  if (review.status !== "open") {
    return { status: "refused", code: "not-open", detail: `review ${review.reviewId} is ${review.status}` };
  }
  if (isExpired(review, today)) {
    return { status: "refused", code: "expired", detail: `every option expired before ${today}` };
  }

  if (decision.kind === "decline") {
    return {
      status: "rejected",
      review: { ...review, status: "rejected", decidedAtDay: today, chosenOptionId: null, resultDiffId: null },
      reason: decision.reason?.trim() === "" ? null : (decision.reason?.trim() ?? null),
    };
  }

  if (decision.kind === "defer") {
    if (daysBetween(today, decision.untilDay) <= 0) {
      return { status: "refused", code: "defer-in-the-past", detail: `cannot defer to ${decision.untilDay}, which is not after today` };
    }
    return {
      status: "deferred",
      review: { ...review, status: "deferred" },
      recheckDay: decision.untilDay,
    };
  }

  const option = review.options.find((candidate) => candidate.optionId === decision.optionId);
  if (option === undefined) {
    return { status: "refused", code: "unknown-option", detail: `no option ${decision.optionId} in this review` };
  }

  const accepted: Review = {
    ...review,
    status: "accepted",
    chosenOptionId: option.optionId,
    decidedAtDay: today,
    resultDiffId: option.keepAsIs ? null : option.diffId,
  };
  return {
    status: "accepted",
    review: accepted,
    option,
    applyFromDay: firstEditableDay(today, knowledge),
    resultDiffId: option.keepAsIs ? null : option.diffId,
  };
}

/** Mark open reviews whose options have all expired. Returns new objects; nothing is mutated. */
export function expireReviews(reviews: readonly Review[], today: string): Review[] {
  return reviews.map((review) => (review.status === "open" && isExpired(review, today) ? { ...review, status: "expired" } : review));
}
