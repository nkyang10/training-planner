/**
 * The planner-facing view of schemas/json/*.schema.json.
 *
 * These are hand-written on purpose: they are the *narrow* shape the engine reads, and the zod mirrors
 * in schemas.ts must parse a fixture into something assignable to them. Extra properties are fine
 * (structural typing allows them); a renamed or missing one is a compile error, which is the point.
 *
 * Spellings are the contract's spellings, verbatim. When a contract and this file disagree, the
 * contract wins and this file is the bug - that is the whole lesson of
 * docs/engineering/contract-vocabulary.md, and the fixture round-trip test in packages/domain/test
 * exists to catch it.
 */
export type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type Units = "metric" | "imperial";
export type Locale = "en" | "zh-Hant";
export type GoalType = "finish" | "time" | "experience" | "fitness-maintenance" | "return-to-running";
export type RiskAppetite = "conservative" | "moderate" | "aggressive";
export type Flexibility = "fixed" | "date-flexible" | "distance-flexible" | "both-flexible";
export type PlanStyle = "structured" | "flexible";
export type Terrain = "road" | "track" | "trail" | "mixed" | "treadmill";
export type SessionKind =
  | "rest" | "recovery" | "easy" | "strides" | "long" | "hills" | "tempo"
  | "vo2max" | "mp" | "cross-training" | "strength" | "test" | "race";
export type PlanDayOutcome = "planned" | "rest" | "completed" | "partial" | "skipped" | "missed";
export type PrimaryTarget = "pace" | "hr" | "rpe" | "feel";
export type AppliedEffect = "subtracted" | "dosed" | "clamped" | "informed";
export type Severity = "constraint" | "hard-stop" | "advisory";
export type GeneratedBy = "initial-build" | "rolling-refine" | "micro-adjust" | "review-accepted";
export type DiffChangeKind =
  | "session.added" | "session.removed" | "distance.changed" | "pace.band-changed"
  | "day.became-rest" | "day.swapped" | "session.moved" | "structure.changed"
  | "session.downgraded" | "distance.reduced" | "pace.band-widened" | "pace.band-relaxed";

/** The contract requires only `goal.type`; a race date or distance may genuinely be missing (a runner
 * who has not picked a race yet). The planner must handle that case instead of assuming a date exists. */
export interface GoalEvent {
  name?: string;
  date?: string;
  distanceKm?: number;
  priority?: "A" | "B" | "C";
  terrain?: Terrain;
}

export interface Availability {
  days: DayName[];
  hardDaysAllowed?: number;
  preferredLongRunDay?: DayName;
  /** The contract declares an object and no members, so this is a bag until the contract names them. */
  sessionBudgetMin?: Record<string, unknown>;
}

/** The contract records an injury as a fact with a site and a year, not as a word in a list. */
export interface InjuryRecord {
  site?: string;
  year?: number;
  resolved?: boolean;
  loadSensitive?: boolean;
}

export interface AthleteProfile {
  userId: string;
  revision: number;
  age?: number;
  availability: Availability;
  goal: {
    type: GoalType;
    event?: GoalEvent | null;
    riskAppetite?: RiskAppetite;
    flexibility?: Flexibility;
    planStyle?: PlanStyle;
  };
  preferences: { units: Units; locale: Locale; timezone: string; dayStartHour?: number };
  health: { flags?: string[]; injuryHistory?: InjuryRecord[]; clinicianClearance?: boolean | null };
  measurement?: {
    hrMax?: number | null;
    restingHr?: number | null;
    lactateThresholdPaceSecPerKm?: number | null;
    method?: "lab" | "field-test" | "derived" | "derivable-only" | "none";
  };
}

export interface Session {
  day: string;
  kind: SessionKind;
  outcome: PlanDayOutcome;
  restDay: boolean;
  summaryText: string;
  distanceKm?: number | null;
  durationMin?: number | null;
  targetPaceMinSecPerKm?: number | null;
  targetPaceMaxSecPerKm?: number | null;
  targetHrMin?: number | null;
  targetHrMax?: number | null;
  targetRpe?: number | null;
  primaryTarget?: PrimaryTarget;
  feelCue?: string | null;
  paceAnchorDay?: string | null;
  granularity?: "coarse" | "detailed";
  hardDay?: boolean;
  nonNegotiable?: boolean;
  ruleIds?: string[];
}

export interface AppliedRule {
  ruleId: string;
  anchor: string;
  effect: AppliedEffect;
  isSafety?: boolean;
  severity?: Severity;
  daysAffected?: string[];
  notes?: string;
}

export interface ClampedKnob {
  anchor: string;
  requestedValue: number | string | boolean | null;
  allowedMin: number;
  allowedMax: number;
  appliedValue: number;
  unit?: string | null;
  requestedBy?: string | null;
}

export interface Note {
  id: string;
  detail: string;
  day?: string | null;
  blocksGeneration?: boolean;
}

export interface PlanVersion {
  schemaVersion: number;
  versionId: string;
  planId: string;
  userId: string;
  parentVersionId: string | null;
  generatedBy: GeneratedBy;
  generatedAtDay: string;
  firstDay: string;
  lastDay: string;
  plannerVersion: string;
  knowledgeHash: string;
  inputsHash: string;
  sessions: Session[];
  appliedRules: AppliedRule[];
  clampedKnobs: ClampedKnob[];
  assumptions: Note[];
  warnings: Note[];
}

export interface DiffChange {
  kind: DiffChangeKind;
  day: string;
  beforeSummary: string;
  afterSummary: string;
  reason: string;
  signalId: string;
  expectedCost: string;
  expectedBenefit?: string;
  knobsUsed: string[];
  isSafety?: boolean;
}

/** One row of `ai_review_proposals` (ADR-0009): what the model said, what the gates said, and the hashes that make it auditable. */
export interface AiReviewProposal {
  userId: string;
  id: string;
  day: string;
  guidelineVersionHash: string;
  model: string;
  promptHash: string;
  output: unknown;
  validatorVerdict: "accepted" | "rejected";
  fallbackUsed: boolean;
  reviewId: string | null;
  createdAt: string;
}

/** The consent switch (ADR-0006): a hosted model may only be called when this says yes. */
export interface LlmConsent {
  userId: string;
  granted: boolean;
  purpose: "review-decision" | "review-narrative" | "daily-comment";
  policyVersion: string;
  grantedAt: string | null;
  revokedAt: string | null;
  updatedAt: string;
}

/** One row of `profile_revisions` (ADR-0009): what changed, who changed it, and why. Append-only. */
export interface ProfileRevision {
  userId: string;
  id: string;
  changedBy: "runner" | "import" | "review" | "support";
  source: "user" | "import" | "review";
  diff: ProfileDiffEntry[];
  occurredAt: string;
}

/** A leaf change in a profile, with JSON paths so a reader does not need the old object to understand the row. */
export interface ProfileDiffEntry {
  path: string;
  from: unknown;
  to: unknown;
}

export interface PlanDiff {
  schemaVersion: number;
  diffId: string;
  userId: string;
  fromVersionId: string;
  toVersionId: string;
  createdAtDay: string;
  changes: DiffChange[];
  changeCountWithinLimit: boolean;
  knowledgeHash: string;
}
