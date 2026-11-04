/**
 * "A rule change breaks exactly the fixtures it should."
 *
 * That sentence is half of the M1 golden-plans criterion, and it is the half a green suite does not prove:
 * a suite where every fixture passes after every change is a suite that measures nothing. This test mutates
 * one knowledge knob at a time, regenerates all six plans, and asserts the exact set of fixtures that moved.
 *
 * The expectation is derived from the plan structure, not copied from a run: only the marathon fixture runs
 * two hard days a week, so lowering the hard-day cap can only touch it; the conservative increment band
 * applies to the two at-risk profiles, so raising the default band cannot touch them. When an expectation
 * here turns out to be wrong, the interesting question is which of the two - the plan or the claim about it -
 * is wrong.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { athleteProfileSchema } from "@training-planner/domain";
import { fixtureSchema } from "@training-planner/golden-fixtures";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { canonicalJson, hashOf } from "@training-planner/knowledge/canonical";
import { generatePlan } from "../src/index";
import { knowledge } from "./helpers";

const directory = join(process.cwd(), "eval", "golden-plans");

const fixtures = readdirSync(directory)
  .filter((name) => name.endsWith(".json") && name !== "schema.json")
  .sort()
  .map((name) => ({
    name: name.replace(".json", ""),
    fixture: fixtureSchema.parse(JSON.parse(readFileSync(join(directory, name), "utf8"))),
  }));

/** A bundle with one knob changed and a new content hash, exactly as a knowledge PR would produce. */
function mutate(anchor: string, value: number): KnowledgeBundle {
  const knob = knowledge.knobs.get(anchor);
  if (!knob) throw new Error(`no knob ${anchor}`);
  const knobs = new Map(knowledge.knobs);
  knobs.set(anchor, { ...knob, value });
  return { ...knowledge, knobs, hash: hashOf({ from: knowledge.hash, anchor, value }) };
}

function sessionsOf(name: string, bundle: KnowledgeBundle): string {
  const entry = fixtures.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`no fixture ${name}`);
  const profile = athleteProfileSchema.parse(entry.fixture.input.profile);
  const output = generatePlan({
    profile,
    evidence: entry.fixture.input.evidence,
    state: entry.fixture.input.state,
    clock: entry.fixture.input.clock,
    seed: entry.fixture.input.seed,
    knowledge: bundle,
  });
  return canonicalJson(output.version.sessions);
}

const cases: { anchor: string; value: number; why: string; breaks: string[] }[] = [
  {
    anchor: "intensity-distribution.yaml#hard_days_cap",
    value: 1,
    why: "only the marathon fixture runs two hard days a week; the other five already run one or none",
    breaks: ["competitive-marathon"],
  },
  {
    anchor: "load-progression.yaml#weekly_increment_pct",
    value: 12,
    why: "the conservative band applies to masters-40 (age 45, unresolved load-sensitive injury) and returning-after-layoff (age 41), so raising the default band cannot touch them",
    breaks: ["novice-5k", "competitive-marathon", "three-days-a-week", "trail-ultra"],
  },
  {
    anchor: "recovery.yaml#rest_days_per_week_min",
    value: 2,
    why: "only the six-day marathon week has a single rest day to give up; every other fixture already rests more than the minimum",
    breaks: ["competitive-marathon"],
  },
];

describe("a knowledge change breaks exactly the fixtures it should", () => {
  for (const testCase of cases) {
    it(`${testCase.anchor} = ${testCase.value}: ${testCase.why}`, () => {
      const mutated = mutate(testCase.anchor, testCase.value);
      const changed = fixtures
        .filter((fixture) => sessionsOf(fixture.name, mutated) !== sessionsOf(fixture.name, knowledge))
        .map((fixture) => fixture.name)
        .sort();
      expect(changed).toEqual([...testCase.breaks].sort());
    });
  }

  it("leaves every plan untouched when no knob changes", () => {
    const same = mutate("load-progression.yaml#step_cycle", knowledge.number("load-progression.yaml#step_cycle"));
    const changed = fixtures.filter((fixture) => sessionsOf(fixture.name, same) !== sessionsOf(fixture.name, knowledge));
    expect(changed).toEqual([]);
  });
});
