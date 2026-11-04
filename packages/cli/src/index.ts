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
import { isLocale } from "@training-planner/i18n";
import { diffFiles, explainLines, explainWeekLines, knowledgeBundle, planFromFixture, readJson, readVersionFile, sweepLines } from "./commands";
import { submitEntry } from "@training-planner/entries";
import type { EntryDraft } from "@training-planner/entries";

const USAGE = `planner ${PLANNER_VERSION}

  planner gen --fixture <path> [--out <path>] [--canonical]
  planner diff --from <path> --to <path> --created <YYYY-MM-DD> [--reason <text>]
  planner explain --version <path> [--day <YYYY-MM-DD>] [--weeks [--locale en|zh-Hant]]
  planner sweep --fixture <path> --today <YYYY-MM-DD> [--entries <path>] [--closed <d1,d2>]

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
    weeks: { type: "boolean", default: false },
    today: { type: "string" },
    entries: { type: "string" },
    closed: { type: "string" },
    locale: { type: "string" },
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
  } else if (command === "sweep") {
    if (typeof values.fixture !== "string") fail("sweep needs --fixture <path>");
    if (typeof values.today !== "string") fail("sweep needs --today <YYYY-MM-DD>");
    const bundle = knowledgeBundle();
    const generated = planFromFixture(values.fixture, bundle);
    const entries: EntryDraft[] = [];
    if (typeof values.entries === "string") {
      const parsed = readJson(values.entries);
      if (!Array.isArray(parsed)) fail("--entries must point at a JSON array of entry drafts");
      for (const draft of parsed) entries.push(draft as EntryDraft);
    }
    // Submit the drafts through the real pipeline, so the sweep reads the log the system would actually hold.
    let log: import("@training-planner/domain").DayEntry[] = [];
    let events: import("@training-planner/domain").TrainingEvent[] = [];
    for (const draft of entries) {
      const result = submitEntry(draft, { entries: log, events }, {
        userId: generated.version.userId,
        today: values.today,
        occurredAt: `${values.today}T22:40:00.000Z`,
        knowledge: bundle,
      });
      if (result.status === "accepted") {
        log = [...log, result.entry];
        events = [...events, result.event];
      } else if (result.status === "rejected") {
        console.error(`planner: draft for ${draft.day} rejected: ${result.code} - ${result.detail}`);
      }
    }
    const closed = typeof values.closed === "string" ? values.closed.split(",").map((day) => day.trim()).filter((day) => day.length > 0) : [];
    // The event carries the runner's zone, so the fixture has to say it. A missing zone is an error, not a default.
    const fixtureProfile = (readJson(values.fixture) as { input?: { profile?: { preferences?: { timezone?: string } } } }).input?.profile;
    const timezone = fixtureProfile?.preferences?.timezone;
    if (typeof timezone !== "string") fail("the fixture has no profile.preferences.timezone");
    for (const line of sweepLines({ version: generated.version, entries: log, today: values.today, closed, timezone, knowledge: bundle })) {
      console.log(line);
    }
  } else if (command === "explain") {
    if (typeof values.version !== "string") fail("explain needs --version <path>");
    const version = readVersionFile(values.version);
    if (values.weeks === true) {
      const locale = values.locale ?? "en";
      if (!isLocale(locale)) fail(`unknown locale ${locale}; expected en or zh-Hant`);
      for (const line of explainWeekLines(version, locale)) if (line.length > 0) console.log(line);
    } else {
      for (const line of explainLines(version, values.day)) console.log(line);
    }
  } else {
    fail(`unknown command '${command}'\n\n${USAGE}`);
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
