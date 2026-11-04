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
  /** Labels the chip and the nudge carry; not sentences. */
  label: {
    changedBecause: string;
    gaveUp: string;
    nudge: string;
  };
}
