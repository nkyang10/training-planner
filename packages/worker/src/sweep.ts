/**
 * The nightly sweep: close the days that ended, name the ones that closed with no entry, and snapshot the signals.
 *
 * Four properties, each of which is why this is a function and not a cron script:
 * - **idempotent**: a sweep that runs twice closes nothing the second time, because `closedDays` is an input;
 * - **only the past**: a day closes after it has ended, so the sweep never touches today or the future;
 * - **absence is information**: a closed day with no entry is `closed-unlogged` and lands in `pending`, never
 *   silently in a "zero" and never as a broken streak;
 * - **the cache is a snapshot**: the bundle carries its own `asOfDay`, `inputsHash` and `knowledgeHash`, so a plan
 *   can be explained later from the numbers the system actually believed at the time.
 *
 * It writes nothing. `apps/api` (or a future worker process) owns persistence; the event catalogue has no
 * day-close event type yet, which is backlog row 18 and not something this package may invent.
 */
import { addDays, daysBetween } from "@training-planner/planner-core";
import { closeEventFor } from "@training-planner/entries";
import { computeSignals } from "@training-planner/signals";
import type { NightlyInput, NightlyResult, ClosedDay } from "./types";

export function runNightlySweep(input: NightlyInput): NightlyResult {
  const { plan, today, entries, knowledge, computedAt } = input;
  const alreadyClosed = new Set(input.closedDays ?? []);

  // A day may close only after it has ended, and only inside the plan's own window.
  const yesterday = addDays(today, -1);
  // The second half matters: a sweep run weeks after the block ends must not keep closing days the plan never
  // contained. The first half matters too: today has not ended yet.
  const lastClosable = yesterday <= plan.lastDay ? yesterday : plan.lastDay;
  const firstClosable = plan.firstDay;
  const closable: string[] = [];
  if (daysBetween(firstClosable, lastClosable) >= 0) {
    for (let day = firstClosable; day <= lastClosable; day = addDays(day, 1)) closable.push(day);
  }

  const newlyClosed: ClosedDay[] = [];
  const skipped: string[] = [];
  for (const day of closable) {
    if (alreadyClosed.has(day)) {
      skipped.push(day);
      continue;
    }
    newlyClosed.push(closeOf(input, day));
  }

  // Pending is computed over *every* closed day, not only the new ones: the nudge list is a property of the log,
  // and a sweep that only looked at its own output would forget yesterday's gap.
  const pending = closable.filter((day) => closeOf(input, day).status === "closed-unlogged");

  // The signal bundle is computed for the sweep day (today), which is what a review opened tomorrow morning reads.
  const coversToday = plan.firstDay <= today && today <= plan.lastDay;
  const bundle = coversToday
    ? computeSignals({ userId: input.userId, today, entries, plan, knowledge, computedAt })
    : null;

  // One event per day that closed in this sweep: the catalogue now has `day.closed`, so the worker can name the
  // day instead of leaving the writer to invent a type (backlog row 18). A day already closed gets no second event.
  const events = newlyClosed.map((closed) =>
    closeEventFor({
      userId: input.userId,
      day: closed.day,
      status: closed.status,
      plannedKm: closed.plannedKm,
      plannedSessions: closed.plannedSessions,
      completedKm: closed.completedKm,
      outcome: closed.outcome,
      occurredAt: computedAt,
      timezone: input.timezone,
    }),
  );

  return {
    newlyClosed,
    pending,
    skipped,
    events,
    signalCache:
      bundle === null
        ? null
        : {
            userId: input.userId,
            asOfDay: today,
            knowledgeHash: knowledge.hash,
            inputsHash: bundle.signals[0]?.inputsHash ?? "",
            signals: bundle.signals,
            computedAt,
          },
  };
}

function closeOf(input: NightlyInput, day: string): ClosedDay {
  const sessions = input.plan.sessions.filter((session) => session.day === day);
  const plannedKm = sessions.reduce((sum, session) => sum + (session.kind === "rest" ? 0 : (session.distanceKm ?? 0)), 0);
  const plannedSessions = sessions.filter((session) => session.kind !== "rest").length;
  const current = input.entries
    .filter((entry) => entry.day === day)
    .sort((a, b) => b.revision - a.revision)[0];
  const outcome = current?.outcome ?? null;
  const completedKm = current?.completedKm ?? (outcome === "completed" ? plannedKm : 0);
  return {
    day,
    status: current === undefined ? "closed-unlogged" : "logged",
    plannedKm: Math.round(plannedKm * 10) / 10,
    plannedSessions,
    outcome,
    completedKm: Math.round(completedKm * 10) / 10,
  };
}
