/**
 * The day-entry, review, signal and event contracts as the engine and the client see them.
 *
 * Split from types.ts only to keep each file readable; both are re-exported from ./index.
 */
export type DayEntryOutcome = "rest" | "completed" | "partial" | "skipped" | "missed";
export type SessionTaken = "as-prescribed" | "alternate" | "extra" | "partial" | "none";
export type OutcomeDetail =
  | "illness" | "travel" | "work" | "family" | "sleep" | "motivation"
  | "pain" | "weather" | "equipment" | "social" | "just-didnt" | "other";
export type DayEntrySource = "mobile" | "web" | "offline-queue" | "import-assistant" | "voice";
export type DayEntryIntent =
  | "as-planned" | "listened-to-body" | "pushed-anyway" | "just-move"
  | "training-for-race" | "just-check-me" | "other";

/**
 * Tier 2 wellness, as the policy evaluator reads it. The hand-written type lists only what a decision may
 * read. `muscleSoreness` is canonical since 2026-11-04: the old spelling `musoreSoreness` stays in the wire for a
 * migration window (ends 2027-02-04) and is normalised to this name before storage, so the frozen interface has
 * one spelling and a decision can finally read it.
 */
export interface DayEntryWellness {
  sleepHours?: number | null;
  sleepQuality?: number | null;
  restingHr?: number | null;
  hrvLnRMSSD?: number | null;
  stress?: number | null;
  fatigue?: number | null;
  /** Canonical since 2026-11-04; the wire's legacy `musoreSoreness` is normalised to this at write time. */
  muscleSoreness?: number | null;
  /** `below-neck`, `fever`, `chest` and `GI` are hard-stop inputs (safety-hard-stops.yaml). */
  illnessSymptoms?: Array<"none" | "above-neck" | "below-neck" | "fever" | "GI" | "chest" | "other">;
  fuelingNote?: string | null;
}

/** One body-map report. The triage input for injury-risk-and-pain-triage.md. */
export interface DayEntryPain {
  site: string;
  side?: "left" | "right" | "central" | null;
  intensity: number;
  duringRun?: boolean;
  nextMorningWorse?: boolean;
  affectsGait?: boolean;
  nightPain?: boolean;
  duration?: "today" | "few-days" | "1-2-weeks" | "over-2-weeks" | "recurring";
  knownInjury?: boolean;
}

export interface DayEntry {
  /** Writer-assigned (uuidFrom), never client-supplied: a client that could name the row could forge a correction. */
  entryId?: string;
  day: string;
  outcome: DayEntryOutcome;
  revision: number;
  tzAtEvent: string;
  /** Set on a correction: which revision of the same day it replaces. */
  correctedFromRevision?: number | null;
  /** Set by the writer when a later revision exists; the old row is never deleted (AGENTS rule 4). */
  supersededBy?: string | null;
  /** Absent when the runner did not say: null is not a value day-entry.schema.json accepts. */
  sessionTaken?: SessionTaken;
  outcomeDetail?: OutcomeDetail | null;
  completedKm?: number | null;
  durationMin?: number | null;
  rpe?: number | null;
  legs?: number | null;
  mood?: number | null;
  wellness?: DayEntryWellness | null;
  pain?: DayEntryPain[];
  note?: string | null;
  intent?: DayEntryIntent | null;
  source?: DayEntrySource;
  idempotencyKey?: string;
  clientSubmittedAt?: string | null;
}

export type EvidenceGrade = "A" | "B" | "C" | "D";
export type ReviewStatus = "open" | "accepted" | "rejected" | "deferred" | "expired" | "superseded";
export type ReviewOpenedBy = "system-signal" | "user-request" | "post-race" | "post-layoff" | "phase-boundary";

export interface ReviewEvidence {
  signalIds: string[];
  ruleIds: string[];
  evidenceGradeMax: EvidenceGrade;
  streakDays?: number;
}

export interface ReviewOption {
  optionId: string;
  labelKey: string;
  keepAsIs: boolean;
  diffId: string | null;
  costSummary: string;
  expiresAfterDay: string;
}

