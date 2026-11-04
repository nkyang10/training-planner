/**
 * diffPlans is small and boring on purpose, and boring is the feature: ADR-0004 forbids touching a day at
 * or before the base version's generation day, ADR-0005 forbids more than two changes. A diff that can
 * rewrite history destroys every derived metric; a diff that proposes eight changes is a rewrite wearing
 * a review's clothes.
 */
import { describe, expect, it } from "vitest";
import type { PlanVersion, Session } from "@training-planner/domain";
import { diffPlans, generatePlan } from "../src/index";
import type { DiffOptions } from "../src/types";
import { knowledge, makeInput } from "./helpers";

const options = (overrides: Partial<DiffOptions> = {}): DiffOptions => ({
  createdAtDay: "2026-11-04",
  knowledgeHash: knowledge.hash,
  maxChanges: 2,
  reason: "the runner reported three bad nights",
  signalIds: ["sleep_debt:3"],
  expectedCost: "one less quality session this week",
  knobsUsed: ["load-progression.yaml#weekly_increment_pct"],
  ...overrides,
});

const base = (generatedAtDay = "2026-11-04"): PlanVersion =>
  generatePlan(makeInput({ clock: { today: generatedAtDay } })).version;

const clone = (version: PlanVersion): PlanVersion => structuredClone(version);

const edit = (version: PlanVersion, day: string, change: (session: Session) => void): void => {
  const session = version.sessions.find((candidate) => candidate.day === day);
  if (!session) throw new Error(`no session on ${day}`);
  change(session);
};

/** Rest days have no distance to reduce, so a diff test must name running days or it tests nothing. */
const runningDays = (version: PlanVersion, count: number): string[] =>
  version.sessions.filter((session) => session.kind !== "rest").slice(0, count).map((session) => session.day);

describe("a diff may not touch the past", () => {
  it("ignores a change on a day at or before the base version's generation day", () => {
    const from = base("2026-11-20");
    const to = clone(from);
    const pastDay = runningDays(to, 1)[0] ?? "2026-11-10";
    edit(to, pastDay, (session) => {
      session.kind = "rest";
      session.distanceKm = null;
      session.restDay = true;
    });
    const diff = diffPlans(from, to, options());
    expect(diff.changes).toEqual([]);
  });

  it("reports a change on a future day", () => {
    const from = base("2026-11-04");
    const to = clone(from);
    const day = runningDays(to, 1)[0] ?? "2026-11-06";
    edit(to, day, (session) => {
      session.distanceKm = Math.max(0, (session.distanceKm ?? 0) - 3);
    });
    const diff = diffPlans(from, to, options());
    expect(diff.changes.length).toBe(1);
    expect(diff.changes[0]?.day).toBe(day);
    expect(diff.changes[0]?.kind).toBe("distance.reduced");
    expect(diff.changes[0]?.reason).toBe("the runner reported three bad nights");
    expect(diff.changes[0]?.signalId).toBe("sleep_debt:3");
    expect(diff.changes[0]?.expectedCost).toBe("one less quality session this week");
    expect(diff.changeCountWithinLimit).toBe(true);
  });
});

describe("a diff proposes at most two changes", () => {
  it("caps the list and says so honestly", () => {
    const from = base();
    const to = clone(from);
    const futureDays = runningDays(to, 3);
    for (const day of futureDays) {
      edit(to, day, (session) => {
        session.distanceKm = Math.max(0, (session.distanceKm ?? 0) - 2);
      });
    }
    const diff = diffPlans(from, to, options());
    expect(diff.changes.length).toBe(2);
    expect(diff.changeCountWithinLimit).toBe(false);
  });
});

describe("a safety diff may only subtract", () => {
  it("drops a change that would add load", () => {
    const from = base();
    const to = clone(from);
    const day = runningDays(to, 1)[0] ?? "2026-11-06";
    edit(to, day, (session) => {
      session.distanceKm = (session.distanceKm ?? 0) + 5;
    });
    const diff = diffPlans(from, to, options({ isSafety: true }));
    expect(diff.changes).toEqual([]);
  });

  it("keeps a change that reduces load", () => {
    const from = base();
    const to = clone(from);
    const day = runningDays(to, 1)[0] ?? "2026-11-06";
    edit(to, day, (session) => {
      session.distanceKm = Math.max(0, (session.distanceKm ?? 0) - 4);
    });
    const diff = diffPlans(from, to, options({ isSafety: true }));
    expect(diff.changes.length).toBe(1);
    expect(diff.changes[0]?.isSafety).toBe(true);
  });
});

describe("the diff itself is reproducible", () => {
  it("has a legal UUID that does not change between two runs", () => {
    const from = base();
    const to = clone(from);
    const day = runningDays(to, 1)[0] ?? "2026-11-06";
    edit(to, day, (session) => {
      session.distanceKm = Math.max(0, (session.distanceKm ?? 0) - 3);
    });
    const first = diffPlans(from, to, options());
    const second = diffPlans(from, to, options());
    expect(first.diffId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.diffId).toBe(second.diffId);
    expect(first.fromVersionId).toBe(from.versionId);
    expect(first.toVersionId).toBe(to.versionId);
    expect(first.knowledgeHash).toBe(knowledge.hash);
  });
});
