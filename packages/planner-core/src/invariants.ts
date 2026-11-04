/**
 * The invariant set, as one call. Each check can fail on its own, and each one is exercised by a
 * deliberately broken plan in test/invariants.test.ts: an invariant that has never been red is a comment
 * with a boolean in front of it.
 *
 * Knob-dependent checks are skipped when no knowledge bundle is supplied rather than guessed at, so a
 * caller that cares passes the bundle and a caller that does not gets the structural checks only.
 */
import type { PlanVersion, Session } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import type { InvariantViolation, PlanOutput } from "./types";
import { addDays, daysBetween, weekStart } from "./civil";

export interface InvariantOptions {
  knowledge?: KnowledgeBundle;
  /**
   * The plan this one was derived from, when it is a review candidate rather than a fresh build.
   *
   * With a base, the weekly-increment check answers "does this plan add load relative to the plan the runner was
   * already on?" instead of "is the recomputed ratio above the ceiling?". The difference matters: reducing week N
   * lowers the base of week N+1, so the second question fires on a week whose absolute load never changed, and the
   * review engine would refuse the very reduction it exists to offer.
   */
  baseVersion?: PlanVersion;
}

const ROUNDING_TOLERANCE_KM = 0.11;
const QUALITY_KINDS = new Set(["tempo", "vo2max", "hills", "mp", "test", "race"]);

export function checkInvariants(output: PlanOutput, options: InvariantOptions = {}): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const { version } = output;
  const sessions = version.sessions;

  checkOnePerDay(version, sessions, violations);
  checkOrder(sessions, violations);
  checkRestIsRest(sessions, violations);
  const hardDays = checkSpacing(sessions, violations);
  checkHardCap(hardDays, violations);
  checkVolumeCurve(sessions, options.knowledge, options.baseVersion, violations);
  checkSafetySubtracts(version, sessions, violations);
  return violations;
}

function checkOnePerDay(version: PlanVersion, sessions: Session[], violations: InvariantViolation[]): void {
  const seen = new Set<string>();
  const duplicated: string[] = [];
  for (const session of sessions) {
    if (seen.has(session.day)) duplicated.push(session.day);
    seen.add(session.day);
  }
  if (duplicated.length > 0) {
    violations.push({ invariant: "one-session-per-day", detail: "a day carries more than one session", days: duplicated });
  }

  const expected: string[] = [];
  let day = version.firstDay;
  while (day <= version.lastDay) {
    expected.push(day);
    day = addDays(day, 1);
  }
  const missing = expected.filter((candidate) => !seen.has(candidate));
  if (missing.length > 0) {
    violations.push({ invariant: "no-gaps", detail: "a day in the horizon has no session at all", days: missing });
  }
}

function checkOrder(sessions: Session[], violations: InvariantViolation[]): void {
  for (let index = 1; index < sessions.length; index += 1) {
    const previous = sessions[index - 1];
    const current = sessions[index];
    if (!previous || !current) continue;
    if (previous.day >= current.day) {
      violations.push({ invariant: "sorted-and-unique", detail: `session ${index} is not after the one before it`, days: [current.day] });
      return;
    }
  }
}

function checkRestIsRest(sessions: Session[], violations: InvariantViolation[]): void {
  for (const session of sessions) {
    if (session.restDay && session.kind !== "rest") {
      violations.push({ invariant: "rest-is-rest", detail: "restDay is true but the session is not a rest day", days: [session.day] });
    }
    if (session.kind === "rest" && session.outcome !== "rest") {
      violations.push({ invariant: "rest-is-rest", detail: "a rest session does not carry outcome rest", days: [session.day] });
    }
  }
}

function isHard(session: Session): boolean {
  return session.hardDay === true || QUALITY_KINDS.has(session.kind);
}

function checkSpacing(sessions: Session[], violations: InvariantViolation[]): string[] {
  const hardDays = sessions.filter(isHard).map((session) => session.day).sort();
  for (let index = 1; index < hardDays.length; index += 1) {
    const previous = hardDays[index - 1];
    const current = hardDays[index];
    if (!previous || !current) continue;
    const hours = Math.abs(daysBetween(previous, current)) * 24;
    if (hours < 48) {
      violations.push({ invariant: "hard-day-spacing", detail: `${hours} h between hard days`, days: [previous, current] });
    }
  }
  return hardDays;
}

