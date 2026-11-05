/**
 * The request builder: what the model is allowed to see, and the hashes that make the call auditable.
 *
 * The builder is deterministic, so two identical inputs produce the same `promptHash` and a review can be replayed
 * months later against the same guidelines. It resolves the **effective** guideline version per id (latest version
 * whose `effectiveFrom` is on or before today) - a review opened before a guideline changed must not be judged by
 * the newer text.
 */
import { canonicalJson, hashOf } from "@training-planner/knowledge";
import type { GuidelineContract } from "@training-planner/domain";
import { addDays } from "@training-planner/planner-core";
import type { AdvisorCall, AdvisorInput, AdvisorRequest, GuidelineDigestRow } from "./types";

const QUALITY_KINDS: readonly string[] = ["tempo", "vo2max", "hills", "mp", "test", "race"];

/** The rules restated in the request. They are the ADR-0009 non-negotiables the model cannot argue with. */
export const REQUEST_RULES: readonly string[] = [
  "You may propose at most two changes, and only on days after the first editable day.",
  "You may not change a past day, today, or a day inside the freeze window.",
  "You may not add weekly load: the sum of planned kilometres after your changes may not exceed the sum before.",
  "You may not add intensity when a safety or medical guideline applies; safety rules subtract only.",
  "Every change must carry a cost from the allowed cost keys, and every number must come from the facts you were given.",
  "You may answer no-change. That is a decision, not a failure.",
];

/** Latest version per guideline id whose effectiveFrom is on or before today. */
export function effectiveGuidelines(guidelines: readonly GuidelineContract[], today: string): GuidelineDigestRow[] {
  const latest = new Map<string, GuidelineContract>();
  for (const guideline of guidelines) {
    if (guideline.effectiveFrom > today) continue;
    const current = latest.get(guideline.guidelineId);
    if (current === undefined || guideline.version > current.version) latest.set(guideline.guidelineId, guideline);
  }
  const tierOrder: Record<string, number> = { "non-negotiable": 0, constraint: 1, default: 2 };
  return [...latest.values()]
    .sort((left, right) => {
      const tier = (tierOrder[left.tier] ?? 9) - (tierOrder[right.tier] ?? 9);
      return tier !== 0 ? tier : left.guidelineId < right.guidelineId ? -1 : 1;
    })
    .map((guideline) => ({
      guidelineId: guideline.guidelineId,
      version: guideline.version,
      tier: guideline.tier,
      scope: guideline.scope,
      visibility: guideline.visibility,
      text: guideline.text,
    }));
}

const recentEntries = (input: AdvisorInput): AdvisorRequest["context"]["entries"] => {
  const latest = new Map<string, AdvisorInput["entries"][number]>();
  for (const entry of input.entries) {
    const current = latest.get(entry.day);
    if (current === undefined || entry.revision >= current.revision) latest.set(entry.day, entry);
  }
  return [...latest.values()]
    .filter((entry) => entry.day <= input.today)
    .sort((left, right) => (left.day < right.day ? -1 : 1))
    .slice(-28)
    .map((entry) => {
      const pain = (entry.pain ?? []).reduce<number | null>(
        (highest, report) => (highest === null || report.intensity > highest ? report.intensity : highest),
        null,
      );
      return {
        day: entry.day,
        outcome: entry.outcome,
        ...(entry.sessionTaken === undefined ? {} : { sessionTaken: entry.sessionTaken }),
        ...(entry.completedKm === undefined ? {} : { completedKm: entry.completedKm }),
        ...(entry.rpe === undefined ? {} : { rpe: entry.rpe }),
        pain,
      };
    });
};

export function buildAdvisorRequest(input: AdvisorInput): AdvisorCall {
  const guidelines = effectiveGuidelines(input.guidelines, input.today);
  const freezeDays = input.knowledge.number("review-triggers.yaml#freeze_window_days");
  const firstEditableDay = addDays(input.today, freezeDays);

  const plannedKmByDay: Record<string, number> = {};
  const hardDays: string[] = [];
  for (const session of input.plan.sessions) {
    plannedKmByDay[session.day] = session.distanceKm ?? 0;
    if (session.hardDay === true) hardDays.push(session.day);
  }

  const answers = [...input.wizardAnswers].sort((left, right) =>
    left.stepId < right.stepId ? -1 : left.stepId > right.stepId ? 1 : left.revision - right.revision,
  );
  const revisedSteps = [...new Set(answers.filter((answer) => answer.revision > 1).map((answer) => answer.stepId))].sort();

  const references = [...(input.references ?? [])];
  const request: AdvisorRequest = {
    system: { guidelines, rules: [...REQUEST_RULES], references },
    runner: {
      answers,
      settings: input.settings,
      revisedSteps,
      profile:
        input.profile === undefined
          ? null
          : {
              goalType: input.profile.goal.type,
              riskAppetite: input.profile.goal.riskAppetite ?? null,
              availabilityDays: [...input.profile.availability.days],
            },
    },
    context: {
      today: input.today,
      planVersionId: input.plan.versionId,
      firstDay: input.plan.firstDay,
      lastDay: input.plan.lastDay,
      entries: recentEntries(input),
      signals: (input.signals ?? []).map((signal) => ({
        key: signal.key,
        // A signal's value can be a structured payload; the request carries only the number the model may reason
        // about, and null when the signal has no number. Anything else would be a fact the model invented.
        value: typeof signal.value === "number" ? signal.value : null,
        confidence: signal.confidence,
        ...(signal.direction === undefined ? {} : { direction: signal.direction }),
      })),
    },
    vocabulary: {
      decisions: ["no-change", "propose-change"],
      reasonCodes: [...input.allowedReasonCodes],
      costKeys: [...input.allowedCostKeys],
      sessionKinds: [...new Set(input.plan.sessions.map((session) => session.kind))].sort() as AdvisorRequest["vocabulary"]["sessionKinds"],
      maxChanges: 2,
      firstEditableDay,
      plannedKmByDay,
      hardDays,
    },
  };

  return {
    request,
    hashes: {
      guidelineVersionHash: hashOf(guidelines.map((guideline) => `${guideline.guidelineId}@${guideline.version}`).join("|")),
      promptHash: hashOf(canonicalJson(request)),
      knowledgeHash: input.knowledge.hash,
      referenceHash: hashOf(canonicalJson(references)),
    },
  };
}

/** Exposed for the validator: a day's planned kilometres, and whether the plan calls it hard. */
export function planFactsOf(plan: AdvisorInput["plan"]): { kmByDay: Map<string, number>; qualityDays: Set<string> } {
  const kmByDay = new Map<string, number>();
  const qualityDays = new Set<string>();
  for (const session of plan.sessions) {
    kmByDay.set(session.day, session.distanceKm ?? 0);
    if (session.hardDay === true || QUALITY_KINDS.includes(session.kind)) qualityDays.add(session.day);
  }
  return { kmByDay, qualityDays };
}
