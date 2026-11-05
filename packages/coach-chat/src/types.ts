/**
 * What the coach chat is allowed to see and what it is allowed to say, as types only.
 *
 * The model never chooses a distance, a pace or a threshold (AGENTS.md rule 2). It receives a snapshot of facts the
 * deterministic side already computed, and it returns language plus - at most - a request that the bounded review
 * look again. Every number in its answer must be traceable to this snapshot, which is why the snapshot is a closed
 * record of strings rather than a live plan.
 */

export interface CoachFactSnapshot {
  today: string;
  planSummary: string; // e.g. "4 weeks, 71.4 km planned, 16 sessions"
  recentEntries: readonly string[]; // e.g. "2026-11-03 completed 4.2 km, knee pain 3/10"
  comment: string | null;
  references: readonly { id: string; text: string; tier: "safety" | "training" | "tone" }[];
  /** How many images the runner attached to this turn; the model is told, not shown (text-only port). */
  attachments?: number;
}

export interface CoachChatTurn {
  role: "user" | "coach";
  text: string;
}

export interface CoachChatRequest {
  system: { rules: readonly string[]; facts: CoachFactSnapshot };
  history: readonly CoachChatTurn[];
  question: string;
}

export interface CoachReply {
  reply: string;
  proposeReview: boolean;
  reasonCode: string | null;
}
