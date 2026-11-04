/**
 * Candidate changes for a review, and the guards that decide whether an option may be offered at all.
 *
 * Four guards, in the order they matter:
 * 1. **The freeze window.** Nothing at or before today + freeze_window_days may change; a review that can move
 *    tomorrow is a review the runner cannot trust this evening.
 * 2. **One change per option.** `diffPlans` refuses more than two changes per diff; an option that needs three is
 *    not a review option, it is a rewrite.
 * 3. **The planner's invariants.** A candidate that introduces an invariant violation is refused, never offered
 *    with a warning. (Violations the plan already had are not this option's fault and are reported separately.)
 * 4. **No added load under a safety-critical trigger.** Reductions only, which is also what the safety layer says.
 */
import type { PlanVersion, Session } from "@training-planner/domain";
import { addDays, checkInvariants, diffPlans, uuidFrom, weekStart } from "@training-planner/planner-core";
import type { ProposedPlan, ReplanRefusal, ReplanRequest, ReplanResult } from "./types";

const QUALITY_KINDS = new Set(["tempo", "vo2max", "hills", "mp", "test", "race"]);
const round1 = (value: number): number => Math.round(value * 10) / 10;

const later = (a: string, b: string): string => (a >= b ? a : b);
const earlier = (a: string, b: string): string => (a <= b ? a : b);

function weekPlannedKm(plan: PlanVersion, day: string): number {
  // The ISO week of the changed day, because loadDeltaPct is read against the week the change lands in.
  // `weekStart` from planner-core, not a Date: this package is pure and the purity gate would reject one.
  const monday = weekStart(day);
  const sunday = addDays(monday, 6);
  return plan.sessions
    .filter((session) => session.day >= monday && session.day <= sunday)
    .reduce((sum, session) => sum + (session.kind === "rest" ? 0 : (session.distanceKm ?? 0)), 0);
}

function childVersion(plan: PlanVersion, sessions: Session[], today: string, optionId: string): PlanVersion {
  return {
    ...plan,
    versionId: uuidFrom({ parent: plan.versionId, optionId, today }),
    parentVersionId: plan.versionId,
    generatedBy: "review-accepted",
    generatedAtDay: today,
    sessions,
  };
}

interface Candidate {
  optionId: string;
  labelKey: string;
  costKey: string;
  session: Session;
  after: Session;
  knobsUsed: string[];
  costSlots: (before: number, after: number) => Record<string, string | number>;
}

