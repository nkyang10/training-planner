/**
 * The catalogue contract. A catalogue is typed by the engine's own key unions, so a missing translation is a
 * compile error rather than a fallback language leaking into a runner's comment.
 *
 * Copy rules live in docs/ux/feedback-microcopy.md; the mechanical ones (number grounding, banned phrases,
 * exclamation limits, script match) are enforced in packages/narrator, not here. This package owns the words
 * and nothing else.
 */
import type {
  AdjustCostKey,
  AdjustReasonKey,
  FactTemplate,
  StopInstructionKey,
} from "@training-planner/policy";
import type { DayName, SessionKind } from "@training-planner/domain";

export type Locale = "en" | "zh-Hant";
export const LOCALES: readonly Locale[] = ["en", "zh-Hant"] as const;

export function isLocale(value: string): value is Locale {
  return value === "en" || value === "zh-Hant";
}

/** The explanation surface: a plan described in the runner s language, not a dashboard. */
export type ExplainTemplate =
  | "explain.summary"
  | "explain.week-one"
  | "explain.week-many"
  | "explain.partial"
  | "explain.peak";

/** The server-rendered pages: labels and short sentences, never numbers the engine did not produce. */
export type PromptTemplate = "prompt.log-day" | "prompt.log-gap";

export type WebTemplate =
  | "web.title"
  | "web.login-title"
  | "web.login-hint"
  | "web.login-button"
  | "web.calendar-title"
  | "web.day-link"
  | "web.day-title"
  | "web.session"
  | "web.rest-day"
  | "web.logged"
  | "web.not-logged"
  | "web.form-legend"
  | "web.outcome-completed"
  | "web.outcome-partial"
  | "web.outcome-skipped"
  | "web.outcome-rest"
  | "web.outcome-missed"
  | "web.completed-km"
  | "web.rpe"
  | "web.legs"
  | "web.note"
  | "web.save"
  | "web.comment-title"
  | "web.saved"
  | "web.adjusted"
  | "web.error"
  | "web.no-plan"
  | "web.sign-out"
  | "web.skip-reason"
  | "web.skip-reason-none"
  | "web.saved-locally"
  | "web.review-banner"
  | "web.review-title"
  | "web.review-options-legend"
  | "web.review-accept"
  | "web.review-decline"
  | "web.review-defer"
  | "web.review-accepted"
  | "web.review-declined"
  | "web.review-deferred"
  | "web.review-freeze"
  | "web.review-none"
  | "web.review-cost";

export interface Messages {
  /** One sentence per comment template. `{slot}` placeholders are filled by packages/i18n's formatter. */
  comment: Record<FactTemplate, string>;
  /** Why a micro-adjustment happened, as a clause the chip can append. */
  reason: Record<AdjustReasonKey, string>;
  /** What the runner gives up, as a clause. */
  cost: Record<AdjustCostKey, string>;
  /** The canonical stop sentences (language-guardrails.yaml#escalation-copy-is-fixed). */
  stop: Record<StopInstructionKey, string>;
  weekday: Record<DayName, string>;
  /** Session kinds are named, never printed as raw codes: a comment says "tempo", not "tempo" in Chinese. */
  kind: Record<SessionKind, string>;
  /** One sentence per explanation line. Same formatter, same guardrails as a comment. */
  explain: Record<ExplainTemplate, string>;
  /** The server-rendered pages. */
  web: Record<WebTemplate, string>;
  /** The prompt's copy. packages/nudges decides *when*; the words are here, in both languages. */
  prompt: Record<PromptTemplate, string>;
  /** Labels the chip and the nudge carry; not sentences. */
  label: {
    changedBecause: string;
    gaveUp: string;
    nudge: string;
  };
}
