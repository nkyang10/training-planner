/**
 * The advisor's inputs and outputs, as types only.
 *
 * ADR-0009: the model decides **whether to propose a change**, never what the numbers are. This package owns the
 * request it is allowed to see and the proposal it is allowed to return; the deterministic validator in
 * `validate.ts` is what turns "the model said so" into "the engine agrees", and the runner's decision is still the
 * only thing that activates a plan version.
 *
 * Nothing here reads a clock, a network or a file: `today` is an argument and the model is a port (see `ModelPort`).
 */
import type { AthleteProfile, DayEntry, DayName, GuidelineContract, PlanVersion, SessionKind, Signal } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";

/** One recorded wizard answer, matching `wizard_answers` (ADR-0009). */
export interface WizardAnswer {
  stepId: string;
  answer: Record<string, unknown>;
  revision: number;
  source: "wizard" | "settings";
}

/** The runner's side of the comparison against the central guidelines. P2 fills the wizard steps; P1 carries them. */
export interface AdvisorSettings {
  riskAppetite: "conservative" | "moderate" | "aggressive" | null;
  weeklyHours: number | null;
  dislikedKinds: readonly SessionKind[];
  preferredLongDay: DayName | null;
}

export interface AdvisorInput {
  plan: PlanVersion;
  entries: readonly DayEntry[];
  signals?: readonly Signal[];
  wizardAnswers: readonly WizardAnswer[];
  settings: AdvisorSettings;
  /** Optional: the profile the planner would use after the answers. The model sees it so it reasons about the same body. */
  profile?: AthleteProfile;
  guidelines: readonly GuidelineContract[];
  /** The runner's training day, injected. */
  today: string;
  knowledge: KnowledgeBundle;
  /** The cost vocabulary the caller allows, from packages/policy's ADJUST_COST_KEYS. Passed in, not imported. */
  allowedCostKeys: readonly string[];
  /** The reason vocabulary the caller allows, so a new reason is a deliberate addition. */
  allowedReasonCodes: readonly string[];
}

/** A guideline as the model sees it: effective version only, no history. */
export interface GuidelineDigestRow {
  guidelineId: string;
  version: number;
  tier: "non-negotiable" | "constraint" | "default";
  scope: "safety" | "medical" | "progression" | "tone" | "review-cadence";
  visibility: "internal" | "public";
  text: string;
}

export interface AdvisorRequest {
  system: {
    /** The operator's effective guidelines, ordered by tier then id so the prompt is deterministic. */
    guidelines: GuidelineDigestRow[];
    /** The rules the model cannot break, restated in the request rather than only in the prompt prose. */
    rules: string[];
  };
  runner: {
    answers: WizardAnswer[];
    settings: AdvisorSettings;
    /** The profile the answers fold into (packages/domain's profileFromWizard), or null when it was not supplied. */
    profile: { goalType: string; riskAppetite: string | null; availabilityDays: DayName[] } | null;
    /** Answers the runner has changed, so the model can see a preference that moved rather than guess one. */
    revisedSteps: string[];
  };
  context: {
    today: string;
    planVersionId: string;
    firstDay: string;
    lastDay: string;
    /** Recent entries only, newest last, with pain and wellness as the runner reported them. */
    entries: Array<{ day: string; outcome: string; sessionTaken?: string; completedKm?: number | null; rpe?: number | null; pain: number | null }>;
    signals: Array<{ key: string; value: number | null; confidence: string; direction?: string }>;
  };
  vocabulary: {
    decisions: ["no-change", "propose-change"];
    reasonCodes: string[];
    costKeys: string[];
    sessionKinds: SessionKind[];
    maxChanges: 2;
    /** Days before this one may not change: today + freeze_window_days. */
    firstEditableDay: string;
    /** Planned kilometres per day, so the model proposes against what exists rather than inventing a baseline. */
    plannedKmByDay: Record<string, number>;
    hardDays: string[];
  };
}

export interface AdvisorHashes {
  guidelineVersionHash: string;
  promptHash: string;
  knowledgeHash: string;
}

export interface AdvisorCall {
  request: AdvisorRequest;
  hashes: AdvisorHashes;
}

/** The model is a port: tests use a fake, a deployment wires a provider behind consent and a budget. */
export interface ModelPort {
  /**
   * `context.userId` is optional for a fake and required by the HTTP port, which enforces the per-runner daily budget.
   * A port that needs it refuses without it rather than guessing.
   */
  complete(call: AdvisorCall, context?: { userId: string }): Promise<unknown>;
}
