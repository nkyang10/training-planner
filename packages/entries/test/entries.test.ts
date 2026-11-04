/**
 * The entry pipeline's tests are mostly about what it refuses and what it refuses to duplicate.
 *
 * A pipeline that appends rows is easy to write and easy to get wrong in the two places that cost the most:
 * a retry that writes twice (every adherence number silently inflated) and a correction that overwrites
 * (every metric already derived from the old value silently changes). Both are tested by replaying, not by
 * reading.
 */
import { describe, expect, it } from "vitest";
import { dayEntrySchema, eventSchema } from "@training-planner/domain";
import type { DayEntry, TrainingEvent } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { entriesForDay, pendingDays, resolveCurrent, submitEntry } from "../src/index";
import type { EntryDraft, EntryLog } from "../src/index";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-11-10";

const options = (overrides: Partial<Parameters<typeof submitEntry>[2]> = {}): Parameters<typeof submitEntry>[2] => ({
  userId: USER,
  today: TODAY,
  occurredAt: "2026-11-10T22:40:00.000Z",
  knowledge,
  ...overrides,
});

const draft = (overrides: Partial<EntryDraft> = {}): EntryDraft => ({
  day: TODAY,
  outcome: "completed",
  tzAtEvent: "Asia/Taipei",
  sessionTaken: "as-prescribed",
  rpe: 6,
  legs: 2,
  idempotencyKey: "idem-key-0001",
  ...overrides,
});

const emptyLog: EntryLog = { entries: [], events: [] };

const accepted = (result: ReturnType<typeof submitEntry>) => {
  if (result.status !== "accepted") throw new Error(`expected accepted, got ${result.status}: ${JSON.stringify(result)}`);
  return result;
};

describe("a first submission is accepted and stored as revision 1", () => {
  it("writes an entry the contract accepts and an event the envelope accepts", () => {
    const result = accepted(submitEntry(draft(), emptyLog, options()));
    expect(result.entry.revision).toBe(1);
    expect(result.entry.entryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(dayEntrySchema.safeParse(result.entry).success).toBe(true);
    expect(eventSchema.safeParse(result.event).success).toBe(true);
    expect(result.event.type).toBe("entry.submitted");
    expect(result.event.actor).toBe("runner");
    expect(result.event.trainingDay).toBe(TODAY);
    expect(result.event.idempotencyKey).toBe("idem-key-0001");
    expect(result.superseded).toBeUndefined();
  });

  it("is deterministic: the same draft produces the same ids", () => {
    const first = accepted(submitEntry(draft(), emptyLog, options()));
    const second = accepted(submitEntry(draft(), emptyLog, options()));
    expect(second.entry.entryId).toBe(first.entry.entryId);
    expect(second.event.eventId).toBe(first.event.eventId);
  });

  it("leaves the log it was given untouched", () => {
    const log: EntryLog = { entries: [], events: [] };
    accepted(submitEntry(draft(), log, options()));
    expect(log.entries).toHaveLength(0);
    expect(log.events).toHaveLength(0);
  });
});

describe("a retry never writes twice", () => {
  it("returns the first entry and no second event", () => {
    const first = accepted(submitEntry(draft(), emptyLog, options()));
    const log: EntryLog = { entries: [first.entry], events: [first.event] };
    const second = submitEntry(draft(), log, options());
    expect(second.status).toBe("duplicate");
    if (second.status !== "duplicate") throw new Error("unreachable");
    expect(second.entry.entryId).toBe(first.entry.entryId);
  });

  it("refuses a runner write with no idempotency key", () => {
    const result = submitEntry(draft({ idempotencyKey: "" }), emptyLog, options());
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("missing-idempotency-key");
  });
});

describe("the future is not writable and the contract is the authority", () => {
  it("refuses a future day", () => {
    const result = submitEntry(draft({ day: "2026-11-11" }), emptyLog, options());
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("future-day");
  });

  it("refuses an entry the day-entry contract rejects", () => {
    // A skipped day must carry outcomeDetail; the contract says so and the pipeline must not store it anyway.
    // The builder defaults sessionTaken to as-prescribed, so "not said" has to be stated as such.
    const result = submitEntry(draft({ day: TODAY, outcome: "skipped", sessionTaken: undefined }), emptyLog, options());
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("invalid-entry");
    expect(result.detail).toContain("outcomeDetail");
  });

  it("accepts a rest day without inventing a session", () => {
    const result = accepted(submitEntry(draft({ outcome: "rest", rpe: null, sessionTaken: undefined }), emptyLog, options()));
    expect(dayEntrySchema.safeParse(result.entry).success).toBe(true);
    expect(result.entry.sessionTaken).toBeUndefined();
  });
});

describe("a partial day says what part it did", () => {
  it("stores the partial marker and the distance", () => {
    const result = accepted(
      submitEntry(draft({ outcome: "partial", sessionTaken: "partial", completedKm: 3.5 }), emptyLog, options()),
    );
    expect(result.entry.sessionTaken).toBe("partial");
    expect(result.entry.completedKm).toBe(3.5);
    expect(dayEntrySchema.safeParse(result.entry).success).toBe(true);
  });

  it("refuses the marker on a day whose outcome is not partial", () => {
    const result = submitEntry(draft({ outcome: "completed", sessionTaken: "partial", completedKm: 5 }), emptyLog, options());
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("invalid-entry");
    expect(result.detail).toContain("partial");
  });

  it("refuses a partial day that claims it did the prescription as written", () => {
    const result = submitEntry(
      draft({ outcome: "partial", sessionTaken: "as-prescribed", completedKm: 3 }),
      emptyLog,
      options(),
    );
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.detail).toContain("sessionTaken must be partial");
  });

  it("refuses a partial marker with no amount, because a part with no amount is not a fact", () => {
    const result = submitEntry(draft({ outcome: "partial", sessionTaken: "partial" }), emptyLog, options());
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("invalid-entry");
  });
});

