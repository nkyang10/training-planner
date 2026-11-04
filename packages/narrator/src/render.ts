/**
 * The narrator: a fact object in, sentences out. Nothing is decided here.
 *
 * The pipeline is the template-only path of docs/engine/feedback-loop.md §5, and that path is a complete
 * feature, not a degraded mode: it is offline, cheap, auditable and deterministic, and it is what an LLM
 * rewrite (later, optional) would be measured against. No LLM is reachable from this package.
 */
import type { SessionKind } from "@training-planner/domain";
import { format, formatNumber, messagesFor, weekdayName } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import type { CommentFacts, FactLine, MicroAdjustment, StopInstructionKey } from "@training-planner/policy";
import { assertGrounded, assertNoBannedLanguage, assertScript, assertTone, NarratorError } from "./guardrails";

export interface RenderOptions {
  locale: Locale;
}

export interface RenderedComment {
  sentences: string[];
  text: string;
  /** Present when the day was not logged: the nudge is a different channel, not a comment sentence. */
  nudge?: string;
  silence: boolean;
}

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g;

/**
 * Turn the engine's slot vocabulary into the catalogue's: a civil day becomes a weekday name (a date in a
 * comment is a dashboard), a session kind becomes a word in the locale, and an instruction key becomes the
 * fixed stop sentence. Everything else passes through untouched.
 */
function prepareSlotMap(slots: Record<string, string | number>, locale: Locale): Record<string, string | number> {
  const messages = messagesFor(locale);
  const prepared: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(slots)) {
    if (key === "day" && typeof value === "string") {
      prepared["weekday"] = weekdayName(locale, value);
    } else if (key === "kind" && typeof value === "string") {
      prepared["kind"] = messages.kind[value as SessionKind] ?? value;
    } else if (key === "instruction" && typeof value === "string") {
      prepared["instruction"] = messages.stop[value as StopInstructionKey] ?? value;
    } else {
      prepared[key] = value;
    }
  }
  return prepared;
}

/** The fixed copy with the placeholders removed: its numbers are copy, not data. */
function literalOf(template: string): string {
  return template.replace(PLACEHOLDER, "");
}

/**
 * The fixed copy behind a template. For the safety sentence the template is a placeholder, so the literal is
 * the stop copy itself - its "48 hours" is a rule, not a measurement, and a guardrail that rejected it would
 * force the rule into the data.
 */
function literalFor(line: FactLine, locale: Locale): string {
  const messages = messagesFor(locale);
  if (line.template === "redirect.safety-instruction") {
    const key = line.slots["instruction"];
    return typeof key === "string" ? (messages.stop[key as StopInstructionKey] ?? "") : "";
  }
  return literalOf(messages.comment[line.template]);
}

function renderLine(line: FactLine, locale: Locale, allowedNumbers: readonly number[]): string {
  const template = messagesFor(locale).comment[line.template];
  let text: string;
  try {
    text = format(template, prepareSlotMap(line.slots, locale));
  } catch (error) {
    throw new NarratorError(`${locale} ${line.template}: ${error instanceof Error ? error.message : String(error)}`);
  }
  assertGrounded(text, literalFor(line, locale), allowedNumbers);
  assertNoBannedLanguage(text, locale);
  assertTone(text, locale);
  assertScript(text, locale);
  return text;
}

export function renderComment(facts: CommentFacts, options: RenderOptions): RenderedComment {
  const { locale } = options;
  // A safety action speaks first: daily-feedback-rules.yaml#safety-text-first requires the instruction to be
  // sentence one, with coaching content suppressed. Everything else keeps the AIR order.
  const ordered = facts.tone.safetyFirst
    ? [...facts.redirect, ...facts.acknowledge, ...facts.interpret]
    : [...facts.acknowledge, ...facts.interpret, ...facts.redirect];
  const sentences = facts.silence ? [] : ordered.map((line) => renderLine(line, locale, facts.allowedNumbers));
  const nudge = facts.nudge === undefined ? undefined : renderLine(facts.nudge, locale, facts.allowedNumbers);
  return {
    sentences,
    text: sentences.join(" "),
    ...(nudge === undefined ? {} : { nudge }),
    silence: facts.silence,
  };
}

/**
 * The chip on tomorrow's cell: what changed, why, and what it costs. The shape is fixed by
 * docs/engine/feedback-loop.md §4.4; the words come from the catalogue.
 */
export function renderAdjustment(adjustment: MicroAdjustment, options: RenderOptions): string {
  const { locale } = options;
  const messages = messagesFor(locale);
  const before = `${messages.kind[adjustment.before.kind]} ${formatNumber(adjustment.before.km)} km`;
  const after = `${messages.kind[adjustment.after.kind]} ${formatNumber(adjustment.after.km)} km`;
  const reason = format(messages.reason[adjustment.reasonKey], prepareSlotMap(adjustment.reasonSlots, locale));
  const cost = format(messages.cost[adjustment.costKey], prepareSlotMap(adjustment.costSlots, locale));
  const chip = `${before} → ${after} — ${messages.label.changedBecause} ${reason}; ${messages.label.gaveUp} ${cost}`;

  const numbers = [
    adjustment.before.km,
    adjustment.after.km,
    ...Object.values(adjustment.reasonSlots).filter((value): value is number => typeof value === "number"),
    ...Object.values(adjustment.costSlots).filter((value): value is number => typeof value === "number"),
  ];
  assertGrounded(chip, "", numbers);
  assertNoBannedLanguage(chip, locale);
  assertTone(chip, locale);
  return chip;
}

/** The one-line version a nudge notification shows; the nudge itself is rendered by renderComment. */
export function nudgeLabel(options: RenderOptions): string {
  return messagesFor(options.locale).label.nudge;
}
