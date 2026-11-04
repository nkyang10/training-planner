/**
 * The review lifecycle's tests: every guard must be able to fire, and every guard must be able to stay quiet.
 *
 * The guards are the product here. A review that opens whenever a signal fires becomes a notification nobody
 * reads; a review that offers one option is a demand; a review that can change today is a plan the runner
 * cannot trust. Each of those is a test below.
 */
import { describe, expect, it } from "vitest";
import { loadKnowledge } from "@training-planner/knowledge";
import { reviewSchema } from "@training-planner/domain";
import type { Review } from "@training-planner/domain";
import {
  assembleOptions,
  decideReview,
  expireReviews,
  firstEditableDay,
  isExpired,
  openReview,
} from "../src/index";
import type { OpenReviewInput, OpenReviewResult, ProposedOption, ReviewCandidate } from "../src/index";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "55555555-5555-4555-8555-555555555555";
const TODAY = "2026-11-10";

const candidate = (overrides: Partial<ReviewCandidate> = {}): ReviewCandidate => ({
  kind: "plan-too-big",
  ruleId: "plan-too-big",
  anchor: "review-triggers.yaml#plan-too-big",
  evidence: { signalIds: ["completion-rate"], ruleIds: ["plan-too-big"], evidenceGradeMax: "B" },
  presentation: "offer-at-next-open",
  ...overrides,
});

const options: ProposedOption[] = [
  { optionId: "keep", labelKey: "keep-as-is", keepAsIs: true, diffId: null, costKey: "risk-noted", costSlots: {}, loadDeltaPct: 0 },
  // diffId is the uuid of a stored plan-diff (review.schema.json requires a uuid), never a label.
  { optionId: "reduce", labelKey: "reduce-hard-days", keepAsIs: false, diffId: "11111111-1111-4111-8111-111111111111", costKey: "less-intensity", costSlots: {}, loadDeltaPct: -15 },
  { optionId: "shorten", labelKey: "shorten-sessions", keepAsIs: false, diffId: "22222222-2222-4222-8222-222222222222", costKey: "less-volume", costSlots: {}, loadDeltaPct: -8 },
];

const renderCost = (option: ProposedOption): string => option.costKey;

const input = (overrides: Partial<OpenReviewInput> = {}): OpenReviewInput => ({
  userId: USER,
  today: TODAY,
  candidate: candidate(),
  knowledge,
  options,
  renderCost,
  ...overrides,
});

const opened = (overrides: Partial<OpenReviewInput> = {}): Review => {
  const result = openReview(input(overrides));
  if (result.status !== "opened") throw new Error(`expected opened, got ${JSON.stringify(result)}`);
  return result.review;
};

const refusal = (overrides: Partial<OpenReviewInput> = {}): Extract<OpenReviewResult, { status: "refused" }> => {
  const result = openReview(input(overrides));
  if (result.status !== "refused") throw new Error(`expected refused, got ${JSON.stringify(result)}`);
  return result;
};

describe("a review opens only when it is allowed to", () => {
  it("opens with the knowledge horizon, freeze window and its options already attached", () => {
    const review = opened();
    expect(review.status).toBe("open");
    expect(review.horizonDays).toBe(14);
    expect(review.freezeDays).toBe(2);
    expect(review.openedBy).toBe("system-signal");
    expect(review.reviewId).toMatch(/^[0-9a-f-]{36}$/);
    expect(review.options).toHaveLength(3);
    expect(reviewSchema.safeParse(review).success).toBe(true);
  });

  it("is deterministic for the same evidence", () => {
    expect(opened().reviewId).toBe(opened().reviewId);
  });

  it("suppresses on the weekly prompt budget", () => {
    const result = openReview(input({ promptsThisWeek: 1 }));
    expect(result.status).toBe("suppressed");
    if (result.status !== "suppressed") throw new Error("unreachable");
    expect(result.reason).toBe("budget");
    expect(result.ruleId).toBe("suppression-and-dwell");
  });

  it("suppresses inside the cooldown after an accepted review", () => {
    const result = openReview(input({ daysSinceAcceptedReview: 3 }));
    expect(result.status).toBe("suppressed");
    if (result.status !== "suppressed") throw new Error("unreachable");
    expect(result.reason).toBe("cooldown");
  });

  it("suppresses inside the dwell window of the same trigger", () => {
    const result = openReview(input({ daysSinceTrigger: { "plan-too-big": 2 } }));
    expect(result.status).toBe("suppressed");
    if (result.status !== "suppressed") throw new Error("unreachable");
    expect(result.reason).toBe("dwell");
  });

  it("lets an interrupt-now trigger through every guard", () => {
    const result = openReview(
      input({
        candidate: candidate({ presentation: "interrupt-now" }),
        promptsThisWeek: 3,
        daysSinceAcceptedReview: 1,
        daysSinceTrigger: { "plan-too-big": 1 },
      }),
    );
    expect(result.status).toBe("opened");
  });

  it("opens when no guard applies", () => {
    const result = openReview(input({ promptsThisWeek: 0, daysSinceAcceptedReview: null, daysSinceTrigger: { "plan-too-big": 9 } }));
    expect(result.status).toBe("opened");
  });
});

