/**
 * Quality sequencing: the first quality session of a block is neuromuscular, and the kind comes from the corpus.
 *
 * The two tests that matter are the last two: one proves the knob is what decides (replace it and the plan moves),
 * and one proves an unknown kind is a knowledge error rather than a silent default.
 */
import { describe, expect, it } from "vitest";
import type { Session } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { hashOf } from "@training-planner/knowledge/canonical";
import { generatePlan } from "../src/index";
import { knowledge, makeInput } from "./helpers";

const QUALITY = new Set(["strides", "tempo", "vo2max", "hills", "mp", "test", "race"]);
const qualityOf = (sessions: Session[]): Session[] => sessions.filter((session) => QUALITY.has(session.kind));

const withKnob = (value: unknown): KnowledgeBundle => {
  const anchor = "session-classes.yaml#first_quality_kind";
  const knob = knowledge.knobs.get(anchor);
  if (!knob) throw new Error(`no knob ${anchor}`);
  const knobs = new Map(knowledge.knobs);
  knobs.set(anchor, { ...knob, value: value as never });
  return { ...knowledge, knobs, hash: hashOf({ from: knowledge.hash, anchor, value }) };
};

describe("neuromuscular work opens the block, threshold work follows", () => {
  it("puts strides first and tempo after it", () => {
    const plan = generatePlan(makeInput()).version;
    const quality = qualityOf(plan.sessions);
    expect(quality.length).toBeGreaterThan(1);
    expect(quality[0]?.kind).toBe("strides");
    expect(quality[0]?.hardDay).toBe(false);
    expect(quality.slice(1).map((session) => session.kind)).toContain("tempo");
  });

  it("never opens two weeks with the cheap kind", () => {
    const plan = generatePlan(makeInput()).version;
    const quality = qualityOf(plan.sessions);
    expect(quality.filter((session) => session.kind === "strides")).toHaveLength(1);
  });
});

describe("the kind is a corpus value, not a literal", () => {
  it("moves when the knob moves", () => {
    const plan = generatePlan(makeInput({ knowledge: withKnob("hills") })).version;
    const quality = qualityOf(plan.sessions);
    expect(quality[0]?.kind).toBe("hills");
    expect(quality[0]?.hardDay).toBe(true);
  });

  it("refuses a knob value that is not a quality kind", () => {
    expect(() => generatePlan(makeInput({ knowledge: withKnob("easy") }))).toThrow(/first_quality_kind/);
    expect(() => generatePlan(makeInput({ knowledge: withKnob("sprint") }))).toThrow(/first_quality_kind/);
  });
});
