/**
 * The CLI's work, separated from its argv handling so it can be tested without spawning a process.
 *
 * Every function here returns data or throws; printing and exit codes live in index.ts. The separation is
 * not tidiness: it is what makes "the CLI works" a claim a test can check instead of a claim a screenshot
 * can make.
 */
import { readFileSync } from "node:fs";
import { athleteProfileSchema, planVersionSchema } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { canonicalJson, hashOf } from "@training-planner/knowledge/canonical";
import { checkInvariants, diffPlans, generatePlan } from "@training-planner/planner-core";
import { renderPlanExplanation } from "@training-planner/narrator";
import { runNightlySweep } from "@training-planner/worker";
import type { Locale } from "@training-planner/i18n";
import type { DayEntry } from "@training-planner/domain";
import type { InvariantViolation, PlanDiff, PlanInput, PlanVersion } from "@training-planner/planner-core";
import { fixtureSchema } from "../../../eval/golden-plans/fixture";

export const KNOWLEDGE_DIR = "knowledge/heuristics";

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function knowledgeBundle(directory = KNOWLEDGE_DIR): KnowledgeBundle {
  return loadKnowledge(directory);
}

export interface GeneratedPlan {
  version: PlanVersion;
  violations: InvariantViolation[];
  planHash: string;
  canonical: string;
}

/** Generate a plan from a golden fixture, through the fixture format and the profile contract. */
export function planFromFixture(fixturePath: string, bundle: KnowledgeBundle = knowledgeBundle()): GeneratedPlan {
  const fixture = fixtureSchema.safeParse(readJson(fixturePath));
  if (!fixture.success) throw new Error(`fixture ${fixturePath} is not a golden fixture: ${fixture.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const profile = athleteProfileSchema.safeParse(fixture.data.input.profile);
  if (!profile.success) throw new Error(`fixture profile does not satisfy athlete-profile.schema.json: ${profile.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const input: PlanInput = {
    profile: profile.data,
    evidence: fixture.data.input.evidence,
    state: fixture.data.input.state,
    clock: fixture.data.input.clock,
    seed: fixture.data.input.seed,
    knowledge: bundle,
  };
  const output = generatePlan(input);
  return {
    version: output.version,
    violations: checkInvariants(output, { knowledge: bundle }),
    planHash: hashOf(output.version),
    canonical: canonicalJson(output.version),
  };
}

/** Read a plan version through the wire contract: a file the contract rejects is not a plan. */
export function readVersionFile(path: string): PlanVersion {
  const parsed = planVersionSchema.safeParse(readJson(path));
  if (!parsed.success) throw new Error(`${path} is not a plan version: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  return parsed.data;
}

export function diffFiles(fromPath: string, toPath: string, createdAtDay: string, reason?: string): PlanDiff {
  const from = readVersionFile(fromPath);
  const to = readVersionFile(toPath);
  return diffPlans(from, to, {
    createdAtDay,
    knowledgeHash: to.knowledgeHash,
    maxChanges: 2,
    ...(reason === undefined ? {} : { reason }),
  });
}

/**
 * The runner-facing explanation of the whole block: what it is, the week that peaks, and - when the plan
 * begins or ends mid-week - the 7-day-normalised rate that makes the first week comparable instead of
 * alarming (M1 review finding F3). Same guardrails as a comment, because it is read by the same person.
 */
export function explainWeekLines(version: PlanVersion, locale: Locale = "en"): string[] {
  const explanation = renderPlanExplanation(version, { locale });
  return [...explanation.sentences, ""];
}

/** The lines `planner explain` prints. Pure, so a test can read them. */
export function explainLines(version: PlanVersion, day?: string): string[] {
  const sessions = day ? version.sessions.filter((session) => session.day === day) : version.sessions;
  if (day && sessions.length === 0) throw new Error(`no session on ${day} in this plan version`);
  const lines: string[] = [];
  for (const session of sessions) {
    lines.push(`${session.day}  ${session.kind}  ${session.distanceKm ?? "-"} km  ${session.summaryText}`);
    lines.push(`  rules: ${(session.ruleIds ?? []).join(", ") || "none recorded"}`);
    lines.push(`  effort: RPE ${session.targetRpe ?? "-"} (primary target ${session.primaryTarget ?? "-"})`);
    if (session.targetPaceMinSecPerKm && session.targetPaceMaxSecPerKm) {
      lines.push(`  pace: ${session.targetPaceMinSecPerKm}-${session.targetPaceMaxSecPerKm} s/km`);
    }
  }
  lines.push("");
  lines.push(`knowledge ${version.knowledgeHash}`);
  lines.push(`planner ${version.plannerVersion}, generated ${version.generatedAtDay}, ${version.sessions.length} sessions`);
  const applied = version.appliedRules.filter((rule) => (day ? (rule.daysAffected ?? []).includes(day) : true));
  if (applied.length > 0) {
    lines.push("applied rules:");
    for (const rule of applied) lines.push(`  ${rule.ruleId} (${rule.effect}${rule.isSafety ? ", safety" : ""}) ${rule.anchor}`);
  }
  for (const assumption of version.assumptions) lines.push(`assumption: ${assumption.id} - ${assumption.detail}`);
  for (const warning of version.warnings) lines.push(`warning: ${warning.id} - ${warning.detail}`);
  return lines;
}

/**
 * The lines `planner sweep` prints: what the nightly sweep would close, what it would leave pending, and the
 * cache key of the bundle it would snapshot. Read-only: the CLI never writes a rollup, and the sweep itself
 * returns data rather than events (the catalogue has no day-close event type yet - backlog row 18).
 */
export function sweepLines(input: {
  version: PlanVersion;
  entries: readonly DayEntry[];
  today: string;
  closed?: readonly string[];
  knowledge: KnowledgeBundle;
}): string[] {
  const result = runNightlySweep({
    userId: input.version.userId,
    today: input.today,
    entries: input.entries,
    plan: input.version,
    knowledge: input.knowledge,
    computedAt: `${input.today}T03:00:00.000Z`,
    closedDays: input.closed ?? [],
  });

  const lines: string[] = [];
  lines.push(`closed: ${result.newlyClosed.length === 0 ? "none" : result.newlyClosed.map((closed) => closed.day).join(", ")}`);
  for (const closed of result.newlyClosed) {
    lines.push(`  ${closed.day} ${closed.status} planned=${closed.plannedKm}km done=${closed.completedKm}km`);
  }
  lines.push(`pending: ${result.pending.length === 0 ? "none" : result.pending.join(", ")}`);
  if (result.skipped.length > 0) lines.push(`skipped: ${result.skipped.join(", ")}`);
  lines.push(
    result.signalCache === null
      ? "cache: none (the plan does not cover the sweep day)"
      : `cache: asOfDay=${result.signalCache.asOfDay} signals=${result.signalCache.signals.length} inputsHash=${result.signalCache.inputsHash.slice(0, 16)}...`,
  );
  return lines;
}