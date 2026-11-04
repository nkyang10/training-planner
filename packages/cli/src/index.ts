#!/usr/bin/env node
/**
 * planner gen | diff | explain
 *
 * argv handling, printing and exit codes only; the work is in commands.ts so it can be tested without
 * spawning a process. A CLI exists before a UI on purpose: it is the only consumer that runs in CI, it
 * makes a plan diffable in review, and it forces the engine to be usable through its public surface.
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { PLANNER_VERSION } from "@training-planner/planner-core";
import { diffFiles, explainLines, planFromFixture, readVersionFile } from "./commands";

const USAGE = `planner ${PLANNER_VERSION}

  planner gen --fixture <path> [--out <path>] [--canonical]
  planner diff --from <path> --to <path> --created <YYYY-MM-DD> [--reason <text>]
  planner explain --version <path> [--day <YYYY-MM-DD>]

Paths are relative to the working directory. Knowledge is always read from knowledge/heuristics and
never from a flag: a plan that could name a knowledge version this repository does not have would be
unexplainable by construction.`;

function fail(message: string): never {
  console.error(`planner: ${message}`);
  process.exit(1);
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

try {
  if (command === "gen") {
    if (typeof values.fixture !== "string") fail("gen needs --fixture <path>");
    const generated = planFromFixture(values.fixture);
    const text = values.canonical === true ? generated.canonical : JSON.stringify(generated.version, null, 2);
    if (typeof values.out === "string") writeFileSync(values.out, `${text}\n`, "utf8");
    else console.log(text);
    console.error(`planner: ${generated.version.sessions.length} sessions, ${generated.version.firstDay}..${generated.version.lastDay}`);
    console.error(`planner: knowledge ${generated.version.knowledgeHash.slice(0, 16)}..., plan ${generated.planHash.slice(0, 16)}...`);
    console.error(`planner: ${generated.violations.length === 0 ? "invariants hold" : `${generated.violations.length} invariant violations`}`);
    for (const violation of generated.violations) console.error(`  ${violation.invariant}: ${violation.detail}`);
    if (generated.violations.length > 0) process.exit(1);
  } else if (command === "diff") {
    if (typeof values.from !== "string" || typeof values.to !== "string" || typeof values.created !== "string") {
      fail("diff needs --from <path> --to <path> --created <YYYY-MM-DD>");
    }
    const diff = diffFiles(values.from, values.to, values.created, values.reason);
    console.log(JSON.stringify(diff, null, 2));
    console.error(`planner: ${diff.changes.length} change(s), within the two-change limit: ${diff.changeCountWithinLimit}`);
  } else if (command === "explain") {
    if (typeof values.version !== "string") fail("explain needs --version <path>");
    for (const line of explainLines(readVersionFile(values.version), values.day)) console.log(line);
  } else {
    fail(`unknown command '${command}'\n\n${USAGE}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
