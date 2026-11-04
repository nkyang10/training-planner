/**
 * The onboarding wizard's steps and the rules over recorded answers (ADR-0009).
 *
 * The wizard is how a runner states their own orientation instead of inheriting the system's defaults, and the
 * answers are recorded step by step so the runner can change a choice later and still see what they originally
 * chose. The steps live here, in the wire layer, because the API and both clients must agree on their ids; the copy
 * for each step lives in packages/i18n's catalogue, not in this file.
 *
 * This module is pure: it validates and folds recorded answers, and it never reads a clock or storage.
 */
import type { DayName } from "./types";

export const WIZARD_STEP_IDS = ["goal", "availability", "risk-appetite", "weekly-hours"] as const;
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

export const GOAL_TYPES = ["finish", "time", "experience", "fitness-maintenance", "return-to-running"] as const;
export const RISK_APPETITES = ["conservative", "moderate", "aggressive"] as const;
export const DAY_NAMES: readonly DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface WizardStep {
  id: WizardStepId;
  kind: "choice" | "multi" | "number";
  required: boolean;
  options?: readonly string[];
  min?: number;
  max?: number;
  /** The athlete-profile field this answer feeds, so the mapping is data rather than a second schema. */
  mapsTo: string;
}

export const WIZARD_STEPS: readonly WizardStep[] = [
  { id: "goal", kind: "choice", required: true, options: GOAL_TYPES, mapsTo: "goal.type" },
  { id: "availability", kind: "multi", required: true, options: DAY_NAMES, mapsTo: "availability.days" },
  { id: "risk-appetite", kind: "choice", required: true, options: RISK_APPETITES, mapsTo: "goal.riskAppetite" },
  { id: "weekly-hours", kind: "number", required: false, min: 0, max: 40, mapsTo: "preferences.weeklyHours" },
];

/** One recorded answer, matching `wizard_answers` (ADR-0009). */
export interface WizardAnswerRecord {
  stepId: WizardStepId;
  answer: Record<string, unknown>;
  revision: number;
  source: "wizard" | "settings";
}

export interface WizardAnswerValidation {
  ok: boolean;
  answer?: Record<string, unknown>;
  detail?: string;
}

const isStep = (value: string): value is WizardStepId => (WIZARD_STEP_IDS as readonly string[]).includes(value);

/** Validate one raw answer against its step. A wrong shape is refused, never coerced. */
export function validateWizardAnswer(stepId: string, raw: unknown): WizardAnswerValidation {
  if (!isStep(stepId)) return { ok: false, detail: `${stepId} is not a wizard step` };
  const step = WIZARD_STEPS.find((candidate) => candidate.id === stepId);
  if (step === undefined) return { ok: false, detail: `${stepId} is not a wizard step` };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, detail: "an answer must be an object" };
  }
  const value = (raw as Record<string, unknown>)["value"];
  const values = (raw as Record<string, unknown>)["values"];

  if (step.kind === "choice") {
    if (typeof value !== "string" || !(step.options ?? []).includes(value)) {
      return { ok: false, detail: `${stepId} must be one of ${(step.options ?? []).join(", ")}` };
    }
    return { ok: true, answer: { value } };
  }
  if (step.kind === "multi") {
    if (!Array.isArray(values) || values.length === 0) {
      return { ok: false, detail: `${stepId} needs at least one value` };
    }
    const unique = [...new Set(values)];
    for (const entry of unique) {
      if (typeof entry !== "string" || !(step.options ?? []).includes(entry)) {
        return { ok: false, detail: `${stepId} contains ${String(entry)}, which is not an option` };
      }
    }
    return { ok: true, answer: { values: unique } };
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, detail: `${stepId} needs a number` };
  }
  if (step.min !== undefined && value < step.min) return { ok: false, detail: `${stepId} must be at least ${step.min}` };
  if (step.max !== undefined && value > step.max) return { ok: false, detail: `${stepId} must be at most ${step.max}` };
  return { ok: true, answer: { value } };
}

const byStep = (answers: readonly WizardAnswerRecord[]): Map<WizardStepId, WizardAnswerRecord[]> => {
  const grouped = new Map<WizardStepId, WizardAnswerRecord[]>();
  for (const answer of answers) {
    const list = grouped.get(answer.stepId) ?? [];
    list.push(answer);
    grouped.set(answer.stepId, list);
  }
  for (const list of grouped.values()) list.sort((left, right) => left.revision - right.revision);
  return grouped;
};

/** The latest answer per step: what the runner's settings currently say. */
export function latestWizardAnswers(answers: readonly WizardAnswerRecord[]): Partial<Record<WizardStepId, Record<string, unknown>>> {
  const result: Partial<Record<WizardStepId, Record<string, unknown>>> = {};
  for (const [stepId, list] of byStep(answers)) {
    const latest = list[list.length - 1];
    if (latest !== undefined) result[stepId] = latest.answer;
  }
  return result;
}

/** The first answer per step: what the runner originally chose, even after a change. */
export function originalWizardAnswers(answers: readonly WizardAnswerRecord[]): Partial<Record<WizardStepId, Record<string, unknown>>> {
  const result: Partial<Record<WizardStepId, Record<string, unknown>>> = {};
  for (const [stepId, list] of byStep(answers)) {
    const first = list[0];
    if (first !== undefined) result[stepId] = first.answer;
  }
  return result;
}

/** The revision a new answer to this step should carry. */
export function nextWizardRevision(answers: readonly WizardAnswerRecord[], stepId: WizardStepId): number {
  const list = byStep(answers).get(stepId) ?? [];
  const highest = list.reduce((max, answer) => Math.max(max, answer.revision), 0);
  return highest + 1;
}

/** The first required step with no answer yet, or null when the wizard is complete. */
export function nextWizardStep(answers: readonly WizardAnswerRecord[]): WizardStepId | null {
  const answered = new Set(answers.map((answer) => answer.stepId));
  for (const step of WIZARD_STEPS) {
    if (step.required && !answered.has(step.id)) return step.id;
  }
  return null;
}

export interface WizardProgress {
  answered: number;
  total: number;
  next: WizardStepId | null;
}

export function wizardProgress(answers: readonly WizardAnswerRecord[]): WizardProgress {
  const answered = new Set(answers.map((answer) => answer.stepId));
  return {
    answered: WIZARD_STEPS.filter((step) => answered.has(step.id)).length,
    total: WIZARD_STEPS.length,
    next: nextWizardStep(answers),
  };
}
