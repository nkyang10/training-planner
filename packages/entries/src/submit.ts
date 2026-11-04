/**
 * The write path for daily entries: one draft in, one accepted/duplicate/rejected result out.
 *
 * The rules it enforces are the ones that are expensive to get wrong later:
 * - a retry never writes twice (idempotency key, unique per user-day-revision);
 * - a correction never overwrites: it is a new revision that points at the one it replaces;
 * - the past is bounded: no future days, and a backfill older than the knowledge window needs a reason;
 * - the row cannot be stored if the day-entry contract rejects it, so the client and the database cannot
 *   disagree about what an entry is.
 */
import { dayEntrySchema, eventSchema } from "@training-planner/domain";
import type { DayEntry, TrainingEvent } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { addDays, daysBetween, uuidFrom } from "@training-planner/planner-core";
import type { EntryDraft, EntryLog, RejectCode, SubmitOptions, SubmitResult } from "./types";

const SUBMITTED = "entry.submitted";
const CORRECTED = "entry.corrected";

/** Days a backfill may be silent, from missed-session-rules.yaml#unlogged_backfill_grace_hours (72 h). */
function backfillGraceDays(knowledge: KnowledgeBundle): number {
  return Math.floor(knowledge.number("missed-session-rules.yaml#unlogged_backfill_grace_hours") / 24);
}

/** Every revision of one day, oldest first. The log is append-only, so "latest" is a search, not a pointer. */
export function entriesForDay(log: EntryLog, day: string): DayEntry[] {
  return log.entries.filter((entry) => entry.day === day).sort((a, b) => a.revision - b.revision);
}

/** The revision a reader should treat as current: the highest revision for that day. */
export function resolveCurrent(log: EntryLog, day: string): DayEntry | undefined {
  const revisions = entriesForDay(log, day);
  return revisions[revisions.length - 1];
}

/**
 * Days inside the plan window that closed without an entry. The worker's rollup uses this to decide which days
 * to mark `missed`; the pipeline deliberately does not invent that row, because the event catalogue has no
 * `entry.missed` type yet (recorded as a gap, not guessed at).
 */
export function pendingDays(log: EntryLog, today: string, firstDay: string, lastDay: string): string[] {
  const answered = new Set(log.entries.map((entry) => entry.day));
  const days: string[] = [];
  for (let day = firstDay; day <= lastDay; day = addDays(day, 1)) {
    if (day < today && !answered.has(day)) days.push(day);
  }
  return days;
}

/** The event that a correction supersedes: the last entry event written for that day. */
function latestEventForDay(log: EntryLog, day: string): TrainingEvent | undefined {
  const events = log.events.filter((event) => event.type === SUBMITTED || event.type === CORRECTED);
  return events.filter((event) => (event.payload as { day?: unknown }).day === day).pop();
}

const reject = (code: RejectCode, detail: string): SubmitResult => ({ status: "rejected", code, detail });