export function proposePlanOptions(request: ReplanRequest): ReplanResult {
  const { plan, today, candidate, knowledge } = request;
  const freezeDays = knowledge.number("review-triggers.yaml#freeze_window_days");
  const horizonDays = request.horizonDays ?? knowledge.number("review-triggers.yaml#horizon_days");
  const downgradeFactor = 1 - knowledge.number("wellness.yaml#downgrade_magnitude_pct") / 100;

  const firstEditableDay = addDays(later(today, plan.generatedAtDay), freezeDays);
  const horizonEnd = earlier(plan.lastDay, addDays(today, horizonDays));
  const inWindow = (session: Session): boolean => session.day >= firstEditableDay && session.day <= horizonEnd;

  const keep: ProposedPlan = {
    optionId: "keep",
    labelKey: "keep-the-plan",
    keepAsIs: true,
    version: null,
    diff: null,
    diffId: null,
    costKey: "risk-noted",
    costSlots: {},
    loadDeltaPct: 0,
  };

  const candidates: Candidate[] = [];

  const quality = plan.sessions.find((session) => inWindow(session) && (session.hardDay === true || QUALITY_KINDS.has(session.kind)));
  if (quality !== undefined) {
    const beforeKm = quality.distanceKm ?? 0;
    const afterKm = round1(beforeKm * downgradeFactor);
    candidates.push({
      optionId: "downgrade-next-quality",
      labelKey: "downgrade-next-quality",
      costKey: "quality-stimulus-lost",
      session: quality,
      after: {
        ...quality,
        kind: "easy",
        hardDay: false,
        targetRpe: null,
        distanceKm: afterKm,
        summaryText: `easy ${afterKm} km`,
      },
      knobsUsed: ["wellness.yaml#downgrade_magnitude_pct", "review-triggers.yaml#freeze_window_days"],
      costSlots: () => ({ day: quality.day, beforeKm, afterKm }),
    });
  }

  const easy = plan.sessions.find((session) => inWindow(session) && session.kind === "easy");
  if (easy !== undefined) {
    candidates.push({
      optionId: "rest-instead-of-easy",
      labelKey: "rest-instead-of-easy",
      costKey: "easy-stimulus-lost",
      session: easy,
      after: {
        ...easy,
        kind: "rest",
        // `rest-is-rest` is a planner invariant, and it is right: a rest session that still says "planned" is two
        // different claims in one row. The guard caught this before the option could be offered.
        outcome: "rest",
        restDay: true,
        hardDay: false,
        targetRpe: null,
        distanceKm: null,
        summaryText: "rest",
      },
      knobsUsed: ["review-triggers.yaml#freeze_window_days"],
      costSlots: () => ({ day: easy.day, km: easy.distanceKm ?? 0 }),
    });
  }

  const refusals: ReplanRefusal[] = [];
  if (quality === undefined) {
    refusals.push({ optionId: "downgrade-next-quality", reason: "no quality session after the freeze window inside the horizon" });
  }
  if (easy === undefined) {
    refusals.push({ optionId: "rest-instead-of-easy", reason: "no easy session after the freeze window inside the horizon" });
  }
  const options: ProposedPlan[] = [keep];
  const baselineViolations = new Set(
    checkInvariants({ version: plan, openQuestions: [] }, { knowledge }).map((violation) => `${violation.invariant}:${(violation.days ?? []).join(",")}`),
  );

  for (const candidateOption of candidates) {
    const sessions = plan.sessions.map((session) => (session.day === candidateOption.session.day ? candidateOption.after : session));
    const child = childVersion(plan, sessions, today, candidateOption.optionId);

    const diff = diffPlans(plan, child, {
      createdAtDay: today,
      knowledgeHash: knowledge.hash,
      maxChanges: 2,
      isSafety: candidate.presentation === "interrupt-now",
      reason: candidate.ruleId ?? candidate.kind,
      signalIds: candidate.evidence.signalIds,
      expectedCost: candidateOption.costKey,
      knobsUsed: candidateOption.knobsUsed,
    });

    if (diff.changes.length !== 1) {
      refusals.push({
        optionId: candidateOption.optionId,
        reason: `expected exactly one change after the freeze window, the diff produced ${diff.changes.length}`,
      });
      continue;
    }

    // Attribution is scoped to the days the option actually changes, on top of the base-version comparison the
    // invariant now does: a violation on a day this option did not touch is not this option s doing.
    const changedDays = new Set([candidateOption.session.day]);
    // `baseVersion` is the difference between "is the recomputed ratio above the ceiling" and "does this plan add
    // load relative to the plan the runner was already on". Only the second question is the review engine s.
    const introduced = checkInvariants({ version: child, openQuestions: [] }, { knowledge, baseVersion: plan }).filter(
      (violation) =>
        !baselineViolations.has(`${violation.invariant}:${(violation.days ?? []).join(",")}`) &&
        (violation.days ?? []).some((day) => changedDays.has(day)),
    );
    if (introduced.length > 0) {
      refusals.push({
        optionId: candidateOption.optionId,
        reason: `the candidate would introduce an invariant violation: ${introduced[0]?.invariant ?? "unknown"}`,
      });
      continue;
    }

    const weekKm = weekPlannedKm(plan, candidateOption.session.day);
    const beforeKm = candidateOption.session.distanceKm ?? 0;
    const afterKm = candidateOption.after.distanceKm ?? 0;
    const loadDeltaPct = weekKm === 0 ? 0 : round1(((afterKm - beforeKm) / weekKm) * 100);

    options.push({
      optionId: candidateOption.optionId,
      labelKey: candidateOption.labelKey,
      keepAsIs: false,
      version: child,
      diff,
      diffId: diff.diffId,
      costKey: candidateOption.costKey,
      costSlots: candidateOption.costSlots(beforeKm, afterKm),
      loadDeltaPct,
    });
  }

  if (candidates.length === 0) {
    refusals.push({
      optionId: "any-change",
      reason: "the plan has no quality or easy session inside the review horizon after the freeze window",
    });
  }

  return { options, refusals, firstEditableDay };
}
