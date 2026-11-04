/**
 * The daily trade-off's tests. The ones that matter: a substitute for a quality session is priced by the corpus
 * knob, an easy alternate that covered the distance costs nothing, and a good day never gets a cost line.
 */
import { describe, expect, it } from "vitest";
import { dailyCostOf } from "../src/index";
import { loadKnowledge } from "@training-planner/knowledge";
import { makeEntry, makePlan } from "./helpers";
import type { SessionSpec } from "./helpers";

const knowledge = loadKnowledge("knowledge/heuristics");

const sessionOf = (spec: SessionSpec) => {
  const session = makePlan([spec]).sessions[0];
  if (session === undefined) throw new Error("no session");
  return session;
};

const tempo = sessionOf({ day: "2026-11-04", kind: "tempo", km: 10, hard: true, rpe: 7 });
const easy = sessionOf({ day: "2026-11-04", kind: "easy", km: 10, rpe: 4 });
const rest = sessionOf({ day: "2026-11-04", kind: "rest", km: 0 });

describe("a substitute for a quality session is priced by the corpus", () => {
  it("names the kind and the equivalence cap", () => {
    const cost = dailyCostOf({ session: tempo, entry: makeEntry({ sessionTaken: "alternate" }), knowledge });
    expect(cost).toEqual({
      key: "alternate-quality",
      slots: { kind: "tempo", pct: knowledge.number("session-substitution.yaml#equivalence_max_drop_pct") },
    });
  });

  it("costs nothing on a rest day: there was no prescription to substitute", () => {
    const cost = dailyCostOf({ session: rest, entry: makeEntry({ sessionTaken: "alternate" }), knowledge });
    expect(cost).toBeNull();
  });
});

describe("an easy alternate costs the kilometres it did not cover", () => {
  it("counts the gap between planned and reported", () => {
    const cost = dailyCostOf({
      session: easy,
      entry: makeEntry({ sessionTaken: "alternate", outcome: "completed", completedKm: 4 }),
      knowledge,
    });
    expect(cost).toEqual({ key: "alternate-volume", slots: { km: 6 } });
  });

  it("costs nothing when the alternate covered the distance", () => {
    // An alternate that ran the planned 10 km gave up nothing measurable; saying otherwise would be invented.
    const cost = dailyCostOf({
      session: easy,
      entry: makeEntry({ sessionTaken: "alternate", outcome: "completed", completedKm: 10 }),
      knowledge,
    });
    expect(cost).toBeNull();
  });
});

describe("a cut quality session names what was cut", () => {
  it("states planned, done and the kind", () => {
    const cost = dailyCostOf({
      session: tempo,
      entry: makeEntry({ outcome: "partial", sessionTaken: "partial", completedKm: 6 }),
      knowledge,
    });
    expect(cost).toEqual({ key: "partial-quality", slots: { kind: "tempo", planned: 10, done: 6 } });
  });

  it("says nothing about a partial easy day: the comment already names a lost easy day", () => {
    const cost = dailyCostOf({
      session: easy,
      entry: makeEntry({ outcome: "partial", sessionTaken: "partial", completedKm: 4 }),
      knowledge,
    });
    expect(cost).toBeNull();
  });
});

describe("a good day never gets a cost line", () => {
  it("is silent when the day was done as prescribed", () => {
    const cost = dailyCostOf({
      session: tempo,
      entry: makeEntry({ outcome: "completed", sessionTaken: "as-prescribed" }),
      knowledge,
    });
    expect(cost).toBeNull();
  });

  it("is silent on extra work: more is not a trade-off", () => {
    const cost = dailyCostOf({
      session: easy,
      entry: makeEntry({ outcome: "completed", sessionTaken: "extra", completedKm: 12 }),
      knowledge,
    });
    expect(cost).toBeNull();
  });
});
