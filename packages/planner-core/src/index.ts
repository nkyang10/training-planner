/**
 * The planner's public surface. `generatePlan` is the product; everything else exists to prove it or to
 * explain a change to it.
 */
export { generatePlan } from "./plan";
export { checkInvariants } from "./invariants";
export type { InvariantOptions } from "./invariants";
export { diffPlans } from "./diff";
export { PLANNER_VERSION } from "./version";
export { canonicalJson, hashOf } from "@training-planner/knowledge/canonical";
export * from "./types";
export * from "./civil";
export { uuidFrom } from "./uuid";
