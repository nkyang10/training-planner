/**
 * Fixtures for the policy tests: a small, readable week and a minimal valid PlanVersion.
 *
 * The plan is hand-built rather than generated on purpose. A rule test has to know exactly which day is the
 * quality day and which day is rest; deriving that from the planner would make the policy test fail when the
 * planner changes for an unrelated reason, and then the failure message would point at the wrong file.
 */
import { loadKnowledge } from "@training-planner/knowledge";
import { addDays } from "@training-planner/planner-core";
import type { DayEntry, PlanVersion, Session, SessionKind } from "@training-planner/domain";

export const knowledge = loadKnowledge("knowledge/heuristics");

const UUID = "11111111-1111-4111-8111-111111111111";

export interface SessionSpec {
  day: string;
  kind: SessionKind;
  km: number;
  hard?: boolean;
  rpe?: number;
}

export function makePlan(spec: SessionSpec[], generatedAtDay = "2026-11-01"): PlanVersion {
  const sessions: Session[] = spec.map((item) => ({
    day: item.day,
    kind: item.kind,
    outcome: item.kind === "rest" ? "rest" : "planned",
    restDay: item.kind === "rest",
    summaryText: `${item.kind} ${item.km} km`,
    distanceKm: item.kind === "rest" ? null : item.km,
    hardDay: item.hard === true,
    targetRpe: item.rpe ?? null,
    ruleIds: [],
  }));
  const firstDay = sessions[0]?.day ?? generatedAtDay;
  const lastDay = sessions[sessions.length - 1]?.day ?? generatedAtDay;
  return {
    schemaVersion: 1,
    versionId: UUID,
    planId: UUID,
    userId: UUID,
    parentVersionId: null,
    generatedBy: "initial-build",
    generatedAtDay,
    firstDay,
    lastDay,
    plannerVersion: "test",
    knowledgeHash: knowledge.hash,
    inputsHash: knowledge.hash,
    sessions,
    appliedRules: [],
    clampedKnobs: [],
    assumptions: [],
    warnings: [],
  };
}

/**
 * Monday 2026-11-02 to Sunday 2026-11-08: one tempo day (Thu, hard), one long run (Sun), easy days between,
 * rest everywhere else. 35 km in the week, which makes a 20% downgrade a visible, checkable number.
 */
export const WEEK: SessionSpec[] = [
  { day: "2026-11-02", kind: "rest", km: 0 },
  { day: "2026-11-03", kind: "easy", km: 6 },
  { day: "2026-11-04", kind: "rest", km: 0 },
  { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-06", kind: "rest", km: 0 },
  { day: "2026-11-07", kind: "easy", km: 5 },
  { day: "2026-11-08", kind: "long", km: 14 },
];

export const weekPlan = (generatedAtDay = "2026-11-01"): PlanVersion => makePlan(WEEK, generatedAtDay);

export function makeEntry(overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    day: "2026-11-04",
    outcome: "completed",
    revision: 1,
    tzAtEvent: "Asia/Taipei",
    ...overrides,
  };
}

/** The day after `day`, so tests never compute dates by hand. */
export const nextDay = (day: string): string => addDays(day, 1);