describe("a review never offers one option, and never offers a free change", () => {
  it("assembles three options with keep-as-is first", () => {
    const review = opened();
    expect(review.options[0]?.keepAsIs).toBe(true);
    expect(review.options[0]?.diffId).toBeNull();
    expect(review.options[1]?.costSummary).toBe("less-intensity");
    expect(reviewSchema.safeParse(review).success).toBe(true);
  });

  it("refuses a single option, so the review never exists", () => {
    expect(refusal({ options: [options[0] as ProposedOption] }).code).toBe("too-few-options");
  });

  it("refuses more options than the change budget allows", () => {
    const many = [...options, { optionId: "extra", labelKey: "extra", keepAsIs: false, diffId: "33333333-3333-4333-8333-333333333333", costKey: "cost", costSlots: {} }];
    expect(refusal({ options: many }).code).toBe("too-many-options");
  });

  it("refuses when keeping the plan is not first", () => {
    const reordered = [options[1] as ProposedOption, options[0] as ProposedOption, options[2] as ProposedOption];
    expect(refusal({ options: reordered }).code).toBe("keep-as-is-must-be-first");
  });

  it("refuses a change with no diff", () => {
    expect(refusal({ options: [options[0] as ProposedOption, { ...(options[1] as ProposedOption), diffId: null }] }).code).toBe("missing-diff");
  });

  it("refuses a change that adds load in a safety-critical review", () => {
    const adding = [options[0] as ProposedOption, { ...(options[1] as ProposedOption), loadDeltaPct: 10 }];
    expect(
      refusal({
        candidate: candidate({ kind: "pain-pattern", ruleId: "pain-escalation", presentation: "interrupt-now" }),
        options: adding,
      }).code,
    ).toBe("adds-load-under-safety");
  });

  it("refuses to assemble options onto a review that is no longer open", () => {
    const accepted: Review = { ...opened(), status: "accepted" };
    const result = assembleOptions({ review: accepted, options, today: TODAY, knowledge, renderCost });
    expect(result.status).toBe("refused");
    if (result.status !== "refused") throw new Error("unreachable");
    expect(result.code).toBe("not-open");
  });
});

describe("the decision is the runner's, and it is bounded", () => {
  const review = (): Review => opened();

  it("accepts a change and names the first day it may land", () => {
    const result = decideReview(review(), { kind: "accept", optionId: "reduce" }, TODAY, knowledge);
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") throw new Error("unreachable");
    expect(result.applyFromDay).toBe("2026-11-12");
    expect(result.resultDiffId).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.review.status).toBe("accepted");
    expect(result.review.chosenOptionId).toBe("reduce");
    expect(reviewSchema.safeParse(result.review).success).toBe(true);
  });

  it("accepts keeping the plan as a decision with no diff", () => {
    const result = decideReview(review(), { kind: "accept", optionId: "keep" }, TODAY, knowledge);
    expect(result.status).toBe("accepted");
    if (result.status !== "accepted") throw new Error("unreachable");
    expect(result.resultDiffId).toBeNull();
    expect(result.option.keepAsIs).toBe(true);
  });

  it("records a decline as a normal outcome, with its reason", () => {
    const result = decideReview(review(), { kind: "decline", reason: "  I want to try another week  " }, TODAY, knowledge);
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.reason).toBe("I want to try another week");
    expect(result.review.status).toBe("rejected");
  });

  it("defers to a future day and refuses a past one", () => {
    const deferred = decideReview(review(), { kind: "defer", untilDay: "2026-11-17" }, TODAY, knowledge);
    expect(deferred.status).toBe("deferred");
    const refused = decideReview(review(), { kind: "defer", untilDay: "2026-11-09" }, TODAY, knowledge);
    expect(refused.status).toBe("refused");
    if (refused.status !== "refused") throw new Error("unreachable");
    expect(refused.code).toBe("defer-in-the-past");
  });

  it("refuses an unknown option and a review that is already decided", () => {
    const unknown = decideReview(review(), { kind: "accept", optionId: "nope" }, TODAY, knowledge);
    expect(unknown.status).toBe("refused");
    if (unknown.status !== "refused") throw new Error("unreachable");
    expect(unknown.code).toBe("unknown-option");

    const decided: Review = { ...review(), status: "accepted" };
    const again = decideReview(decided, { kind: "accept", optionId: "reduce" }, TODAY, knowledge);
    expect(again.status).toBe("refused");
    if (again.status !== "refused") throw new Error("unreachable");
    expect(again.code).toBe("not-open");
  });

  it("refuses a decision after every option expired", () => {
    const expired: Review = { ...review(), options: review().options.map((option) => ({ ...option, expiresAfterDay: "2026-11-05" })) };
    const result = decideReview(expired, { kind: "accept", optionId: "reduce" }, TODAY, knowledge);
    expect(result.status).toBe("refused");
    if (result.status !== "refused") throw new Error("unreachable");
    expect(result.code).toBe("expired");
  });
});

describe("the freeze window is never today or tomorrow", () => {
  it("puts the first editable day at least two days out", () => {
    expect(firstEditableDay(TODAY, knowledge)).toBe("2026-11-12");
    expect(firstEditableDay("2026-11-10", knowledge) > "2026-11-11").toBe(true);
  });

  it("expires only reviews whose every option has passed", () => {
    const review = opened();
    expect(isExpired(review, "2026-11-24")).toBe(false);
    expect(isExpired(review, "2026-11-25")).toBe(true);
    const [expired] = expireReviews([review], "2026-11-25");
    expect(expired?.status).toBe("expired");
    expect(review.status).toBe("open");
  });
});
