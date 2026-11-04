/**
 * The composition root's spec: a typo must not silently give a runner a database that forgets everything.
 */
import { describe, expect, it } from "vitest";
import { createRepositoryFromSpec } from "../src/index";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("createRepositoryFromSpec", () => {
  it("defaults to memory, and says so", () => {
    for (const spec of [undefined, "", "memory"]) {
      const handle = createRepositoryFromSpec(spec);
      expect(handle.kind).toBe("memory");
      handle.close();
    }
  });

  it("opens a SQLite database for a sqlite: spec, in memory or on disk", () => {
    const handle = createRepositoryFromSpec("sqlite::memory:");
    expect(handle.kind).toBe("sqlite");
    handle.repository.saveWizardAnswer(USER, { stepId: "goal", answer: { type: "finish" }, revision: 1, source: "wizard" });
    expect(handle.repository.listWizardAnswers(USER)).toHaveLength(1);
    handle.close();
  });

  it("refuses an unknown spec instead of falling back silently", () => {
    expect(() => createRepositoryFromSpec("postgres://host/db")).toThrow(/TRAINING_PLANNER_DB must be/);
    expect(() => createRepositoryFromSpec("sqlite:")).toThrow(/no path follows/);
  });
});
