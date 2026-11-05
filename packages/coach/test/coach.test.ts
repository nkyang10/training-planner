import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COACH_REFERENCES } from "../src/corpus";
import { selectCoachReferences } from "../src/select";
import { referenceHash } from "../src/hash";

describe("coach memory corpus", () => {
  it("cites a real file and a heading that exists in that file", () => {
    for (const reference of COACH_REFERENCES) {
      const text = readFileSync(reference.sourcePath, "utf8");
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain(reference.sourceHeading);
    }
  });

  it("has unique ids and only the three tiers", () => {
    expect(new Set(COACH_REFERENCES.map((reference) => reference.id)).size).toBe(COACH_REFERENCES.length);
    for (const reference of COACH_REFERENCES) {
      expect(["safety", "training", "tone"]).toContain(reference.tier);
    }
  });
});

describe("coach reference selection", () => {
  it("puts safety first when there is pain, and caps the list at four", () => {
    const selected = selectCoachReferences({ kind: "review", pain: true, missedSessions: 0, highRpe: false, reviewOptionsCount: 0 });
    expect(selected.length).toBeLessThanOrEqual(4);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected[0]?.tier).toBe("safety");
    expect(selected.every((reference) => typeof reference.reason === "string")).toBe(true);
  });

  it("always carries tone for a comment or narrative", () => {
    for (const kind of ["comment", "narrative"] as const) {
      const selected = selectCoachReferences({ kind, pain: false, missedSessions: 0, highRpe: false, reviewOptionsCount: 0 });
      expect(selected.some((reference) => reference.tier === "tone")).toBe(true);
    }
  });

  it("is deterministic for the same facts", () => {
    const context = { kind: "review", pain: false, missedSessions: 2, highRpe: true, reviewOptionsCount: 1 } as const;
    expect(selectCoachReferences(context)).toEqual(selectCoachReferences(context));
  });
});

describe("reference hash", () => {
  it("is stable for the same list and changes when the list changes", () => {
    const first = selectCoachReferences({ kind: "review", pain: true, missedSessions: 0, highRpe: false, reviewOptionsCount: 0 });
    const second = selectCoachReferences({ kind: "review", pain: true, missedSessions: 0, highRpe: false, reviewOptionsCount: 0 });
    expect(referenceHash(first)).toBe(referenceHash(second));
    expect(referenceHash(first)).toContain("sha256");
    expect(referenceHash(first.slice(0, 1))).not.toBe(referenceHash(first));
  });
});
