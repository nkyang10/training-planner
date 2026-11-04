/**
 * The nightly sweep's frozen interface.
 *
 * A worker is a process, and a process is hard to test. So the *decisions* live here as a pure function and the
 * process around it becomes four lines of wiring: which days closed, which closed with no entry, and what the
 * signal bundle was at the moment it closed. The scheduler is deployment work; this is not.
 */
import type { DayEntry, PlanVersion, Signal, TrainingEvent } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import type { DayRollup } from "@training-planner/signals";

export interface NightlyInput {
  userId: string;
  /** The training day the sweep runs for: the day *after* the last day it may close. Injected, never read. */
  today: string;
  entries: readonly DayEntry[];
  plan: PlanVersion;
  knowledge: KnowledgeBundle;
  /** ISO timestamp, injected so the sweep is reproducible. */
  computedAt: string;
  /** The runner's zone, stored on every day.closed event so a later read cannot re-home the day. */
  timezone: string;
  /** Days already closed by an earlier sweep: the sweep is idempotent, and this is how it knows. */
  closedDays?: readonly string[];
}

export type CloseStatus = "logged" | "closed-unlogged";

export interface ClosedDay {
  day: string;
  status: CloseStatus;
  /** What the plan said that day, so the close record is readable without the plan. */
  plannedKm: number;
  plannedSessions: number;
  /** What the runner reported, if anything. */
  outcome: DayRollup["outcome"];
  completedKm: number;
}

export interface SignalCacheEntry {
  userId: string;
  asOfDay: string;
  knowledgeHash: string;
  /** sha256 of the canonical input: two sweeps of the same log produce the same cache key. */
  inputsHash: string;
  signals: Signal[];
  computedAt: string;
}

export interface NightlyResult {
  /** Days this sweep closed, oldest first. Empty when it is run twice for the same day. */
  newlyClosed: ClosedDay[];
  /** Every past day that closed with no entry, oldest first: the nudge list. Absence is information, never a zero. */
  pending: string[];
  /** The bundle to cache as `signals_current`, or null when the plan does not cover the day. */
  signalCache: SignalCacheEntry | null;
  /** Days that were already closed and were therefore skipped. */
  skipped: string[];
  /**
   * The `day.closed` events a writer should append for `newlyClosed`, in the same order. Empty on a second sweep.
   * The sweep still writes nothing: this is the record, and the caller owns persistence.
   */
  events: TrainingEvent[];
}
