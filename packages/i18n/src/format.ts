/**
 * The catalogue lookup and the one formatter. Small on purpose: a template engine with conditionals is a
 * language the copywriter has to learn, and the copy is the product's voice, not a program.
 *
 * Rules the formatter enforces instead of trusting:
 * - an unknown `{slot}` is an error, never left in the output;
 * - a missing slot is an error, never an empty string that reads like a typo in production;
 * - a number is rendered with at most one decimal and no thousands separator, because a comment with
 *   "1,234.0 km" is a dashboard, not a coach.
 */
import type { DayName } from "@training-planner/domain";
import { weekdayIndex } from "@training-planner/planner-core";
import { en } from "./catalogues/en";
import { zhHant } from "./catalogues/zh-Hant";
import type { Locale, Messages } from "./types";

export const catalogues: Record<Locale, Messages> = { en, "zh-Hant": zhHant };

export function messagesFor(locale: Locale): Messages {
  return catalogues[locale];
}

const DAY_NAMES: readonly DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The weekday name for a civil day, in the locale. Dates never reach the comment as digits. */
export function weekdayName(locale: Locale, day: string): string {
  const index = weekdayIndex(day);
  const name = DAY_NAMES[index];
  if (name === undefined) throw new Error(`not a civil day: ${day}`);
  return messagesFor(locale).weekday[name];
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`cannot render a non-finite number: ${value}`);
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export type SlotValue = string | number;

export function format(template: string, slots: Record<string, SlotValue>): string {
  const missing: string[] = [];
  const rendered = template.replace(/\{([a-zA-Z][a-zA-Z0-9_-]*)\}/g, (_match, name: string) => {
    const value = slots[name];
    if (value === undefined) {
      missing.push(name);
      return "";
    }
    return typeof value === "number" ? formatNumber(value) : value;
  });
  if (missing.length > 0) throw new Error(`template is missing slots: ${missing.join(", ")}`);
  const leftover = /\{[^}]*\}/.exec(rendered);
  if (leftover) throw new Error(`template has an unknown placeholder: ${leftover[0]}`);
  return rendered.replace(/\s+/g, " ").trim();
}

/** Placeholders a template needs, in order. Used by the parity test and by the narrator's slot preparation. */
export function placeholdersOf(template: string): string[] {
  const found = template.match(/\{[a-zA-Z][a-zA-Z0-9_-]*\}/g) ?? [];
  return found.map((placeholder) => placeholder.slice(1, -1));
}
