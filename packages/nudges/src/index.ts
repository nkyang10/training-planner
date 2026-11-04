/**
 * packages/nudges: when a prompt may be delivered, and why it was not. Pure, so a decision can be replayed and
 * explained; delivery and persistence belong to the caller.
 */
export { decideNudge } from "./decide";
export type { DeliveredPrompt, NudgeDecision, NudgeInput, NudgeReason, PromptKind } from "./types";
