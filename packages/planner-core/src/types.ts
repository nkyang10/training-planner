/**
 * The frozen signature of the planner. Everything downstream (client, CLI, golden fixtures, eval) is
 * written against this file, so a change here is a change to the product, not a refactor.
 *
 * Frozen 2026-11-04 against docs/engine/planner-engine.md section 1, which is the only input list that
 * distinguishes *evidence* (computed, read-only) from *state* (what the current plan's reality is).
 * packages/planner-core/README.md and the M1 branch brief still said `{ profile, history, calendar,
 * feedback }`; those two documents were the disagreement, and they were corrected to match this.
 */
import type { AthleteProfile, PlanDiff, PlanVersion } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";

/** Pass 0's authority chain: race -> field test -> self-report -> population default. */
export interface Evidence {
  /** Actual sustained weekly volume, oldest first, km. Never the stated aspiration (Pass 2). */
  recentWeeklyKm: number[];
  /** Days since the runner last trained regularly; above zero means the post-layoff ceiling applies. */
  layoffDays?: number;
  /** The pace authority for Pass 0, seconds per km. Null means "derive from a population default". */
  baselinePaceSecPerKm?: number | null;
  baselineConfidence?: "low" | "medium" | "high";
}

/** What the current plan's reality is, not what the runner wishes it were. */
export interface PlanState {
  planStartDay: string;
  horizonDays: number;
  /** Days already completed, as `YYYY-MM-DD`. Pass 7 may not move them (AGENTS rule 4). */
  completedDays?: string[];
}

/** Present only when this generation is a review (ADR-0005): never more than two changes. */
export interface RevisionRequest {
  reason: string;
  maxChanges: 1 | 2;
  signalIds: string[];
}

export interface PlanInput {
  profile: AthleteProfile;
  evidence: Evidence;
  state: PlanState;
  /** Injected, never read from the wall clock (AGENTS rule 1). */
  clock: { today: string };
  /** Injected, never drawn (AGENTS rule 1). Ties are broken by documented ordering, not by hash order. */
  seed: string;
  knowledge: KnowledgeBundle;
  revisionRequest?: RevisionRequest;
}

export interface PlanOutput {
  /** The wire contract: schemas/json/plan-version.schema.json. One source of truth for sessions too. */
  version: PlanVersion;
  /** At most three, asked one at a time in the UI (planner-engine section 2). */
  openQuestions: string[];
}

export interface InvariantViolation {
  /** The invariant's stable name, e.g. `hard-day-spacing`. */
  invariant: string;
  detail: string;
  days?: string[];
}

export interface DiffOptions {
  createdAtDay: string;
  knowledgeHash: string;
  /** Present for a safety-originated diff, which may only subtract (AGENTS rule 3). */
  isSafety?: boolean;
  maxChanges?: 1 | 2;
  /** Why the review happened, in the runner's terms. Recorded on every change it produces. */
  reason?: string;
  /** The signals that justified the review; the contract requires one signalId per change. */
  signalIds?: string[];
  /** What the runner gives up by accepting the change. A diff without a cost is a sales pitch. */
  expectedCost?: string;
  /** The knowledge knobs the change used, so the change can be explained later. */
  knobsUsed?: string[];
}

export type { PlanDiff, PlanVersion };
