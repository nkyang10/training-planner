import { describe, expect, it } from "vitest";
import { canonicalJson } from "@training-planner/knowledge/canonical";
import { generatePlan } from "../src/index";
import { makeInput } from "./helpers";

describe("determinism (AGENTS rule 1)", () => {
  it("generates a byte-identical plan from the same inputs", () => {
    const input = makeInput();
    expect(canonicalJson(generatePlan(input).version)).toBe(canonicalJson(generatePlan(input).version));
  });

  it("records the knowledge hash it used, in the contract's spelling", () => {
    const input = makeInput();
    const { version } = generatePlan(input);
    expect(version.knowledgeHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(version.knowledgeHash).toBe(input.knowledge.hash);
  });

  it("changes the identity when the seed changes, and only the identity", () => {
    const first = generatePlan(makeInput({ seed: "seed-a" }));
    const second = generatePlan(makeInput({ seed: "seed-b" }));
    expect(first.version.versionId).not.toBe(second.version.versionId);
    expect(canonicalJson(first.version.sessions)).toBe(canonicalJson(second.version.sessions));
  });

  it("does not read the wall clock: today is an input and only moves the generation day", () => {
    const first = generatePlan(makeInput({ clock: { today: "2026-11-04" } }));
    const second = generatePlan(makeInput({ clock: { today: "2027-03-01" } }));
    expect(first.version.generatedAtDay).toBe("2026-11-04");
    expect(second.version.generatedAtDay).toBe("2027-03-01");
    expect(canonicalJson(first.version.sessions)).toBe(canonicalJson(second.version.sessions));
  });

  it("produces ids that are legal UUIDs and stable across runs", () => {
    const first = generatePlan(makeInput()).version;
    const second = generatePlan(makeInput()).version;
    expect(first.versionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.versionId).toBe(second.versionId);
    expect(first.inputsHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
