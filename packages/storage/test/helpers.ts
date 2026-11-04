/**
 * Hand-built rows for the storage tests: the store must not care where a row came from, so the fixtures are
 * explicit literals rather than a pipeline call. A test that used the pipeline would hide a store bug behind it.
 */
import type { DayEntry, TrainingEvent } from "@training-planner/domain";
import { uuidFrom } from "@training-planner/planner-core";

export function makeEntry(overrides: Partial<DayEntry> = {}): DayEntry {
  return {
    day: "2026-11-05",
    outcome: "completed",
    revision: 1,
    tzAtEvent: "Asia/Taipei",
    idempotencyKey: "key-default",
    ...overrides,
  };
}

export function makeEvent(input: { userId: string; entry: DayEntry; idempotencyKey: string | null }): TrainingEvent {
  const entryId = input.entry.entryId ?? `entry-${input.entry.day}`;
  return {
    eventId: uuidFrom({ userId: input.userId, entryId, type: "entry.submitted" }),
    userId: input.userId,
    type: "entry.submitted",
    occurredAt: `${input.entry.day}T22:40:00.000Z`,
    actor: "runner",
    payloadVersion: 1,
    payload: { entryId },
    trainingDay: input.entry.day,
    timezone: input.entry.tzAtEvent,
    idempotencyKey: input.idempotencyKey,
  };
}