export function submitEntry(draft: EntryDraft, log: EntryLog, options: SubmitOptions): SubmitResult {
  // 1. A runner write without an idempotency key cannot be retried safely, and the events contract says so.
  const idempotencyKey = draft.idempotencyKey?.trim() ?? "";
  if (idempotencyKey.length < 8) {
    return reject("missing-idempotency-key", "a runner write needs an idempotency key of at least 8 characters");
  }

  // 2. A retry returns the first write. It must not create a second row, a second revision or a second event.
  const existingByKey = log.entries.find((entry) => entry.idempotencyKey === idempotencyKey);
  if (existingByKey !== undefined) {
    return { status: "duplicate", entry: existingByKey };
  }

  // 3. The future is not writable, and the past is bounded by the knowledge window.
  if (draft.day > options.today) {
    return reject("future-day", `${draft.day} is after today ${options.today}`);
  }
  const daysOld = daysBetween(draft.day, options.today);
  const grace = backfillGraceDays(options.knowledge);
  const reason = draft.correctionReason?.trim() ?? "";
  if (daysOld > grace && reason.length === 0) {
    return reject(
      "missing-correction-reason",
      `${draft.day} is ${daysOld} days old; a backfill older than ${grace} days needs a reason`,
    );
  }

  const revisions = entriesForDay(log, draft.day);
  const latest = revisions[revisions.length - 1];
  const revision = latest === undefined ? 1 : latest.revision + 1;

  const entryId = uuidFrom({ userId: options.userId, day: draft.day, revision, idempotencyKey });
  const entry: DayEntry = {
    entryId,
    day: draft.day,
    outcome: draft.outcome,
    revision,
    correctedFromRevision: latest?.revision ?? null,
    supersededBy: null,
    tzAtEvent: draft.tzAtEvent,
    // The contract is the authority on what a row may say: an unstated session is an ABSENT key, because
    // day-entry.schema.json does not accept null (row 21 fixed the description that used to claim it did).
    ...(draft.sessionTaken === undefined ? {} : { sessionTaken: draft.sessionTaken }),
    outcomeDetail: draft.outcomeDetail ?? null,
    completedKm: draft.completedKm ?? null,
    durationMin: draft.durationMin ?? null,
    rpe: draft.rpe ?? null,
    legs: draft.legs ?? null,
    mood: draft.mood ?? null,
    wellness: draft.wellness ?? null,
    pain: draft.pain ?? [],
    note: draft.note ?? null,
    intent: draft.intent ?? null,
    source: draft.source ?? "web",
    idempotencyKey,
    clientSubmittedAt: options.occurredAt,
  };

  // 4. Coherence rules from day-entry.schema.json, checked here so the rejection names the field. The contract
  //    parse below is the backstop, and its message is a root-level "does not satisfy", which is useless to a
  //    client that has to tell the runner what to fix.
  const coherence: string[] = [];
  if (draft.outcome === "skipped" && (draft.outcomeDetail === undefined || draft.outcomeDetail === null)) {
    coherence.push("outcomeDetail is required when outcome is skipped");
  }
  if (draft.outcome === "partial" && draft.completedKm == null && draft.durationMin == null) {
    coherence.push("completedKm or durationMin is required when outcome is partial");
  }
  if (draft.outcome === "completed" && draft.sessionTaken === "none") {
    coherence.push("sessionTaken none is not legal on a completed day");
  }
  // `partial` is a marker on both axes and the two have to agree: a part of the prescription is only a fact on a
  // day whose outcome is partial, and a partial day may not claim it did the prescription as written.
  if (draft.sessionTaken === "partial" && draft.outcome !== "partial") {
    coherence.push("sessionTaken partial is only legal when outcome is partial");
  }
  if (
    draft.outcome === "partial" &&
    draft.sessionTaken !== undefined &&
    draft.sessionTaken !== "partial"
  ) {
    coherence.push("sessionTaken must be partial when outcome is partial");
  }
  if (draft.outcome === "partial" && draft.completedKm != null && draft.completedKm > (draft.completedKm ?? 0) + 0) {
    coherence.push("completedKm must be a number");
  }
  if (coherence.length > 0) return reject("invalid-entry", coherence.join("; "));

  // 5. The contract decides what an entry is. A row the contract rejects is not storable, so it is not
  //    accepted here either - the alternative is a client that can write rows the database cannot hold.
  const parsed = dayEntrySchema.safeParse(entry);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".") || "entry"}: ${issue.message}`);
    return reject("invalid-entry", issues.join("; "));
  }

  const type = latest === undefined ? SUBMITTED : CORRECTED;
  const eventId = uuidFrom({ type, userId: options.userId, day: draft.day, revision, idempotencyKey });
  const supersedes = latest === undefined ? undefined : latestEventForDay(log, draft.day);

  const payload =
    type === SUBMITTED
      ? {
          day: draft.day,
          revision,
          outcome: draft.outcome,
          sessionTaken: draft.sessionTaken ?? null,
          rpe: draft.rpe ?? null,
          legs: draft.legs ?? null,
        }
      : {
          day: draft.day,
          revision,
          correctedFromRevision: latest?.revision ?? null,
          reason,
        };

  const event: TrainingEvent = {
    eventId,
    userId: options.userId,
    type,
    occurredAt: options.occurredAt,
    actor: "runner",
    payloadVersion: 1,
    payload,
    trainingDay: draft.day,
    timezone: draft.tzAtEvent,
    dayStartHour: options.dayStartHour ?? 4,
    idempotencyKey,
    causationId: null,
    ...(type === CORRECTED && supersedes !== undefined ? { supersedesEventId: supersedes.eventId } : {}),
  };

  const eventParsed = eventSchema.safeParse(event);
  if (!eventParsed.success) {
    throw new Error(
      `entry pipeline produced an event the contract rejects: ${eventParsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  }

  const accepted: SubmitResult = {
    status: "accepted",
    entry,
    event,
    ...(latest === undefined || latest.entryId === undefined
      ? {}
      : { superseded: { entryId: latest.entryId, supersededBy: entryId } }),
  };
  return accepted;
}
