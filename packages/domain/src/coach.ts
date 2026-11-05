export type CoachRole = "user" | "coach";
export interface CoachMessage {
  messageId: string;
  userId: string;
  role: CoachRole;
  /** The runner's question or the coach's reply. Language only; numbers in a coach reply are grounded by the caller. */
  text: string;
  /** ISO instant the message was stored. */
  createdAt: string;
  /** Hash of the fact snapshot the coach answered from; empty for a user turn. */
  contextHash: string;
  /** Set when the coach's answer opened a review the runner can decide. */
  reviewId: string | null;
}
