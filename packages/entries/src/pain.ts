/**
 * Pain reports as rows.
 *
 * The entry carries an array of pain reports; the triage needs a trajectory, and a trajectory is a query over rows
 * rather than an array read out of one entry (row 19). This projection is the one place that decides how an entry's
 * pain becomes rows, so the API and the web page write the same rows for the same day.
 *
 * The id is derived, not generated: `userId + day + revision + index + site + intensity` is the report's identity,
 * so replaying a submission - or re-deriving after a restart - writes the same row instead of a second one. A
 * generated id would make every retry look like a new report, and a pain trajectory built on that is fiction.
 */
import type { DayEntry, PainReport } from "@training-planner/domain";
import { uuidFrom } from "@training-planner/planner-core";

export interface PainReportInput {
  /** The user, from the session. Never from the request body. */
  userId: string;
  entry: DayEntry;
}

export function painReportsOf(input: PainReportInput): PainReport[] {
  const pains = input.entry.pain ?? [];
  return pains.map((pain, index) => ({
    userId: input.userId,
    id: uuidFrom({
      type: "pain.reported",
      userId: input.userId,
      day: input.entry.day,
      revision: input.entry.revision,
      index,
      site: pain.site,
      intensity: pain.intensity,
    }),
    day: input.entry.day,
    site: pain.site,
    side: pain.side ?? null,
    intensity: pain.intensity,
    duringRun: pain.duringRun === true,
    nextMorning: pain.nextMorningWorse === true,
    trendGaitChange: pain.affectsGait === true,
    nightPain: pain.nightPain === true,
    duration: pain.duration ?? null,
    knownInjury: pain.knownInjury === true,
    // The entry's pain array has no free-text note (ADR-0006 keeps health free text out of the event log); the
    // column exists for a later surface that asks for one, and null is the honest value until then.
    note: null,
  }));
}
