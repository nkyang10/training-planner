/**
 * The request the coach chat is allowed to see, assembled deterministically.
 *
 * Same input => byte-identical request: no clock, no randomness, no I/O. The caller supplies `today` inside the
 * facts, and the history window is a fixed tail so a long conversation cannot quietly change what the model is
 * grounded in. The rules are restated in the request itself, not only in prompt prose, so a caller can assert that
 * the rules being enforced are the rules that were sent.
 */
import type { CoachChatImage, CoachChatRequest, CoachChatTurn, CoachFactSnapshot } from "./types";

/** The rules the model cannot break. Order is part of the contract; the validator mirrors the ones it can check. */
export const COACH_CHAT_RULES: readonly string[] = [
  "You are the runner's coach. You may explain, encourage and point at the facts you were given.",
  "Never invent a number: every number you write must appear in the facts or the question.",
  "You may not change a plan yourself. If a change is warranted, set proposeReview=true and let the bounded review decide.",
  "Safety guidance outranks training guidance; medical topics end with a clinician referral.",
  "Answer in the runner's language, in at most 120 words.",
];

/** Only the newest turns reach the model; older context is not a licence to invent facts. */
export const MAX_HISTORY_TURNS = 100;

/** The character budget for history + question, so a long conversation cannot grow the prompt without bound. */
export const MAX_CONTEXT_CHARS = 100_000;

/** A question longer than this is truncated rather than rejected, so a paste cannot dominate the prompt. */
export const MAX_QUESTION_CHARS = 1000;

export interface BuildCoachChatInput {
  facts: CoachFactSnapshot;
  history: readonly CoachChatTurn[];
  question: string;
  images?: readonly CoachChatImage[];
}

/** Copy the snapshot so a later mutation by the caller cannot change a request that was already built. */
function cloneFacts(facts: CoachFactSnapshot): CoachFactSnapshot {
  return {
    today: facts.today,
    planSummary: facts.planSummary,
    recentEntries: [...facts.recentEntries],
    comment: facts.comment,
    references: facts.references.map((reference) => ({
      id: reference.id,
      text: reference.text,
      tier: reference.tier,
    })),
    ...(facts.attachments === undefined ? {} : { attachments: facts.attachments }),
  };
}

/** A turn with no text carries no meaning for the model, so it is dropped rather than sent as an empty message. */
function normalizeTurn(turn: CoachChatTurn): CoachChatTurn | null {
  const text = turn.text.trim();
  if (text.length === 0) return null;
  return { role: turn.role, text };
}

export function buildCoachChatRequest(input: BuildCoachChatInput): CoachChatRequest {
  const normalized = input.history
    .map(normalizeTurn)
    .filter((turn): turn is CoachChatTurn => turn !== null);
  const dropped = normalized.slice(0, Math.max(0, normalized.length - MAX_HISTORY_TURNS));
  let history = normalized.slice(-MAX_HISTORY_TURNS);
  const question = input.question.trim().slice(0, MAX_QUESTION_CHARS).trim();
  // The newest turns matter most: drop the oldest until the prompt fits the character budget. The question always
  // survives; a conversation never silently loses the thing the runner just asked.
  let chars = history.reduce((total, turn) => total + turn.text.length, 0) + question.length;
  while (history.length > 0 && chars > MAX_CONTEXT_CHARS) {
    const removed = history[0];
    chars -= removed === undefined ? 0 : removed.text.length;
    history = history.slice(1);
  }
  // A compact digest of the turns that fell out of the window: names and the first 40 characters only, capped so the
  // summary can never become a second, unbounded transcript.
  const summary = dropped
    .map((turn) => `${turn.role}: ${turn.text.slice(0, 40)}`)
    .join(" | ")
    .slice(0, 2000);
  return {
    system: { rules: [...COACH_CHAT_RULES], facts: cloneFacts(input.facts) },
    history,
    question,
    ...(summary.length === 0 ? {} : { summary }),
    ...(input.images === undefined || input.images.length === 0 ? {} : { images: [...input.images] }),
  };
}
