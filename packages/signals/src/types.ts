/**
 * The signals layer's frozen interface.
 *
 * A signal is a number the system computed about a runner over a declared window, with a confidence and a list of
 * what it is allowed to drive. The `Signal` wire type already exists (`schemas/json/signal.schema.json`); this
 * package produces contract-valid instances from the append-only log and the plan.
 *
 * The honesty rule is in the interface: `unavailable` is a first-class output. A corpus signal that this build
 * cannot compute is listed with its reason, never silently missing - "no HRV" and "HRV is fine" are different
 * claims, and a plan must not confuse them.
 */
import type { DayEntry, DayEntryOutcome, PlanVersion, Signal, SignalKey } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";

export interface SignalInput {
  userId: string;
  /** The runner's local training day, injected. Nothing here reads a clock. */
  today: string;
  /** The append-only log, any order; the highest revision per day wins. */
  entries: readonly DayEntry[];
  plan: PlanVersion;
  knowledge: KnowledgeBundle;
  /** ISO timestamp, injected by the caller so the output is reproducible. */
  computedAt: string;
  /** Days with imported activity, for `device_coverage`; empty until imports exist (M4). */
  importedDays?: readonly string[];
}

export interface DayRollup {
  day: string;
  plannedSessions: number;
  plannedKm: number;
  plannedHardDays: number;
  restDay: boolean;
  /** True when a revision exists for the day. */
  logged: boolean;
  outcome: DayEntryOutcome | null;
  completedKm: number;
  /** completedKm / plannedKm, null when the day planned no distance. */
  adherence: number | null;
  /** A past day that closed with no entry. Absence is information, never a zero (feedback-loop.md). */
  unlogged: boolean;
}

export interface UnavailableSignal {
  key: SignalKey;
  reason: string;
}

export interface SignalOutput {
  rollups: DayRollup[];
  /** Sorted by key, so two runs of the same input are byte-identical. */
  signals: Signal[];
  unavailable: UnavailableSignal[];
}
