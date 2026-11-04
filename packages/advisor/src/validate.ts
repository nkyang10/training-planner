/**
 * The deterministic gates a proposal must pass before a runner is ever asked about it.
 *
 * ADR-0009's whole safety argument is here: the model may be fluent and wrong, so its output is treated as a claim
 * and checked against the plan, the request and the non-negotiables. The checks are ordered from cheapest to most
 * expensive, and every failure names the rule it broke - a violation a caller cannot explain is a violation nobody
 * can fix.
 *
 * What this file deliberately does not do: it does not call the model (that is `ModelPort`), does not read a clock,
 * and does not decide to accept a change. Acceptance is the runner's; this only decides whether the proposal is
 * *askable*.
 */
import type { PlanVersion } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { addDays, weekStart } from "@training-planner/planner-core";
import { advisorProposalSchema } from "./proposal";
import type { AdvisorProposal } from "./proposal";
import type { AdvisorRequest } from "./types";

export interface AdvisorVerdict {
  accepted: boolean;
  violations: string[];
  /** What the caller must do when the proposal is not askable. Never "apply it anyway". */
  fallback: "deterministic-replan" | "none";
  /** The parsed proposal when accepted, so the caller never parses twice. */
  proposal?: AdvisorProposal;
}

export interface ValidateProposalInput {
  /** Raw model output; the validator owns parsing it. */
  output: unknown;
  request: AdvisorRequest;
  plan: PlanVersion;
  today: string;
  knowledge: KnowledgeBundle;
}

/** Numbers the request actually contains, for the grounding check. */
function contextNumbers(request: AdvisorRequest): Set<number> {
  const numbers = new Set<number>();
  for (const km of Object.values(request.vocabulary.plannedKmByDay)) numbers.add(km);
  for (const entry of request.context.entries) {
    if (typeof entry.completedKm === "number") numbers.add(entry.completedKm);
    if (typeof entry.rpe === "number") numbers.add(entry.rpe);
    if (typeof entry.pain === "number") numbers.add(entry.pain);
  }
  for (const signal of request.context.signals) if (typeof signal.value === "number") numbers.add(signal.value);
  return numbers;
}

const weeklyKm = (plan: PlanVersion, replacements: Map<string, number>): Map<string, number> => {
  const weeks = new Map<string, number>();
  for (const session of plan.sessions) {
    const km = replacements.get(session.day) ?? session.distanceKm ?? 0;
    const week = weekStart(session.day);
    weeks.set(week, (weeks.get(week) ?? 0) + km);
  }
  return weeks;
};

export function validateProposal(input: ValidateProposalInput): AdvisorVerdict {
  const violations: string[] = [];
  const reject = (reason: string): AdvisorVerdict => {
    violations.push(reason);
    return { accepted: false, violations, fallback: "deterministic-replan" };
  };

  const parsed = advisorProposalSchema.safeParse(input.output);
  if (!parsed.success) {
    return reject(`proposal does not satisfy the advisor contract: ${parsed.error.issues.map((issue) => `${issue.path.join(".") || "proposal"}: ${issue.message}`).join("; ")}`);
  }
  const proposal = parsed.data;
  const { request, today } = input;

  // The decision and the changes must agree. "no-change" with changes is the model saying two things at once.
  if (proposal.decision === "no-change" && proposal.proposedChanges.length > 0) {
    return reject("decision is no-change but changes were proposed");
  }
  if (proposal.decision === "propose-change" && proposal.proposedChanges.length === 0) {
    return reject("decision is propose-change but no change was proposed");
  }
  if (!request.vocabulary.reasonCodes.includes(proposal.reasonCode)) {
    return reject(`reasonCode ${proposal.reasonCode} is not in the allowed vocabulary`);
  }

  // Grounding: a number the request did not contain is an invented fact, whatever it is attached to.
  const allowedNumbers = contextNumbers(request);
  for (const fact of proposal.facts) {
    if (typeof fact.value === "number" && !allowedNumbers.has(fact.value)) {
      violations.push(`fact ${fact.key} carries ${fact.value}, which the request did not contain`);
    }
  }

  const safetyInEffect = request.system.guidelines.some(
    (guideline) => guideline.scope === "safety" || guideline.scope === "medical",
  );
  const planKinds = new Set(input.plan.sessions.map((session) => session.kind as string));
  const replacements = new Map<string, number>();

  for (const change of proposal.proposedChanges) {
    const planned = request.vocabulary.plannedKmByDay[change.day];
    if (planned === undefined) {
      violations.push(`change on ${change.day}: the plan prescribes nothing that day, so there is nothing to change`);
      continue;
    }
    if (change.day <= today) {
      violations.push(`change on ${change.day}: a past day or today is never editable`);
    }
    if (change.day < request.vocabulary.firstEditableDay) {
      violations.push(`change on ${change.day}: inside the freeze window (first editable day is ${request.vocabulary.firstEditableDay})`);
    }
    if (change.day < input.plan.firstDay || change.day > input.plan.lastDay) {
      violations.push(`change on ${change.day}: outside the plan's range`);
    }
    if (!planKinds.has(change.kind)) {
      violations.push(`change on ${change.day}: kind ${change.kind} is not a kind this plan uses`);
    }
    if (change.fromKm !== planned) {
      violations.push(`change on ${change.day}: fromKm ${change.fromKm} is not the plan's ${planned} km`);
    }
    if (safetyInEffect && change.toKm > change.fromKm) {
      violations.push(`change on ${change.day}: safety or medical guidelines apply, so a change may not add kilometres`);
    }
    if (!request.vocabulary.costKeys.includes(change.costKey)) {
      violations.push(`change on ${change.day}: costKey ${change.costKey} is not in the allowed cost vocabulary`);
    }
    const derived = new Set([change.fromKm, change.toKm, Math.abs(change.fromKm - change.toKm)]);
    for (const [slot, value] of Object.entries(change.costSlots)) {
      if (typeof value === "number" && !allowedNumbers.has(value) && !derived.has(value)) {
        violations.push(`change on ${change.day}: cost slot ${slot} carries ${value}, which the request did not contain`);
      }
    }
    replacements.set(change.day, change.toKm);
  }

  // Never add load: the week after is never heavier than the week before, whatever the individual days say.
  const before = weeklyKm(input.plan, new Map());
  const after = weeklyKm(input.plan, replacements);
  for (const [week, beforeKm] of before) {
    const afterKm = after.get(week) ?? 0;
    if (afterKm > beforeKm) {
      violations.push(`week of ${week}: the proposal adds load (${beforeKm} km to ${afterKm} km)`);
    }
  }

  // A rising or high pain report in the context means the runner's own decision needs the human flag set.
  const highPain = request.context.entries.some((entry) => typeof entry.pain === "number" && entry.pain >= 7);
  if (highPain && proposal.decision === "propose-change" && !proposal.needsHuman) {
    violations.push("a pain report of 7 or more is in the context, so needsHuman must be true");
  }

  if (violations.length > 0) return { accepted: false, violations, fallback: "deterministic-replan" };
  return { accepted: true, violations: [], fallback: "none", proposal };
}

/** The day the first change may land, for a caller that wants to show the freeze window before the model answers. */
export function firstEditableDay(today: string, knowledge: KnowledgeBundle): string {
  return addDays(today, knowledge.number("review-triggers.yaml#freeze_window_days"));
}

/** Kept so a caller can assert the request's own rules are the ones being enforced. */
export function requestRulesOf(request: AdvisorRequest): readonly string[] {
  return request.system.rules;
}