function checkHardCap(hardDays: string[], violations: InvariantViolation[]): void {
  const perWeek = new Map<string, string[]>();
  for (const day of hardDays) {
    const key = weekStart(day);
    perWeek.set(key, [...(perWeek.get(key) ?? []), day]);
  }
  for (const [key, days] of perWeek) {
    if (days.length > 2) {
      violations.push({ invariant: "hard-days-cap", detail: `${days.length} hard days in the week of ${key}`, days });
    }
  }
}

function checkVolumeCurve(
  sessions: Session[],
  knowledge: KnowledgeBundle | undefined,
  baseVersion: PlanVersion | undefined,
  violations: InvariantViolation[],
): void {
  if (!knowledge) return;
  // Normalise every week to a 7-day equivalent before comparing: a horizon that starts on a Thursday
  // has a four-day first week, and comparing its raw sum with the next full week would flag a jump that
  // is an artefact of the calendar rather than an increase in load.
  const totals = new Map<string, { km: number; days: number }>();
  for (const session of sessions) {
    const key = weekStart(session.day);
    const current = totals.get(key) ?? { km: 0, days: 0 };
    totals.set(key, { km: current.km + (session.distanceKm ?? 0), days: current.days + 1 });
  }
  const perWeek = new Map<string, { rate: number; days: number }>();
  for (const [key, total] of totals) perWeek.set(key, { rate: total.days === 0 ? 0 : (total.km * 7) / total.days, days: total.days });
  // When a base plan is present, each week is compared against the base plan week that preceded it: a change to
  // week N is judged by whether the following week adds load, not by the ratio the reduction created.
  const basePerWeek = new Map<string, { rate: number; days: number }>();
  if (baseVersion !== undefined) {
    const baseTotals = new Map<string, { km: number; days: number }>();
    for (const session of baseVersion.sessions) {
      const key = weekStart(session.day);
      const current = baseTotals.get(key) ?? { km: 0, days: 0 };
      baseTotals.set(key, { km: current.km + (session.distanceKm ?? 0), days: current.days + 1 });
    }
    for (const [key, total] of baseTotals) {
      basePerWeek.set(key, { rate: total.days === 0 ? 0 : (total.km * 7) / total.days, days: total.days });
    }
  }
  const incrementPct = knowledge.number("load-progression.yaml#weekly_increment_pct");
  const incrementKmAbs = knowledge.number("load-progression.yaml#weekly_increment_km_abs");
  const keys = [...perWeek.keys()].sort();
  for (let index = 1; index < keys.length; index += 1) {
    const previousKey = keys[index - 1];
    const currentKey = keys[index];
    if (!previousKey || !currentKey) continue;
    const previous = perWeek.get(previousKey);
    const current = perWeek.get(currentKey);
    if (!previous || !current) continue;
    // The baseline is the base plan week when the base had one: that is the load the runner was already on.
    const baseline = basePerWeek.get(previousKey) ?? previous;
    // A week with no running day has no rate to grow from: a horizon can begin on a single rest day, and
    // a percentage ceiling computed from zero would flag the first real week as a jump. The check starts
    // at the first week that carried load.
    if (baseline.rate <= 0) continue;
    const delta = current.rate - baseline.rate;
    if (delta <= 0) continue;
    const ceiling = Math.min((baseline.rate * incrementPct) / 100, incrementKmAbs);
    // Distances are rounded to 0.1 km per session, so a rate carries at most 0.05 * 7 / days of error.
    // A tolerance that ignored that would flag rounding as a training error, and a gate that cries wolf
    // gets switched off.
    const tolerance = ROUNDING_TOLERANCE_KM + (0.05 * 7) / baseline.days + (0.05 * 7) / current.days;
    if (delta > ceiling + tolerance) {
      violations.push({
        invariant: "weekly-increment-ceiling",
        detail: `week of ${currentKey} adds ${delta.toFixed(2)} km/wk, ceiling is ${ceiling.toFixed(2)} km`,
        days: [currentKey],
      });
    }
  }
}

function checkSafetySubtracts(version: PlanVersion, sessions: Session[], violations: InvariantViolation[]): void {
  for (const rule of version.appliedRules) {
    if (rule.isSafety !== true) continue;
    if (rule.effect !== "subtracted") {
      violations.push({ invariant: "safety-subtracts-only", detail: `safety rule ${rule.ruleId} has effect ${rule.effect}` });
    }
    for (const day of rule.daysAffected ?? []) {
      const session = sessions.find((candidate) => candidate.day === day);
      if (session && isHard(session)) {
        violations.push({ invariant: "safety-subtracts-only", detail: `safety rule ${rule.ruleId} left a hard session on ${day}`, days: [day] });
      }
    }
  }
}