describe("one spelling of soreness reaches storage", () => {
  it("renames the legacy spelling instead of storing two names for one fact", () => {
    const result = accepted(
      submitEntry(draft({ wellness: { musoreSoreness: 3 } }), emptyLog, options()),
    );
    expect(result.entry.wellness?.muscleSoreness).toBe(3);
    expect(result.entry.wellness).not.toHaveProperty("musoreSoreness");
    expect(dayEntrySchema.safeParse(result.entry).success).toBe(true);
  });

  it("leaves the canonical spelling alone", () => {
    const result = accepted(
      submitEntry(draft({ wellness: { muscleSoreness: 4, sleepHours: 7.5 } }), emptyLog, options()),
    );
    expect(result.entry.wellness?.muscleSoreness).toBe(4);
    expect(result.entry.wellness?.sleepHours).toBe(7.5);
  });

  it("refuses a write that carries both spellings, because two values for one fact is not a fact", () => {
    const result = submitEntry(
      draft({ wellness: { musoreSoreness: 3, muscleSoreness: 4 } }),
      emptyLog,
      options(),
    );
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("invalid-entry");
    expect(result.detail).toContain("musoreSoreness");
  });
});

describe("the past is bounded by the knowledge window", () => {
  it("refuses a silent backfill older than 72 hours", () => {
    const result = submitEntry(draft({ day: "2026-11-06", idempotencyKey: "idem-key-old" }), emptyLog, options());
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("unreachable");
    expect(result.code).toBe("missing-correction-reason");
  });

  it("accepts an old backfill that carries a reason", () => {
    const result = accepted(
      submitEntry(draft({ day: "2026-11-06", idempotencyKey: "idem-key-old", correctionReason: "watch died" }), emptyLog, options()),
    );
    expect(result.entry.revision).toBe(1);
    expect(result.event.type).toBe("entry.submitted");
  });

  it("allows a silent backfill inside the window", () => {
    const result = accepted(submitEntry(draft({ day: "2026-11-08", idempotencyKey: "idem-key-recent" }), emptyLog, options()));
    expect(result.entry.revision).toBe(1);
  });
});

