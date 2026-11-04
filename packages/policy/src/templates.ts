/**
 * The template ids the engine may emit, as a runtime list as well as a type.
 *
 * The type alone would let a catalogue go stale in silence: adding a template to the union and forgetting the
 * catalogues is a compile error, but removing the last emitter of a template is not. The i18n parity test
 * compares its catalogue keys to this list, and the check at the bottom of this file fails the build if a
 * template in the union is missing from the list.
 */
import type { FactTemplate } from "./types";

export const FACT_TEMPLATES = [
  "acknowledge.completed",
  "acknowledge.partial",
  "acknowledge.alternate",
  "acknowledge.rest",
  "acknowledge.skipped",
  "interpret.effort-gap",
  "interpret.legs-heavy",
  "interpret.sleep-short",
  "interpret.extra-subtracts",
  "interpret.pain-reported",
  "redirect.tomorrow-kept",
  "redirect.tomorrow-downgraded",
  "redirect.tomorrow-swapped",
  "redirect.safety-instruction",
  "redirect.review-offered",
  "redirect.nudge-unlogged",
] as const satisfies readonly FactTemplate[];

type MissingTemplate = Exclude<FactTemplate, (typeof FACT_TEMPLATES)[number]>;
/** Fails to compile when a template exists in the union and not in the list. */
const completeness: MissingTemplate extends never ? true : MissingTemplate = true;
export const TEMPLATE_LIST_IS_COMPLETE: true = completeness;

export const ADJUST_REASON_KEYS = [
  "missed-quality-moved",
  "extra-activity-guard",
  "readiness-downgrade",
  "illness-hold",
  "pain-hold",
] as const;

export const ADJUST_COST_KEYS = ["easy-day-becomes-quality", "quality-becomes-easy", "no-intensity-this-week"] as const;

export const STOP_INSTRUCTION_KEYS = ["chest-urgent", "illness-hold", "bone-referral", "pain-hold"] as const;
