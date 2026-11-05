import { canonicalJson, hashOf } from "@training-planner/knowledge";
import type { CoachReference } from "./corpus";

/** A stable hash of the selected references, so an audited review can prove which guidance the model saw. */
export function referenceHash(references: readonly CoachReference[]): string {
  return hashOf(canonicalJson(references));
}
