/**
 * The planner's public surface. Phase M1 implements these; until then every function refuses, because a
 * planner that returns a plausible empty plan would let every golden fixture "pass" while proving
 * nothing.
 */
import type { DiffOptions, InvariantViolation, PlanDiff, PlanInput, PlanOutput, PlanVersion } from "./types";

export * from "./types";
export { canonicalJson, hashOf } from "@training-planner/knowledge/canonical";

export const PLANNER_VERSION = "0.1.0";

/** Passes 0-7 of docs/engine/planner-engine.md, deterministic in every input. */
export function generatePlan(_input: PlanInput): PlanOutput {
  throw new Error("generatePlan: not implemented yet (M1 in progress)");
}

/** ADR-0004: a diff may not touch a day at or before the base version's generation day. */
export function diffPlans(_from: PlanVersion, _to: PlanVersion, _options: DiffOptions): PlanDiff {
  throw new Error("diffPlans: not implemented yet (M1 in progress)");
}

/** The invariant set of AGENTS rules 3-5 and planner-engine section 6, as one call. */
export function checkInvariants(_output: PlanOutput): InvariantViolation[] {
  throw new Error("checkInvariants: not implemented yet (M1 in progress)");
}