describe("a correction is a new revision that points at the one it replaces", () => {
  const first = accepted(submitEntry(draft(), emptyLog, options()));
  const log: EntryLog = { entries: [first.entry], events: [first.event] };

  it("appends revision 2 and leaves revision 1 in place", () => {
    const result = accepted(
      submitEntry(draft({ rpe: 8, idempotencyKey: "idem-key-0002" }), log, options()),
    );
    expect(result.entry.revision).toBe(2);
    expect(result.entry.correctedFromRevision).toBe(1);
    expect(result.event.type).toBe("entry.corrected");
    expect(result.event.supersedesEventId).toBe(first.event.eventId);
    expect(log.entries).toHaveLength(1);
    expect(entriesForDay({ entries: [first.entry, result.entry], events: [] }, TODAY)).toHaveLength(2);
    expect(resolveCurrent({ entries: [first.entry, result.entry], events: [] }, TODAY)?.revision).toBe(2);
  });

  it("returns the pointer the API writes onto the superseded row", () => {
    const result = accepted(submitEntry(draft({ rpe: 8, idempotencyKey: "idem-key-0003" }), log, options()));
    expect(result.superseded?.entryId).toBe(first.entry.entryId);
    expect(result.superseded?.supersededBy).toBe(result.entry.entryId);
  });

  it("requires a reason when the correction is outside the window", () => {
    // The first write of an old day is itself a backfill, so it needs its own reason before it exists at all.
    const old = accepted(
      submitEntry(draft({ day: "2026-11-06", idempotencyKey: "idem-key-old-1", correctionReason: "watch died" }), emptyLog, options()),
    );
    const oldLog: EntryLog = { entries: [old.entry], events: [old.event] };
    const silent = submitEntry(draft({ day: "2026-11-06", idempotencyKey: "idem-key-old-2" }), oldLog, options());
    expect(silent.status).toBe("rejected");
    if (silent.status !== "rejected") throw new Error("unreachable");
    expect(silent.code).toBe("missing-correction-reason");

    const explained = accepted(
      submitEntry(
        draft({ day: "2026-11-06", idempotencyKey: "idem-key-old-3", correctionReason: "wrong day" }),
        oldLog,
        options(),
      ),
    );
    expect(explained.entry.revision).toBe(2);
  });

  it("keeps the correction event free of health free text", () => {
    const result = accepted(
      submitEntry(draft({ note: "felt awful, sore throat", idempotencyKey: "idem-key-0004" }), log, options()),
    );
    expect(JSON.stringify(result.event.payload)).not.toContain("throat");
  });
});

describe("the rollup helpers", () => {
  it("lists days that closed without an entry and never includes today or the future", () => {
    const log: EntryLog = {
      entries: [{ ...accepted(submitEntry(draft({ day: "2026-11-08", idempotencyKey: "idem-key-8" }), emptyLog, options())).entry }],
      events: [],
    };
    const pending = pendingDays(log, TODAY, "2026-11-06", "2026-11-12");
    expect(pending).toEqual(["2026-11-06", "2026-11-07", "2026-11-09"]);
  });

  it("has no current entry for a day nobody answered", () => {
    expect(resolveCurrent(emptyLog, TODAY)).toBeUndefined();
  });
});

describe("every accepted row is legal", () => {
  it("the event envelope rejects a runner event without an idempotency key", () => {
    const event: TrainingEvent = {
      eventId: "44444444-4444-4444-8444-444444444444",
      userId: USER,
      type: "entry.submitted",
      occurredAt: "2026-11-10T22:40:00.000Z",
      actor: "runner",
      payloadVersion: 1,
      payload: {},
      trainingDay: TODAY,
      timezone: "Asia/Taipei",
    };
    expect(eventSchema.safeParse(event).success).toBe(false);
  });

  it("the entry contract rejects a skipped day without a detail", () => {
    const entry: DayEntry = { day: TODAY, outcome: "skipped", revision: 1, tzAtEvent: "Asia/Taipei" };
    expect(dayEntrySchema.safeParse(entry).success).toBe(false);
  });
});
