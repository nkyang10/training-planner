import { join } from "node:path";
import type { AthleteProfile } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import type { Evidence, PlanInput } from "../src/types";

/** The real corpus, not a fixture bundle: the golden plans must fail when knowledge changes. */
export const knowledge: KnowledgeBundle = loadKnowledge(join(process.cwd(), "knowledge", "heuristics"));

export const baseProfile: AthleteProfile = {
  userId: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  age: 33,
  availability: { days: ["Mon", "Wed", "Fri", "Sun"] },
  goal: { type: "finish", event: null },
  preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
  health: {},
};

export const baseEvidence: Evidence = {
  recentWeeklyKm: [30, 32, 31],
  layoffDays: 0,
  baselinePaceSecPerKm: 330,
  baselineConfidence: "medium",
};

export function makeInput(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    profile: overrides.profile ?? baseProfile,
    evidence: overrides.evidence ?? baseEvidence,
    state: overrides.state ?? { planStartDay: "2026-11-05", horizonDays: 42 },
    clock: overrides.clock ?? { today: "2026-11-04" },
    seed: overrides.seed ?? "test-seed",
    knowledge: overrides.knowledge ?? knowledge,
    ...(overrides.revisionRequest ? { revisionRequest: overrides.revisionRequest } : {}),
  };
}
