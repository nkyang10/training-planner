import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { canonicalJson, hashOf, loadKnowledge } from "@training-planner/knowledge";

const knowledgeDir = join(process.cwd(), "knowledge", "heuristics");
const scratch: string[] = [];
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const bundle = loadKnowledge(knowledgeDir);

describe("the knowledge bundle", () => {
  it("reads a string knob by name, and refuses a number as a string", () => {
    expect(bundle.text("session-classes.yaml#first_quality_kind")).toBe("strides");
    expect(() => bundle.text("load-progression.yaml#weekly_increment_pct")).toThrow(/is not a string/);
  });

  it("loads every heuristic file in the corpus", () => {
    expect(bundle.files.length).toBeGreaterThanOrEqual(34);
    expect(bundle.files.every((name) => name.endsWith(".yaml"))).toBe(true);
  });

  it("carries a content hash in the spelling the contracts require", () => {
    expect(bundle.hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("is stable: two loads of the same corpus hash the same", () => {
    expect(loadKnowledge(knowledgeDir).hash).toBe(bundle.hash);
  });

  it("finds a knob by the anchor the prose cites", () => {
    expect(bundle.number("load-progression.yaml#weekly_increment_pct")).toBe(8);
    expect(bundle.knob("load-progression.yaml#weekly_increment_pct").range).toEqual([3, 12]);
  });

  it("refuses a knob that does not exist instead of defaulting", () => {
    expect(() => bundle.knob("no-such-file.yaml#no_such_knob")).toThrow(/not found/);
  });

  it("refuses an out-of-range value at load time", () => {
    const dir = mkdtempSync(join(tmpdir(), "tp-knowledge-"));
    scratch.push(dir);
    writeFileSync(
      join(dir, "broken.yaml"),
      "schema_version: 1\nid: broken\nknobs:\n  too_big:\n    value: 99\n    range: [1, 5]\n    confidence: medium\n",
    );
    expect(() => loadKnowledge(dir)).toThrow(/outside range/);
  });
});

describe("a bundle is a value", () => {
  it("a copy with a replaced knobs map reads the copy, not the original", () => {
    const anchor = "load-progression.yaml#weekly_increment_pct";
    const knob = bundle.knob(anchor);
    const knobs = new Map(bundle.knobs);
    knobs.set(anchor, { ...knob, value: 11 });
    const copy = { ...bundle, knobs, hash: hashOf({ from: bundle.hash, anchor, value: 11 }) };
    expect(copy.number(anchor)).toBe(11);
    expect(bundle.number(anchor)).toBe(8);
    expect(copy.hash).not.toBe(bundle.hash);
  });
});
describe("canonical JSON", () => {
  it("does not depend on object key order", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 4, c: 3 }] })).toBe(canonicalJson({ a: [2, { c: 3, d: 4 }], b: 1 }));
  });

  it("hashes equal content equally and different content differently", () => {
    expect(hashOf({ a: 1 })).toBe(hashOf({ a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
  });

  it("refuses values that JSON cannot represent, instead of hashing a surprise", () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson({ a: undefined })).not.toThrow(); // dropped, like JSON.stringify
  });
});
