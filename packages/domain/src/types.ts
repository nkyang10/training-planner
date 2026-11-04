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

export interface GoalEvent {
  name?: string;
  date: string;
  distanceKm: number;
  priority: "A" | "B" | "C";
  terrain?: Terrain;
}

export interface Availability {
  days: DayName[];
  hardDaysAllowed?: number;
  preferredLongRunDay?: DayName;
  sessionBudgetMin?: { min: number; max: number };
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
  health: { flags?: string[]; injuryHistory?: string[]; clinicianClearance?: boolean | null };
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
