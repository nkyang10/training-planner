/**
 * The season: what the plan asked for and what actually happened, week by week.
 *
 * This is a pure function over a plan version and the runner's entries. It owns no clock, no storage and no
 * language: `today` is an argument, the repository supplies the rows, and the caller renders the numbers in the
 * runner's language. That is what lets the same summary answer the API and the page without drifting.
 */
import type { DayEntry, PlanVersion, Session } from "@training-planner/domain";
import { addDays, weekStart } from "@training-planner/planner-core";

/** One week of the plan, as asked for and as done. */
export interface SeasonWeek {
  /** Monday of the week (ISO day). */
  weekStart: string;
  /** `past` = ended before today, `current` = today is inside it, `future` = starts after today. */
  status: "past" | "current" | "future";
  plannedKm: number;
  completedKm: number;
  /** Non-rest sessions the plan prescribed in this week. */
  plannedSessions: number;
  /** Days whose latest entry says the session was done or partly done. */
  completedSessions: number;
  /** Sessions the plan marked as hard. */
  hardDays: number;
  /** Days in this week that carry any entry (the logging count). */
  loggedDays: number;
  /** Plan days in this week (a partial first or last week is smaller than seven). */
  plannedDays: number;
}

export interface SeasonTotals {
  plannedKm: number;
  completedKm: number;
  plannedSessions: number;
  completedSessions: number;
  hardDays: number;
  loggedDays: number;
  plannedDays: number;
}

export interface SeasonSummary {
  asOfDay: string;
  firstDay: string;
  lastDay: string;
  weeks: SeasonWeek[];
  totals: SeasonTotals;
  /**
   * Completed kilometres as a share of the kilometres the plan asked for **up to and including today**. Null
   * when the plan has no days up to today yet: a rate over no days is not zero, it is unknown.
   */
  adherencePct: number | null;
  weeksElapsed: number;
  weeksTotal: number;
}

export interface SeasonInput {
  plan: PlanVersion;
  /** Every entry the runner has, any revision order; the latest revision per day wins. */
  entries: readonly DayEntry[];
  today: string;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

const kmOf = (session: Session | undefined): number => {
  const distance = session?.distanceKm ?? 0;
  return typeof distance === "number" && Number.isFinite(distance) && distance > 0 ? distance : 0;
};

/** The latest revision per day: an entry is a revision, and the newest one is the day's answer. */
function latestByDay(entries: readonly DayEntry[]): Map<string, DayEntry> {
  const latest = new Map<string, DayEntry>();
  for (const entry of entries) {
    const current = latest.get(entry.day);
    if (current === undefined || entry.revision >= current.revision) latest.set(entry.day, entry);
  }
  return latest;
}

/**
 * What the day contributed, using the same rule the worker closes a day with: the reported distance when there
 * is one, the prescribed distance when the runner said "done as planned", and zero otherwise. A rest day is
 * zero kilometres and a logged day all the same.
 */
function completedKmOf(session: Session | undefined, entry: DayEntry): number {
  const reported = entry.completedKm;
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0) return reported;
  if (entry.outcome === "completed") return kmOf(session);
  return 0;
}

export function seasonSummary(input: SeasonInput): SeasonSummary {
  const { plan, today } = input;
  const entries = latestByDay(input.entries);
  const sessionsByDay = new Map<string, Session>();
  for (const session of plan.sessions) sessionsByDay.set(session.day, session);

  const planDays: string[] = [];
  for (let day = plan.firstDay; day <= plan.lastDay; day = addDays(day, 1)) planDays.push(day);

  const weeks = new Map<string, SeasonWeek>();
  for (const day of planDays) {
    const start = weekStart(day);
    const existing =
      weeks.get(start) ??
      ({
        weekStart: start,
        status: "future",
        plannedKm: 0,
        completedKm: 0,
        plannedSessions: 0,
        completedSessions: 0,
        hardDays: 0,
        loggedDays: 0,
        plannedDays: 0,
      } satisfies SeasonWeek);
    const session = sessionsByDay.get(day);
    const entry = entries.get(day);
    existing.plannedDays += 1;
    existing.plannedKm += kmOf(session);
    if (session !== undefined && !session.restDay) existing.plannedSessions += 1;
    if (session?.hardDay === true) existing.hardDays += 1;
    if (entry !== undefined) {
      existing.loggedDays += 1;
      existing.completedKm += completedKmOf(session, entry);
      if (entry.outcome === "completed" || entry.outcome === "partial") existing.completedSessions += 1;
    }
    weeks.set(start, existing);
  }

  const ordered = [...weeks.values()].sort((left, right) => (left.weekStart < right.weekStart ? -1 : 1));
  const todayWeek = weekStart(today);
  for (const week of ordered) {
    const weekEnd = addDays(week.weekStart, 6);
    week.status = weekEnd < today ? "past" : week.weekStart <= today ? "current" : "future";
    week.plannedKm = round1(week.plannedKm);
    week.completedKm = round1(week.completedKm);
  }

  const totals: SeasonTotals = ordered.reduce<SeasonTotals>(
    (sum, week) => ({
      plannedKm: sum.plannedKm + week.plannedKm,
      completedKm: sum.completedKm + week.completedKm,
      plannedSessions: sum.plannedSessions + week.plannedSessions,
      completedSessions: sum.completedSessions + week.completedSessions,
      hardDays: sum.hardDays + week.hardDays,
      loggedDays: sum.loggedDays + week.loggedDays,
      plannedDays: sum.plannedDays + week.plannedDays,
    }),
    { plannedKm: 0, completedKm: 0, plannedSessions: 0, completedSessions: 0, hardDays: 0, loggedDays: 0, plannedDays: 0 },
  );
  totals.plannedKm = round1(totals.plannedKm);
  totals.completedKm = round1(totals.completedKm);

  // Only days that have happened are in the denominator: a season that is half over cannot be "50 % behind"
  // because the second half has not been run yet. The partial current week is included day by day, which is
  // what makes the number move on a Wednesday rather than only on Mondays.
  let plannedSoFar = 0;
  let completedSoFar = 0;
  for (const day of planDays) {
    if (day > today) break;
    const session = sessionsByDay.get(day);
    plannedSoFar += kmOf(session);
    const entry = entries.get(day);
    if (entry !== undefined) completedSoFar += completedKmOf(session, entry);
  }

  return {
    asOfDay: today,
    firstDay: plan.firstDay,
    lastDay: plan.lastDay,
    weeks: ordered,
    totals,
    adherencePct: plannedSoFar > 0 ? Math.round((completedSoFar / plannedSoFar) * 1000) / 10 : null,
    weeksElapsed: ordered.filter((week) => week.status !== "future").length,
    weeksTotal: ordered.length,
  };
}
