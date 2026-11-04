/**
 * The daily prompt's frozen interface.
 *
 * The rare event - a review - had a policy before the daily one did (backlog row 8, M2 review F1). This package
 * owns *when* a prompt may be delivered, never what it says: copy lives in the message catalogue, the narrator owns
 * the sentence, and the caller owns delivery.
 */
import type { DayEntry, PlanVersion } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";

/** Every prompt kind shares one budget: a review prompt that does not count is a prompt on top of the nudge. */
export type PromptKind = "nudge" | "review" | "weekly-summary";

/** One prompt that was actually delivered. The caller records these; the module never invents history. */
export interface DeliveredPrompt {
  kind: PromptKind;
  day: string;
}

export interface NudgeInput {
  userId: string;
  /** The training day the decision is for. Injected, never read. */
  today: string;
  /** Local minute-of-day, 0..1439. Injected: a pure function does not own a clock. */
  nowMinute: number;
  entries: readonly DayEntry[];
  /** Null when no plan covers the day: there is nothing to nudge about. */
  plan: PlanVersion | null;
  delivered: readonly DeliveredPrompt[];
  /**
   * Local hour-of-day (0..23) of each day the runner actually logged, computed by the caller from the entry and
   * its zone. Local, not UTC: a 19:00 habit in Taipei is 11:00 UTC, and a median of UTC hours would be a median of
   * the wrong clock.
   */
  loggingHours: readonly number[];
  knowledge: KnowledgeBundle;
}

export type NudgeReason =
  | "ok"
  | "no-plan"
  | "already-answered"
  | "nothing-pending"
  | "delivered"
  | "budget"
  | "quiet-hours"
  | "silence-ladder";

export interface NudgeDecision {
  /** The prompt to deliver, or null with a reason. */
  prompt: { kind: "nudge"; atMinute: number; forDay: string } | null;
  reason: NudgeReason;
  /** What the decision was based on, so a runner can be told why a prompt did or did not arrive. */
  evidence: {
    nudgeHour: number;
    source: "behaviour" | "default";
    samples: number;
    quietHours: { start: number; end: number };
    ladderStep: number | null;
  };
  budget: { usedToday: number; usedThisWeek: number; perDay: number; perWeek: number };
}
