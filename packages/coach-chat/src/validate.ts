/**
 * The deterministic gate a coach chat reply must pass before a runner ever reads it.
 *
 * The model may be fluent and wrong, so its output is treated as a claim: the shape is exact, every number is
 * traceable to the facts or the question, links are refused (a chat is not a referral channel), and asking the
 * review to look again requires naming the signal that prompted it. What this file deliberately does not do: it
 * does not call a model, read a clock, or apply a plan change. A change is the bounded review's job, never the
 * chat's.
 */
import type { CoachFactSnapshot, CoachReply } from "./types";

export type CoachReplyValidation =
  | { ok: true; reply: CoachReply }
  | { ok: false; code: string; detail: string };

/** The reply is a closed record: an extra key is a field nobody validated, so it is refused. */
const REPLY_FIELDS = ["reply", "proposeReview", "reasonCode"] as const;

/** The only number shape the coach may write; matching the extraction and the grounding check keeps them honest. */
const NUMBER_PATTERN = /\d+(?:\.\d+)?/g;

const URL_PATTERN = /https?:\/\//i;

export const MAX_REPLY_CHARS = 600;

function fail(code: string, detail: string): CoachReplyValidation {
  return { ok: false, code, detail };
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/** A number is compared by value, so a reply "4.20" is grounded by a fact "4.2" and "03" by "3". */
function canonicalNumber(token: string): string {
  const value = Number(token);
  return Number.isFinite(value) ? String(value) : token;
}

function numbersIn(text: string): Set<string> {
  const numbers = new Set<string>();
  for (const token of text.match(/\d+(?:\.\d+)?/g) ?? []) numbers.add(canonicalNumber(token));
  return numbers;
}

/** Every string the model was shown, including the question: the grounding rule's whole universe. */
function groundingText(facts: CoachFactSnapshot, question: string): string {
  const references = facts.references.map((reference) => `${reference.id} ${reference.tier} ${reference.text}`);
  return [facts.today, facts.planSummary, ...facts.recentEntries, facts.comment ?? "", ...references, question].join("\n");
}

export function validateCoachReply(
  value: unknown,
  facts: CoachFactSnapshot,
  question: string,
): CoachReplyValidation {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return fail("not-an-object", `expected an object, received ${describe(value)}`);
  }
  const record = value as Record<string, unknown>;

  const extra = Object.keys(record)
    .filter((key) => !(REPLY_FIELDS as readonly string[]).includes(key))
    .sort();
  if (extra.length > 0) {
    return fail("extra-keys", `reply carries key(s) the contract does not allow: ${extra.join(", ")}`);
  }
  const missing = REPLY_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(record, field));
  if (missing.length > 0) {
    return fail("missing-keys", `reply is missing required key(s): ${missing.join(", ")}`);
  }

  const { reply, proposeReview, reasonCode } = record;
  if (typeof reply !== "string" || reply.trim().length === 0) {
    return fail("empty-reply", "reply must be a non-empty string");
  }
  if (reply.length > MAX_REPLY_CHARS) {
    return fail("reply-too-long", `reply is ${reply.length} characters; the limit is ${MAX_REPLY_CHARS}`);
  }
  if (typeof proposeReview !== "boolean") {
    return fail("invalid-propose-review", `proposeReview must be a boolean, received ${describe(proposeReview)}`);
  }
  if (reasonCode !== null && typeof reasonCode !== "string") {
    return fail("invalid-reason-code", `reasonCode must be a string or null, received ${describe(reasonCode)}`);
  }

  // Grounding: a number the model did not see is an invented fact, whatever it is attached to.
  const grounded = numbersIn(groundingText(facts, question));
  for (const token of reply.match(NUMBER_PATTERN) ?? []) {
    if (!grounded.has(canonicalNumber(token))) {
      return fail("ungrounded-number", `reply uses ${token}, which appears in neither the facts nor the question`);
    }
  }

  // Asking the review to look again must name why; the reason vocabulary is the caller's, not the chat's.
  if (proposeReview && (reasonCode === null || reasonCode.trim().length === 0)) {
    return fail("reason-required", "proposeReview is true, so reasonCode must name the signal that triggered the review");
  }

  // No links: the coach points at the facts it was given, and medical topics end with a clinician referral, not a URL.
  if (URL_PATTERN.test(reply)) {
    return fail("no-links", "reply must not contain a URL");
  }

  return { ok: true, reply: { reply, proposeReview, reasonCode } };
}
