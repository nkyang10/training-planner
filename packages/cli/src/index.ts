#!/usr/bin/env node
/**
 * planner gen | diff | explain
 *
 * A CLI exists before a UI on purpose: it is the only consumer that runs in CI, it makes a plan
 * diffable in review, and it forces the engine to be usable through its public surface rather than
 * through a test's private back door. The CLI never computes a session itself: the plan comes from
 * generatePlan and the diff from diffPlans, so a bug here cannot invent a session.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { athleteProfileSchema, planVersionSchema } from "@training-planner/domain";
import { canonicalJson, hashOf } from "@training-planner/knowledge/canonical";
import { loadKnowledge } from "@training-planner/knowledge";
import { checkInvariants, diffPlans, generatePlan, PLANNER_VERSION } from "@training-planner/planner-core";
import type { PlanInput, PlanVersion } from "@training-planner/planner-core";
import { fixtureSchema } from "../../../eval/golden-plans/fixture";

const USAGE = `planner ${PLANNER_VERSION}

  planner gen --fixture <path> [--out <path>] [--canonical]
  planner diff --from <path> --to <path> --created <YYYY-MM-DD> [--reason <text>]
  planner explain --version <path> [--day <YYYY-MM-DD>]

Paths are relative to the working directory. Knowledge is always read from knowledge/heuristics and
never from a flag: a plan that could name a knowledge version this repository does not have would be
unexplainable by construction.`;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fail(message: string): never {
  console.error(`planner: ${message}`);
  process.exit(1);
}

function knowledge() {
  return loadKnowledge("knowledge/heuristics");
}

function issues(error: { issues: { path: (string | number)[]; message: string }[] }): string {
  return error.issues.map((issue) => `  ${issue.path.join(".") || "<root>"}: ${issue.message}`).join("\n");
}

function commandGen(options: Record<string, string | boolean | undefined>): void {
  const fixturePath = typeof options.fixture === "string" ? options.fixture : fail("gen needs --fixture <path>");
  const parsed = fixtureSchema.safeParse(readJson(fixturePath));
  if (!parsed.success) fail(`fixture ${fixturePath} is not a golden fixture:\n${issues(parsed.error)}`);
  const profile = athleteProfileSchema.safeParse(parsed.data.input.profile);
  if (!profile.success) fail(`fixture profile does not satisfy athlete-profile.schema.json:\n${issues(profile.error)}`);
  const bundle = knowledge();
  const input: PlanInput = {
    profile: profile.data,
    evidence: parsed.data.input.evidence,
    state: parsed.data.input.state,
    clock: parsed.data.input.clock,
    seed: parsed.data.input.seed,
    knowledge: bundle,
  };
  const output = generatePlan(input);
  const violations = checkInvariants(output, { knowledge: bundle });
  const text = options.canonical === true ? canonicalJson(output.version) : JSON.stringify(output.version, null, 2);
  if (typeof options.out === "string") writeFileSync(options.out, `${text}\n`, "utf8");
  else console.log(text);

  console.error(`planner: ${output.version.sessions.length} sessions, ${output.version.firstDay}..${output.version.lastDay}`);
  console.error(`planner: knowledge ${output.version.knowledgeHash.slice(0, 16)}..., plan ${hashOf(output.version).slice(0, 16)}...`);
  console.error(`planner: ${violations.length === 0 ? "invariants hold" : `${violations.length} invariant violations`}`);
  for (const violation of violations) console.error(`  ${violation.invariant}: ${violation.detail}`);
  if (violations.length > 0) process.exit(1);
}

function readVersion(path: string): PlanVersion {
  const parsed = planVersionSchema.safeParse(readJson(path));
  if (!parsed.success) fail(`${path} is not a plan version:\n${issues(parsed.error)}`);
  return parsed.data;
}

function commandDiff(options: Record<string, string | boolean | undefined>): void {
  const fromPath = typeof options.from === "string" ? options.from : fail("diff needs --from <path>");
  const toPath = typeof options.to === "string" ? options.to : fail("diff needs --to <path>");
  const createdAtDay = typeof options.created === "string" ? options.created : fail("diff needs --created <YYYY-MM-DD>");
  const from = readVersion(fromPath);
  const to = readVersion(toPath);
  const diff = diffPlans(from, to, {
    createdAtDay,
    knowledgeHash: to.knowledgeHash,
    maxChanges: 2,
    ...(typeof options.reason === "string" ? { reason: options.reason } : {}),
  });
  console.log(JSON.stringify(diff, null, 2));
  console.error(`planner: ${diff.changes.length} change(s), within the two-change limit: ${diff.changeCountWithinLimit}`);
}

function commandExplain(options: Record<string, string | boolean | undefined>): void {
  const versionPath = typeof options.version === "string" ? options.version : fail("explain needs --version <path>");
  const version = readVersion(versionPath);
  const day = typeof options.day === "string" ? options.day : null;
  const sessions = day ? version.sessions.filter((session) => session.day === day) : version.sessions;
  if (day && sessions.length === 0) fail(`no session on ${day} in this plan version`);
  for (const session of sessions) {
    console.log(`${session.day}  ${session.kind}  ${session.distanceKm ?? "-"} km  ${session.summaryText}`);
    console.log(`  rules: ${(session.ruleIds ?? []).join(", ") || "none recorded"}`);
    console.log(`  effort: RPE ${session.targetRpe ?? "-"} (primary target ${session.primaryTarget ?? "-"})`);
    if (session.targetPaceMinSecPerKm && session.targetPaceMaxSecPerKm) {
      console.log(`  pace: ${session.targetPaceMinSecPerKm}-${session.targetPaceMaxSecPerKm} s/km`);
    }
  }
  console.log("");
  console.log(`knowledge ${version.knowledgeHash}`);
  console.log(`planner ${version.plannerVersion}, generated ${version.generatedAtDay}, ${version.sessions.length} sessions`);
  const applied = version.appliedRules.filter((rule) => (day ? (rule.daysAffected ?? []).includes(day) : true));
  if (applied.length > 0) {
    console.log("applied rules:");
    for (const rule of applied) console.log(`  ${rule.ruleId} (${rule.effect}${rule.isSafety ? ", safety" : ""}) ${rule.anchor}`);
  }
  for (const assumption of version.assumptions) console.log(`assumption: ${assumption.id} - ${assumption.detail}`);
  for (const warning of version.warnings) console.log(`warning: ${warning.id} - ${warning.detail}`);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    fixture: { type: "string" },
    out: { type: "string" },
    canonical: { type: "boolean", default: false },
    from: { type: "string" },
    to: { type: "string" },
    created: { type: "string" },
    reason: { type: "string" },
    version: { type: "string" },
    day: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

const command = positionals[0];
if (!command || values.help) {
  console.log(USAGE);
  process.exit(command ? 0 : 1);
}

if (command === "gen") commandGen(values);
else if (command === "diff") commandDiff(values);
else if (command === "explain") commandExplain(values);
else fail(`unknown command '${command}'\n\n${USAGE}`);
