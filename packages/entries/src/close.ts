/**
 * `day.closed`: the sweep's verdict that a training day ended.
 *
 * The catalogue had no such row, so the worker could describe a closed day but not name it in the log
 * (docs/roadmap/backlog.md row 18). The event is emitted once per day by the sweep, never by the runner, and its
 * payload says both what the plan asked and what was reported - `status: "closed-unlogged"` with a null outcome is
 * the honest record of a day that ended with no entry, not a zero.
 */
import { uuidFrom } from "@training-planner/planner-core";
import type { DayCloseStatus, TrainingEvent } from "@training-planner/domain";

export interface CloseEventInput {
  userId: string;
  /** The training day that ended. */
  day: string;
  status: DayCloseStatus;
  plannedKm: number;
  plannedSessions: number;
  /** What the runner reported, or 0 when the day closed with no entry. */
  completedKm: number;
  /** Null when no entry existed; the status says so as well, and the two must not disagree. */
  outcome: string | null;
  /** Injected, never read from a clock: the sweep is reproducible (AGENTS rule 1). */
  occurredAt: string;
  timezone: string;
}

export const DAY_CLOSED = "day.closed";

export function closeEventFor(input: CloseEventInput): TrainingEvent {
  return {
    eventId: uuidFrom({ type: DAY_CLOSED, userId: input.userId, day: input.day, occurredAt: input.occurredAt }),
    userId: input.userId,
    type: DAY_CLOSED,
    occurredAt: input.occurredAt,
    // A day closing is the system's own work; the DDL's five actors exist so "who wrote it" decides whether a row
    // can be corrected, and a runner never writes this one.
    actor: "worker",
    payloadVersion: 1,
    payload: {
      status: input.status,
      plannedKm: input.plannedKm,
      plannedSessions: input.plannedSessions,
      completedKm: input.completedKm,
      outcome: input.outcome,
    },
    trainingDay: input.day,
    timezone: input.timezone,
  };
}
