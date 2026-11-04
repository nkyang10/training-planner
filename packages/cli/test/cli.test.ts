/**
 * The CLI is the only consumer that runs in CI, so it is the one place where "it works" is cheap to prove.
 * These tests call the command functions directly rather than spawning a process: a spawn test proves the
 * argv wiring, a function test proves the work, and the work is what can be wrong quietly.
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { GOLDEN_FIXTURE_COUNT } from "@training-planner/golden-fixtures";
import { planVersionSchema } from "@training-planner/domain";
import { canonicalJson } from "@training-planner/knowledge/canonical";
import { checkInvariants } from "@training-planner/planner-core";
import { diffFiles, explainLines, explainWeekLines, knowledgeBundle, planFromFixture, readVersionFile, sweepLines } from "../src/commands";
import { makeEntry } from "../../policy/test/helpers";

const directory = join(process.cwd(), "eval", "golden-plans");
const scratch = mkdtempSync(join(tmpdir(), "tp-cli-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const bundle = knowledgeBundle();

describe("planner gen", () => {
  const fixtures = [
    "novice-5k",
    "competitive-marathon",
    "masters-40",
    "three-days-a-week",
    "returning-after-layoff",
    "trail-ultra",
    "two-phase-10k",
    "novice-first-quality-strides",
  ];
  it(`generates a valid, invariant-clean plan for all ${GOLDEN_FIXTURE_COUNT} fixtures`, () => {
    expect(fixtures.length).toBe(GOLDEN_FIXTURE_COUNT);
    for (const id of fixtures) {
      const generated = planFromFixture(join(directory, `${id}.json`), bundle);
      expect(generated.violations).toEqual([]);
      const parsed = planVersionSchema.safeParse(generated.version);
      expect(parsed.success, `${id}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3))}`).toBe(true);
      expect(generated.canonical).toBe(canonicalJson(generated.version));
      expect(generated.planHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("refuses a file that is not a golden fixture", () => {
    const broken = join(scratch, "not-a-fixture.json");
    writeFileSync(broken, JSON.stringify({ id: "x" }), "utf8");
    expect(() => planFromFixture(broken, bundle)).toThrow(/not a golden fixture/);
  });
});

describe("planner diff", () => {
  it("reports no change between two generations of the same fixture", () => {
    const first = planFromFixture(join(directory, "novice-5k.json"), bundle);
    const firstPath = join(scratch, "first.json");
    const secondPath = join(scratch, "second.json");
    writeFileSync(firstPath, JSON.stringify(first.version), "utf8");
    writeFileSync(secondPath, JSON.stringify(first.version), "utf8");
    const diff = diffFiles(firstPath, secondPath, "2026-11-04");
    expect(diff.changes).toEqual([]);
    expect(diff.changeCountWithinLimit).toBe(true);
    expect(readVersionFile(firstPath).versionId).toBe(first.version.versionId);
  });

  it("refuses a file that is not a plan version", () => {
    const broken = join(scratch, "not-a-version.json");
    writeFileSync(broken, JSON.stringify({ hello: "world" }), "utf8");
    expect(() => readVersionFile(broken)).toThrow(/not a plan version/);
  });
});

describe("planner explain --weeks", () => {
  it("states the partial first week with its normalised rate", () => {
    const generated = planFromFixture(join(directory, "novice-5k.json"), bundle);
    const lines = explainWeekLines(generated.version, "en").join(" ");
    expect(lines).toContain("partial");
    expect(lines).toContain("6.8");
    expect(lines).toContain("3.9");
  });

  it("speaks Traditional Chinese when asked", () => {
    const generated = planFromFixture(join(directory, "novice-5k.json"), bundle);
    const lines = explainWeekLines(generated.version, "zh-Hant").join(" ");
    expect(lines).toMatch(/[\\u4e00-\\u9fff]/);
  });
});

describe("planner sweep", () => {
  it("closes the days before the sweep day and names the gaps", () => {
    const generated = planFromFixture(join(directory, "novice-5k.json"), bundle);
    const firstDay = generated.version.firstDay;
    const lines = sweepLines({
      version: generated.version,
      entries: [makeEntry({ day: firstDay, outcome: "completed" })],
      today: generated.version.sessions[2]?.day ?? firstDay,
      timezone: "Asia/Taipei",
      knowledge: bundle,
    }).join("\n");
    expect(lines).toContain("closed: ");
    expect(lines).toContain(`${firstDay} logged`);
    expect(lines).toContain("pending: ");
    expect(lines).toMatch(/cache: asOfDay=\d{4}-\d{2}-\d{2} signals=\d+ inputsHash=sha256:/);
  });

  it("is idempotent: a sweep with the days already closed reports none", () => {
    const generated = planFromFixture(join(directory, "novice-5k.json"), bundle);
    const today = generated.version.sessions[2]?.day ?? generated.version.firstDay;
    const first = sweepLines({ version: generated.version, entries: [], today, timezone: "Asia/Taipei", knowledge: bundle });
    const closed = first
      .filter((line) => /^\s{2}\d{4}-\d{2}-\d{2} /.test(line))
      .map((line) => line.trim().split(" ")[0] as string);
    const second = sweepLines({ version: generated.version, entries: [], today, closed, timezone: "Asia/Taipei", knowledge: bundle }).join("\n");
    expect(second).toContain("closed: none");
    expect(second).toContain("skipped: ");
  });
});

describe("planner explain", () => {
  it("explains one day with its rules and the knowledge it used", () => {
    const generated = planFromFixture(join(directory, "novice-5k.json"), bundle);
    const day = generated.version.sessions[0]?.day;
    if (!day) throw new Error("no sessions");
    const lines = explainLines(generated.version, day);
    expect(lines[0]).toContain(day);
    expect(lines.join("\n")).toContain(generated.version.knowledgeHash);
    expect(lines.join("\n")).toContain("assumption:");
  });

  it("refuses a day that is not in the plan", () => {
    const generated = planFromFixture(join(directory, "novice-5k.json"), bundle);
    expect(() => explainLines(generated.version, "1999-01-01")).toThrow(/no session on 1999-01-01/);
  });

  it("keeps the invariants true of what the CLI printed", () => {
    const generated = planFromFixture(join(directory, "competitive-marathon.json"), bundle);
    expect(checkInvariants({ version: generated.version, openQuestions: [] }, { knowledge: bundle })).toEqual([]);
  });
});
