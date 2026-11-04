/**
 * The generated mirrors must stay generated.
 *
 * schemas.ts is written by tools/gen-domain-schemas.mjs from schemas/json/*.schema.json. The failure mode
 * this test removes is the quiet one: someone edits the generated file by hand to make a fixture pass, the
 * contract and the code now disagree, and the next contract change is silently overwritten by a
 * regeneration nobody expected to change behaviour.
 *
 * It also checks that parsing a valid fixture does not silently drop keys. A `.strict()`/`.passthrough()`
 * mistake in the generator would not fail a fixture round-trip (both accept the object); it would only
 * show up later as a field that vanished between the wire and the database.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  athleteProfileSchema,
  dayEntrySchema,
  eventSchema,
  planDiffSchema,
  planVersionSchema,
  reviewSchema,
  signalSchema,
} from "@training-planner/domain";
import type { z } from "zod";

const root = process.cwd();
const generatedFile = join(root, "packages", "domain", "src", "schemas.ts");
const fixtureRoot = join(root, "eval", "contract-fixtures");

const contracts: Record<string, z.ZodTypeAny> = {
  "athlete-profile": athleteProfileSchema,
  "day-entry": dayEntrySchema,
  "plan-version": planVersionSchema,
  "plan-diff": planDiffSchema,
  review: reviewSchema,
  signal: signalSchema,
  events: eventSchema,
};

/** The first key path present in the fixture but absent after parsing, or null. */
function firstDroppedKey(raw: unknown, parsed: unknown, path = ""): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!(key in (parsed as Record<string, unknown>))) return `${path}${key}`;
    const nested = firstDroppedKey((raw as Record<string, unknown>)[key], (parsed as Record<string, unknown>)[key], `${path}${key}.`);
    if (nested) return nested;
  }
  return null;
}

describe("the generated mirrors are current", () => {
  it("regenerating produces exactly the committed file", () => {
    const before = readFileSync(generatedFile, "utf8");
    try {
      execFileSync(process.execPath, [join(root, "tools", "gen-domain-schemas.mjs")], { cwd: root, stdio: "ignore" });
      const after = readFileSync(generatedFile, "utf8");
      expect(after).toBe(before);
    } finally {
      writeFileSync(generatedFile, before, "utf8");
    }
  });
});

describe("parsing a valid fixture keeps every key it was given", () => {
  for (const [contract, schema] of Object.entries(contracts)) {
    const directory = join(fixtureRoot, contract);
    const files = readdirSync(directory).filter((name) => name.startsWith("valid-") && name.endsWith(".json"));
    for (const file of files) {
      it(`${contract}/${file}`, () => {
        const raw = JSON.parse(readFileSync(join(directory, file), "utf8"));
        const parsed = schema.parse(raw);
        expect(firstDroppedKey(raw, parsed)).toBeNull();
      });
    }
  }
});
