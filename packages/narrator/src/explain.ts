/**
 * The explanation surface: the plan described the way a runner reads it, not the way a dashboard shows it.
 *
 * Two findings from the M1 structural review live here:
 * - F3: a plan that begins mid-week shows a partial first week, and its raw kilometres read as a jump
 *   (the marathon block reads 23.6 km then 44.6 km, +89%) while the 7-day-normalised rate moves +8%. The
 *   explanation must say both numbers, or the runner distrusts a plan that is correct.
 * - F2's first half: an alternate must state what it gave up. Alternates do not exist in the engine yet
 *   (backlog), so the explanation names the trade-off only where the engine can actually state it.
 *
 * The sentences go through the same guardrails as a comment: numbers are grounded, banned language is
 * refused, tone and script are checked per locale.
 */
import type { PlanVersion } from "@training-planner/domain";
import { format, messagesFor, weekdayName } from "@training-planner/i18n";
import type { ExplainTemplate, Locale } from "@training-planner/i18n";
import { weekStart } from "@training-planner/planner-core";
import { assertGrounded, assertNoBannedLanguage, assertScript, assertTone } from "./guardrails";

export interface WeekSummary {
  weekStart: string;
  sessions: number;
  km: number;
  /** What this week would be over seven days; the only comparable number when the first or last week is partial. */
  rateKm: number;
  isPartial: boolean;
  hardDays: number;
  longRunKm: number;
}

const QUALITY_KINDS = new Set(["tempo", "vo2max", "hills", "mp", "test", "race"]);
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** One summary per Monday-Sunday week, in order. Pure: the plan is the only input. */
export function summariseWeeks(version: PlanVersion): WeekSummary[] {
  const weeks = new Map<string, WeekSummary>();
  for (const session of version.sessions) {
    const key = weekStart(session.day);
    const current = weeks.get(key) ?? { weekStart: key, sessions: 0, km: 0, rateKm: 0, isPartial: false, hardDays: 0, longRunKm: 0 };
    weeks.set(key, {
      ...current,
      sessions: current.sessions + 1,
      km: current.km + (session.distanceKm ?? 0),
      hardDays: current.hardDays + (session.hardDay === true || QUALITY_KINDS.has(session.kind) ? 1 : 0),
      longRunKm: current.longRunKm + (session.kind === "long" ? (session.distanceKm ?? 0) : 0),
    });
  }
  return [...weeks.values()]
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
    .map((week) => {
      const isPartial = week.sessions < 7;
      const rateKm = week.sessions === 0 ? 0 : round1((week.km * 7) / week.sessions);
      return { ...week, km: round1(week.km), rateKm, isPartial, longRunKm: round1(week.longRunKm) };
    });
}

export interface ExplainOptions {
  locale: Locale;
}

export interface PlanExplanation {
  sentences: string[];
  text: string;
  weeks: WeekSummary[];
}

interface Line {
  template: ExplainTemplate;
  slots: Record<string, string | number>;
}

function render(line: Line, locale: Locale, allowedNumbers: readonly number[]): string {
  const template = messagesFor(locale).explain[line.template];
  const text = format(template, line.slots);
  assertGrounded(text, template.replace(/\{[a-zA-Z][a-zA-Z0-9_-]*\}/g, ""), allowedNumbers);
  assertNoBannedLanguage(text, locale);
  assertTone(text, locale);
  assertScript(text, locale);
  return text;
}

/**
 * The explanation a runner reads: what the block is, the week that peaks, and — when the plan starts or ends
 * mid-week — the normalised rate that makes the first week comparable instead of alarming.
 */
export function renderPlanExplanation(version: PlanVersion, options: ExplainOptions): PlanExplanation {
  const { locale } = options;
  const weeks = summariseWeeks(version);
  const totalKm = round1(weeks.reduce((sum, week) => sum + week.km, 0));
  const peak = weeks.reduce<WeekSummary | undefined>((best, week) => (best === undefined || week.km > best.km ? week : best), undefined);

  const lines: Line[] = [
    { template: "explain.summary", slots: { sessions: version.sessions.length, weeks: weeks.length, km: totalKm } },
  ];

  const first = weeks[0];
  if (first !== undefined) {
    const template: ExplainTemplate = first.hardDays === 1 ? "explain.week-one" : "explain.week-many";
    lines.push({
      template,
      slots: { weekday: weekdayName(locale, first.weekStart), km: first.km, hard: first.hardDays },
    });
    if (first.isPartial) {
      // The raw number and the comparable number, side by side. One without the other is how a correct plan
      // looks wrong to the person who has to run it.
      lines.push({
        template: "explain.partial",
        slots: { km: first.km, days: first.sessions, rate: first.rateKm },
      });
    }
  }

  if (peak !== undefined) {
    lines.push({ template: "explain.peak", slots: { km: peak.km, long: peak.longRunKm } });
  }

  const allowedNumbers = [
    version.sessions.length,
    weeks.length,
    totalKm,
    ...weeks.flatMap((week) => [week.km, week.rateKm, week.hardDays, week.longRunKm, week.sessions]),
  ];
  const sentences = lines.map((line) => render(line, locale, allowedNumbers));
  return { sentences, text: sentences.join(" "), weeks };
}
