export type CoachRole = "user" | "coach";

/** An image the runner attached to a turn (a photo of an injury, a race result, a physio note). */
export interface CoachAttachment {
  attachmentId: string;
  /** The runner's original filename, display only; the stored file is named by attachmentId. */
  filename: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  kind: "photo" | "record";
}
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
  /** Images attached to this turn; the file lives outside the message row (see docs). */
  attachments?: readonly CoachAttachment[];
}
