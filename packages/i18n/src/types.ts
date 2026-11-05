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
  DailyCostKey,
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
  | "web.brand"
  | "web.stat-planned-km"
  | "web.stat-done-km"
  | "web.stat-sessions"
  | "web.brand-tagline"
  | "web.side-train"
  | "web.side-log"
  | "web.side-plan"
  | "web.side-account"
  | "web.side-today"
  | "web.login-title"
  | "web.login-hint"
  | "web.login-button"
  | "web.calendar-title"
  | "web.day-link"
  | "web.day-title"
  | "web.session"
  | "web.session-duration"
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
  | "web.session-taken"
  | "web.taken-as-prescribed"
  | "web.taken-alternate"
  | "web.taken-extra"
  | "web.correction-reason"
  | "web.pain-link"
  | "web.pain-title"
  | "web.pain-empty"
  | "web.pain-row"
  | "web.pain-flags"
  | "web.pain-trend-rising"
  | "web.pain-trend-falling"
  | "web.pain-trend-stable"
  | "web.pain-trend-unknown"
  | "web.pain-trend-none"
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
  | "web.review-cost"
  | "web.option-keep-the-plan"
  | "web.option-ease-the-easy-day"
  | "web.option-replan-for-orientation"
  | "web.option-advisor-proposal"
  | "web.pain-flag-night"
  | "web.pain-flag-gait"
  | "web.pain-flag-known"
  | "web.wizard-change"
  | "web.review-replan-summary"
  | "web.season-link"
  | "web.season-title"
  | "web.season-back"
  | "web.season-week"
  | "web.season-planned"
  | "web.season-done"
  | "web.season-sessions"
  | "web.season-hard"
  | "web.season-logged"
  | "web.season-adherence"
  | "web.season-adherence-none"
  | "web.season-empty"
  | "web.season-future"
  | "web.season-current"
  | "web.season-past"
  | "web.export-link"
  | "web.console-link"
  | "web.nav-week"
  | "web.nav-connections"
  | "web.nav-coach"
  | "web.coach-title"
  | "web.coach-sub"
  | "web.coach-empty"
  | "web.coach-you"
  | "web.coach-coach"
  | "web.coach-placeholder"
  | "web.coach-send"
  | "web.coach-review-opened"
  | "web.coach-context"
  | "web.coach-error"
  | "web.nav-stats"
  | "web.stats-title"
  | "web.coach-ask-title"
  | "web.coach-ask-sub"
  | "web.coach-ask-placeholder"
  | "web.coach-ask-button"
  | "web.coach-ask-opened"
  | "web.coach-ask-none"
  | "web.coach-ask-suppressed"
  | "web.sync-garmin"
  | "web.sync-done"
  | "web.sync-failed"
  | "web.stats-trend"
  | "web.readiness-7"
  | "web.readiness-short"
  | "web.stats-sub"
  | "web.stats-planned-sessions"
  | "web.stats-done-sessions"
  | "web.stats-adherence"
  | "web.stats-logged"
  | "web.stats-week"
  | "web.stats-empty"
  | "web.stats-comments"
  | "web.stats-no-comments"
  | "web.grid-today"
  | "web.month-prev"
  | "web.month-next"
  | "web.grid-jump"
  | "web.grid-go"
  | "web.grid-totals"
  | "web.grid-empty"
  | "web.week-this"
  | "web.month-this"
  | "web.connections-strava"
  | "web.connections-garmin"
  | "web.connections-title"
  | "web.connections-intro"
  | "web.connections-status"
  | "web.connections-connected"
  | "web.connections-not-connected"
  | "web.connections-never"
  | "web.connections-last-sync"
  | "web.connections-display-name"
  | "web.connections-link-strava"
  | "web.connections-strava-hint"
  | "web.connections-garmin-key"
  | "web.connections-garmin-key-hint"
  | "web.connections-connect"
  | "web.connections-sync-from"
  | "web.connections-manual"
  | "web.connections-both"
  | "web.connections-save-sync"
  | "web.connections-sync-now"
  | "web.connections-sync-hint"
  | "web.connections-saved"
  | "web.connections-connected-message"
  | "web.connections-synced-message"
  | "web.connections-error"
  | "web.connections-no-credential"
  | "web.nav-month"
  | "web.nav-season"
  | "web.nav-console"
  | "web.nav-wizard"
  | "web.nav-pain"
  | "web.nav-export"
  | "web.month-title"
  | "web.month-empty"
  | "web.month-week"
  | "web.month-peak"
  | "web.month-final"
  | "web.month-back"
  | "web.week-title"
  | "web.week-prev"
  | "web.week-next"
  | "web.week-back"
  | "web.week-note"
  | "web.calendar-prev"
  | "web.calendar-next"
  | "web.calendar-peak"
  | "web.calendar-final"
  | "web.calendar-note"
  | "web.season-peak"
  | "web.season-final"
  | "web.console-title"
  | "web.console-empty"
  | "web.console-original"
  | "web.console-current"
  | "web.console-guidelines"
  | "web.console-guidelines-empty"
  | "web.console-back"
  | "web.admin-title"
  | "web.admin-login-hint"
  | "web.admin-login-button"
  | "web.admin-guidelines-title"
  | "web.admin-guidelines-empty"
  | "web.admin-guideline-id"
  | "web.admin-version"
  | "web.admin-tier"
  | "web.admin-scope"
  | "web.admin-visibility"
  | "web.admin-text"
  | "web.admin-rationale"
  | "web.admin-effective-from"
  | "web.admin-create"
  | "web.admin-forbidden"
  | "web.admin-duplicate"
  | "web.admin-saved"
  | "web.admin-logout"
  | "web.duration";

export type WizardTemplate =
  | "wizard.title"
  | "wizard.progress"
  | "wizard.next"
  | "wizard.finish"
  | "wizard.saved"
  | "wizard.done"
  | "wizard.back"
  | "wizard.required"
  | "wizard.goal.question"
  | "wizard.goal.finish"
  | "wizard.goal.time"
  | "wizard.goal.experience"
  | "wizard.goal.fitness-maintenance"
  | "wizard.goal.return-to-running"
  | "wizard.availability.question"
  | "wizard.risk-appetite.question"
  | "wizard.risk-appetite.conservative"
  | "wizard.risk-appetite.moderate"
  | "wizard.risk-appetite.aggressive"
  | "wizard.weekly-hours.question"
  | "wizard.weekly-hours.unit";

export interface Messages {
  /** One sentence per comment template. `{slot}` placeholders are filled by packages/i18n's formatter. */
  comment: Record<FactTemplate, string>;
  /** Why a micro-adjustment happened, as a clause the chip can append. */
  reason: Record<AdjustReasonKey, string>;
  /** What the runner gives up, as a clause. */
  cost: Record<AdjustCostKey, string>;
  /** The daily trade-off: what a substitute or a cut session gave up. Same formatter and guardrails as a comment. */
  dailyCost: Record<DailyCostKey, string>;
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
  /** The onboarding wizard's questions, option labels and page copy (ADR-0009). */
  wizard: Record<WizardTemplate, string>;
  /** Labels the chip and the nudge carry; not sentences. */
  label: {
    changedBecause: string;
    gaveUp: string;
    nudge: string;
  };
}
