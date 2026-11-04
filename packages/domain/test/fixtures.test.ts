/**
 * The domain mirrors are proven, not asserted.
 *
 * eval/contract-fixtures/ was written for the JSON contracts before this code existed: 8 instances that
 * must validate and 12 that must not, each invalid file named after the reason it must fail. If the
 * generated mirror and the contract disagree, this test is where it shows up - and because the mirror is
 * generated from the contract, the only way it can disagree is a generator bug, which is exactly what we
 * want one place to catch.
 *
 * The typed assignments below are compile-time proof that a parsed value is usable as the frozen
 * hand-written types in src/types.ts and src/entries.ts. A rename in either direction stops this file
 * from compiling, which is cheaper than finding it in the planner.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  athleteProfileSchema,
  dayEntrySchema,
  eventSchema,
  promptDeliverySchema,
  guidelineSchema,
  planDiffSchema,
  planVersionSchema,
  reviewSchema,
  signalSchema,
} from "@training-planner/domain";
import type {
  AthleteProfile,
  DayEntry,
  PlanDiff,
  PlanVersion,
  Review,
  Signal,
  TrainingEvent,
} from "@training-planner/domain";

const root = process.cwd();
const fixtureRoot = join(root, "eval", "contract-fixtures");
const schemaRoot = join(root, "schemas", "json");

const contracts: Record<string, z.ZodTypeAny> = {
  "athlete-profile": athleteProfileSchema,
  "day-entry": dayEntrySchema,
  "plan-version": planVersionSchema,
  "plan-diff": planDiffSchema,
  review: reviewSchema,
  signal: signalSchema,
  events: eventSchema,
  "prompt-delivery": promptDeliverySchema,
  guideline: guidelineSchema,
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

describe("every contract has a mirror and a fixture set", () => {
  it("mirrors exactly the contracts that exist", () => {
    const onDisk = readdirSync(schemaRoot)
      .filter((name) => name.endsWith(".schema.json"))
      .map((name) => name.replace(".schema.json", ""))
      .sort();
    expect(Object.keys(contracts).sort()).toEqual(onDisk);
  });

  it("has a fixture directory for every contract, with both a good and a bad instance", () => {
    for (const contract of Object.keys(contracts)) {
      const dir = join(fixtureRoot, contract);
      expect(statSync(dir).isDirectory(), `missing fixture directory for ${contract}`).toBe(true);
      const files = readdirSync(dir).filter((name) => name.endsWith(".json"));
      expect(files.filter((name) => name.startsWith("valid-")).length, `${contract}: no valid instance`).toBeGreaterThan(0);
      expect(files.filter((name) => name.startsWith("invalid-")).length, `${contract}: no invalid instance`).toBeGreaterThan(0);
    }
  });
});

describe("valid instances validate, invalid instances do not", () => {
  for (const [contract, schema] of Object.entries(contracts)) {
    const dir = join(fixtureRoot, contract);
    const files = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
    for (const file of files) {
      const expectValid = !file.startsWith("invalid");
      it(`${contract}/${file} ${expectValid ? "validates" : "is rejected"}`, () => {
        const instance = readJson(join(dir, file));
        const result = schema.safeParse(instance);
        expect(result.success, result.success ? "" : JSON.stringify(result.error.issues.slice(0, 3))).toBe(expectValid);
      });
    }
  }
});

describe("a parsed instance is assignable to the frozen hand-written types", () => {
  const firstValid = (contract: string): unknown => {
    const dir = join(fixtureRoot, contract);
    const file = readdirSync(dir).filter((name) => name.startsWith("valid-")).sort()[0];
    if (!file) throw new Error(`no valid fixture for ${contract}`);
    return readJson(join(dir, file));
  };

  it("athlete-profile", () => {
    const profile: AthleteProfile = athleteProfileSchema.parse(firstValid("athlete-profile"));
    expect(profile.availability.days.length).toBeGreaterThan(0);
  });

  it("day-entry", () => {
    const entry: DayEntry = dayEntrySchema.parse(firstValid("day-entry"));
    expect(entry.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("plan-version", () => {
    const version: PlanVersion = planVersionSchema.parse(firstValid("plan-version"));
    expect(version.knowledgeHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("plan-diff", () => {
    const diff: PlanDiff = planDiffSchema.parse(firstValid("plan-diff"));
    expect(diff.changes.length).toBeGreaterThan(0);
  });

  it("review", () => {
    const review: Review = reviewSchema.parse(firstValid("review"));
    expect(review.options.length).toBeGreaterThan(0);
  });

  it("signal", () => {
    const signal: Signal = signalSchema.parse(firstValid("signal"));
    expect(signal.mayDrive.length).toBeGreaterThan(0);
  });

  it("events", () => {
    const event: TrainingEvent = eventSchema.parse(firstValid("events"));
    expect(event.payloadVersion).toBe(1);
  });
});