export interface Review {
  schemaVersion: number;
  reviewId: string;
  userId: string;
  openedAtDay: string;
  openedBy?: ReviewOpenedBy;
  evidence: ReviewEvidence;
  horizonDays: number;
  freezeDays?: number;
  options: ReviewOption[];
  status: ReviewStatus;
  chosenOptionId?: string | null;
  decidedAtDay?: string | null;
  resultDiffId?: string | null;
}

export type SignalKey =
  | "load_sRPE" | "load_trimp" | "load_normalized" | "weekly_load" | "load_monotony" | "strain"
  | "ctl" | "atl" | "tsb" | "acwr" | "ramp_rate" | "hrv_lnrmssd_dev" | "hrv_data_sufficiency"
  | "rhr_dev" | "sleep_debt" | "wellness_index" | "vdot_equivalent" | "pace_bands"
  | "pace_at_hr_easy" | "hr_drift" | "threshold_hr_est" | "durability" | "economy_proxy"
  | "completion_rate" | "rpe_gap" | "log_continuity" | "log_quality_by_daytype"
  | "device_coverage" | "pain_trend" | "adherence_intent_mix";
export type SignalConfidence = "low" | "medium" | "high" | "insufficient";
export type SignalDrive = "display" | "micro" | "review" | "safety" | "narrator";
export type SignalWindowKind = "rolling-ema" | "rolling-days" | "iso-week" | "phase" | "since-event" | "single-day";

export interface SignalWindow {
  kind: SignalWindowKind;
  days?: number | null;
}

export interface Signal {
  key: SignalKey;
  userId: string;
  asOfDay: string;
  window: SignalWindow;
  value: number | boolean | string | Record<string, unknown> | unknown[] | null;
  unit?: string | null;
  confidence: SignalConfidence;
  /** Why the confidence is what it is; the difference between "low" and "we could not see it". */
  confidenceNote?: string | null;
  mayDrive: SignalDrive[];
  computedAt: string;
  inputsHash: string;
  knowledgeHash: string;
  direction?: "stable" | "rising" | "falling" | "volatile" | "unknown";
  consecutiveDays?: number | null;
  crossedThreshold?: boolean | null;
  baselineValue?: number | null;
  deviationPct?: number | null;
  formulaVersion?: string | null;
  /** What the signal could and could not see: the difference between "no data" and "nothing wrong". */
  dataQuality?: {
    expectedDays?: number | null;
    presentDays?: number | null;
    coveragePct?: number | null;
    source?: string | null;
    exclusions?: string[] | null;
  } | null;
}

export type EventActor = "runner" | "system" | "worker" | "import" | "support";

/** Every prompt kind shares one budget (feedback-prompts.yaml#one-budget-for-all-prompts). */
export type PromptKind = "nudge" | "review" | "weekly-summary";

/** One prompt that was actually delivered. The policy reads these; the API and the page write them. */
export interface PromptDelivery {
  userId: string;
  kind: PromptKind;
  /** The training day the prompt was delivered on: what the shared budget counts. */
  day: string;
  /** The day the prompt asked about; equal to `day` for a same-day nudge. */
  forDay: string;
  /** Local minute-of-day it was scheduled for, kept so a delivery can be explained later. */
  atMinute: number;
}

/** `day.closed`: whether the day ended with an entry or without one. Absence is a status, never a zero. */
export type DayCloseStatus = "logged" | "closed-unlogged";

export interface DayClosePayload {
  status: DayCloseStatus;
  plannedKm: number;
  plannedSessions: number;
  completedKm: number;
  outcome: string | null;
}

export interface TrainingEvent {
  eventId: string;
  userId: string;
  type: string;
  occurredAt: string;
  actor: EventActor;
  payloadVersion: 1;
  payload: Record<string, unknown>;
  trainingDay: string;
  timezone: string;
  dayStartHour?: number;
  idempotencyKey?: string | null;
  causationId?: string | null;
  /** For entry.corrected: the event whose meaning this one replaces. */
  supersedesEventId?: string | null;
  schemaUrl?: string | null;
}
