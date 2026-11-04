/**
 * The pain trajectory, from rows.
 *
 * `painReportsOf` turns one entry into rows; this turns rows into the thing the triage actually needs - a direction
 * over a window - without reading any single entry. It is deliberately conservative: one report is a point, not a
 * trend, and saying "stable" from a single number is the same invented confidence as a fabricated pace.
 *
 * The window is seven days because `pain_trend` in packages/signals is a seven-day rolling signal; one window, one
 * home. If that signal's window ever changes, this constant changes with it - a second window would let the page and
 * the signal disagree about the same body.
 */
import type { PainReport } from "@training-planner/domain";
import { addDays } from "@training-planner/planner-core";

export const PAIN_TREND_WINDOW_DAYS = 7;

export type PainDirection = "rising" | "falling" | "stable" | "unknown";

export interface PainTrend {
  direction: PainDirection;
  /** Distinct days that carried a report inside the window. */
  days: number;
  /** The highest intensity in the window; null when the window is empty. */
  peak: number | null;
  /** The most recent intensity in the window; null when the window is empty. */
  latest: number | null;
  /** Any report in the window carried night pain - one of the triage's decisive flags. */
  nightPain: boolean;
  /** Any report in the window carried a gait change - the other decisive flag. */
  gaitChange: boolean;
  /** Why the direction is what it is, in data terms, so a page can be honest without composing prose. */
  note: "no-reports" | "one-report" | "compared-first-and-last";
}

export interface PainTrendInput {
  reports: readonly PainReport[];
  /** The runner's training day, injected: this function reads no clock. */
  today: string;
  /** Defaults to the signal's window; a caller may narrow it, never widen it by accident. */
  windowDays?: number;
}

const windowStart = (today: string, windowDays: number): string => addDays(today, -(windowDays - 1));

export function painTrendOf(input: PainTrendInput): PainTrend {
  const windowDays = input.windowDays ?? PAIN_TREND_WINDOW_DAYS;
  const start = windowStart(input.today, windowDays);
  const inside = input.reports
    .filter((report) => report.day >= start && report.day <= input.today)
    .slice()
    .sort((left, right) => (left.day < right.day ? -1 : left.day > right.day ? 1 : 0));

  const empty: PainTrend = {
    direction: "unknown",
    days: 0,
    peak: null,
    latest: null,
    nightPain: false,
    gaitChange: false,
    note: "no-reports",
  };
  if (inside.length === 0) return empty;

  const days = new Set(inside.map((report) => report.day)).size;
  const peak = Math.max(...inside.map((report) => report.intensity));
  const latest = inside[inside.length - 1]?.intensity ?? null;
  const flags = {
    nightPain: inside.some((report) => report.nightPain),
    gaitChange: inside.some((report) => report.trendGaitChange),
  };

  // One report is a point, not a trend: the direction is unknown and the note says why.
  if (days < 2) {
    return { direction: "unknown", days, peak, latest, ...flags, note: "one-report" };
  }

  const first = inside[0]?.intensity ?? 0;
  const last = inside[inside.length - 1]?.intensity ?? 0;
  const direction: PainDirection = last > first ? "rising" : last < first ? "falling" : "stable";
  return { direction, days, peak, latest, ...flags, note: "compared-first-and-last" };
}
