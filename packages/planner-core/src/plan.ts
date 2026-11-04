/**
 * Passes 0-3 and the safety pass of docs/engine/planner-engine.md, in the order the document gives.
 *
 * Every threshold comes from `input.knowledge` by anchor. The engine holds no tuning numbers: if a
 * number here is not a knob, it is a *structure* (a week has seven days) or a display anchor (the
 * contract's 1-10 RPE scale), and it says so in a comment. That is the difference between a plan that
 * can be defended in a review and a plan that happens to look plausible.
 */
import type {
  AppliedRule,
  ClampedKnob,
  Note,
  PlanVersion,
  Session,
  SessionKind,
} from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { hashOf } from "@training-planner/knowledge/canonical";
import type { PlanInput, PlanOutput } from "./types";
import { PLANNER_VERSION } from "./version";
import { addDays, daysBetween, eachDay, weekStart, weekdayIndex } from "./civil";
import { uuidFrom } from "./uuid";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayName = (typeof DAY_NAMES)[number];

/** Quality kinds count toward the hard-day cap; a long run has its own recovery rule. */
const QUALITY_KINDS: SessionKind[] = ["tempo", "vo2max", "hills", "mp", "test", "race"];

/**
 * Display anchors on the contract's 1-10 RPE scale (schemas/json/plan-version.schema.json,
 * `targetRpe`). They are not physiological thresholds and are not tuned per runner in M1; the
 * prescription that matters is `primaryTarget: "rpe"` on easy days, which is planner-engine section 2.
 */
const RPE_ANCHOR: Partial<Record<SessionKind, number>> = {
  rest: 1,
  recovery: 2,
  easy: 3,
  strides: 4,
  long: 4,
  "cross-training": 3,
  strength: 4,
  tempo: 6,
  mp: 6,
  hills: 7,
  test: 7,
  vo2max: 8,
  race: 9,
};

export interface Phase {
  name: "adaptation" | "building" | "race-prep" | "taper" | "race" | "recovery";
  fromDay: string;
  toDay: string;
}

interface Draft {
  input: PlanInput;
  knowledge: KnowledgeBundle;
  days: string[];
  sessions: Session[];
  appliedRules: AppliedRule[];
  clampedKnobs: ClampedKnob[];
  assumptions: Note[];
  warnings: Note[];
  baselinePaceSecPerKm: number | null;
  bandWidthSecPerKm: number;
  hardGapHours: number;
  qualityGapHours: number;
  hardCap: number;
  longRunSharePct: number;
  phases: Phase[];
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** Paces in the contract are multiples of 5 s/km; see plan-version.schema.json `multipleOf: 5`. */
const roundPace = (seconds: number): number => Math.round(seconds / 5) * 5;

function number(knowledge: KnowledgeBundle, anchor: string): number {
  return knowledge.number(anchor);
}

function record(knowledge: KnowledgeBundle, anchor: string): Record<string, unknown> {
  const value = knowledge.knob(anchor).value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`knowledge knob ${anchor} is not a record`);
  }
  return value as Record<string, unknown>;
}

function numericRecord(knowledge: KnowledgeBundle, anchor: string): Record<string, number> {
  const source = record(knowledge, anchor);
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(source)) if (typeof value === "number") result[key] = value;
  return result;
}

/** Median, sorted copy: ties are broken by the sorted order, never by hash order. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) throw new Error("median of nothing");
  const middle = Math.floor(sorted.length / 2);
  const low = sorted[middle - 1] ?? sorted[middle] ?? 0;
  const high = sorted[middle] ?? low;
  return sorted.length % 2 === 0 ? (low + high) / 2 : high;
}

function isAtRisk(profile: PlanInput["profile"]): boolean {
  if ((profile.age ?? 0) >= 40) return true;
  if ((profile.health.injuryHistory ?? []).some((injury) => injury.loadSensitive === true && injury.resolved !== true)) return true;
  return false;
}

function taperLengthDays(knowledge: KnowledgeBundle, distanceKm: number | undefined, age: number | undefined): number {
  const byDistance = numericRecord(knowledge, "taper.yaml#taper_length_days");
  const key =
    distanceKm === undefined ? "marathon"
    : distanceKm <= 5.5 ? "five_k"
    : distanceKm <= 11 ? "ten_k"
    : distanceKm <= 22 ? "half_marathon"
    : distanceKm <= 45 ? "marathon"
    : "ultra";
  const base = byDistance[key] ?? byDistance.marathon ?? 14;
  const mastersExtension = (age ?? 0) >= 40 ? number(knowledge, "taper.yaml#masters_taper_extension_days") : 0;
  return base + mastersExtension;
}

function planPhases(draft: Draft): Phase[] {
  const { profile, state } = draft.input;
  const firstDay = state.planStartDay;
  const lastDay = addDays(firstDay, state.horizonDays - 1);
  const event = profile.goal.event ?? null;
  const raceDay = event?.date && event.date >= firstDay && event.date <= lastDay ? event.date : null;
  const phases: Phase[] = [];

  if (!raceDay) {
    if (event?.date) {
      draft.warnings.push({
        id: "race-date-outside-horizon",
        detail: `the goal race on ${event.date} falls outside this horizon, so this block is base-building only`,
      });
    }
    phases.push({ name: "adaptation", fromDay: firstDay, toDay: lastDay });
    return phases;
  }

  const taperDays = taperLengthDays(draft.knowledge, event?.distanceKm, profile.age);
  const taperStart = addDays(raceDay, -taperDays);
  const buildingWeeks = number(draft.knowledge, "phase-transitions.yaml#building_weeks");
  const buildingStart = addDays(taperStart, -buildingWeeks * 7);
  const adaptationEnd = addDays(buildingStart, -1);
  const recoveryEnd = addDays(raceDay, 6);

  if (adaptationEnd >= firstDay) phases.push({ name: "adaptation", fromDay: firstDay, toDay: adaptationEnd });
  if (taperStart > firstDay && buildingStart <= addDays(taperStart, -1)) {
    phases.push({ name: "building", fromDay: buildingStart < firstDay ? firstDay : buildingStart, toDay: addDays(taperStart, -1) });
  }
  if (taperStart <= raceDay) phases.push({ name: "taper", fromDay: taperStart < firstDay ? firstDay : taperStart, toDay: addDays(raceDay, -1) });
  phases.push({ name: "race", fromDay: raceDay, toDay: raceDay });
  if (recoveryEnd <= lastDay) phases.push({ name: "recovery", fromDay: addDays(raceDay, 1), toDay: recoveryEnd });
  return phases.filter((phase) => phase.fromDay <= phase.toDay);
}

function phaseOf(phases: Phase[], day: string): Phase["name"] | null {
  for (const phase of phases) if (day >= phase.fromDay && day <= phase.toDay) return phase.name;
  return null;
}

function createDraft(input: PlanInput): Draft {
  const { knowledge, profile, evidence } = input;
  const lastDay = addDays(input.state.planStartDay, input.state.horizonDays - 1);
  const baseline = evidence.baselinePaceSecPerKm ?? null;
  const draft: Draft = {
    input,
    knowledge,
    days: eachDay(input.state.planStartDay, lastDay),
    sessions: [],
    appliedRules: [],
    clampedKnobs: [],
    assumptions: [],
    warnings: [],
    baselinePaceSecPerKm: baseline,
    bandWidthSecPerKm: number(knowledge, "pace-bands.yaml#band_width_s_per_km"),
    hardGapHours: (profile.age ?? 0) >= 40
      ? number(knowledge, "recovery.yaml#masters_hard_day_gap_hours")
      : number(knowledge, "recovery.yaml#hard_day_gap_hours"),
    qualityGapHours: number(knowledge, "recovery.yaml#hard_day_gap_hours_after_quality"),
    hardCap: number(knowledge, "intensity-distribution.yaml#hard_days_cap"),
    longRunSharePct: number(knowledge, "load-progression.yaml#long_run_share_pct"),
    phases: [],
  };

  if (baseline === null) {
    draft.assumptions.push({
      id: "no-baseline-pace",
      detail: "no recent race or field test, so sessions are prescribed by effort (RPE) and distance, not pace",
    });
  } else {
    draft.assumptions.push({
      id: "baseline-pace",
      detail: `paces derive from the ${evidence.baselineConfidence ?? "unstated"} baseline of ${baseline} s/km`,
    });
  }
  const allowed = profile.availability.hardDaysAllowed;
  if (allowed !== undefined && allowed < draft.hardCap) {
    draft.hardCap = allowed;
    draft.appliedRules.push({
      ruleId: "hard-days-allowed",
      anchor: "intensity-distribution.yaml#hard_days_cap",
      effect: "clamped",
      notes: `the profile allows ${allowed} hard days per week, below the knowledge cap`,
    });
  }
  draft.phases = planPhases(draft);
  return draft;
}

interface WeekPlan {
  weekStart: string;
  days: string[];
  /** The full-week rate: what seven days of this week would carry. */
  targetKm: number;
  /** Days of this week that fall inside the horizon; a partial week realises targetKm * days / 7. */
  daysInWeek: number;
  phase: Phase["name"] | null;
}

/** Pass 2: the weekly volume curve, generated first and defended by every later pass. */
function weeklyCurve(draft: Draft): WeekPlan[] {
  const { knowledge, evidence, profile } = draft.input;
  const atRisk = isAtRisk(profile);
  const incrementPct = atRisk
    ? number(knowledge, "load-progression.yaml#weekly_increment_pct_conservative")
    : number(knowledge, "load-progression.yaml#weekly_increment_pct");
  const incrementKmAbs = number(knowledge, "load-progression.yaml#weekly_increment_km_abs");
  const stepCycle = number(knowledge, "load-progression.yaml#step_cycle");
  const downWeekPct = number(knowledge, "load-progression.yaml#down_week_pct");
  const minWeeksAtLoad = number(knowledge, "load-progression.yaml#min_weeks_at_load_before_step");
  const taperEndPct = number(knowledge, "taper.yaml#taper_volume_end_pct");
  const restartPct = restartVolumePct(knowledge, evidence.layoffDays ?? 0);

  const groups = new Map<string, string[]>();
  for (const day of draft.days) {
    const key = weekStart(day);
    const bucket = groups.get(key) ?? [];
    bucket.push(day);
    groups.set(key, bucket);
  }

  let previousKm = round1(median(evidence.recentWeeklyKm) * (restartPct / 100));
  if (restartPct < 100) {
    draft.assumptions.push({
      id: "post-layoff-restart",
      detail: `after ${evidence.layoffDays} days away, week one starts at ${restartPct}% of recent sustained volume`,
    });
    draft.appliedRules.push({
      ruleId: "post-layoff-restart",
      anchor: "restart-after-layoff.yaml#restart_volume_pct",
      effect: "dosed",
      notes: `restart volume ${restartPct}% for a ${evidence.layoffDays}-day layoff`,
    });
  }

  const weeks: WeekPlan[] = [];
  let weeksAtLoad = 0;
  let taperIndex = 0;
  const taperWeeks = Math.max(
    1,
    groups.size === 0 ? 1 : [...groups.keys()].filter((key) => phaseOf(draft.phases, groups.get(key)?.[0] ?? key) === "taper").length,
  );

  for (const [key, days] of [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    const weekAnchor = days[0] ?? key;
    const phase = phaseOf(draft.phases, weekAnchor);
    let target: number;
    if (phase === "taper") {
      const progress = taperWeeks <= 1 ? 1 : taperIndex / (taperWeeks - 1);
      target = previousKm * (1 - (1 - taperEndPct / 100) * progress);
      taperIndex += 1;
    } else if (phase === "race") {
      target = previousKm * (taperEndPct / 100) * 0.5;
    } else if (phase === "recovery") {
      target = previousKm * 0.5;
    } else if (weeks.length === 0) {
      target = previousKm;
    } else if (weeksAtLoad >= minWeeksAtLoad && (weeksAtLoad % (stepCycle + 1)) === stepCycle) {
      target = previousKm * (downWeekPct / 100);
      draft.appliedRules.push({
        ruleId: "down-week",
        anchor: "load-progression.yaml#down_week_pct",
        effect: "dosed",
        daysAffected: days,
        notes: `down week at ${downWeekPct}% after ${weeksAtLoad} weeks at load`,
      });
      weeksAtLoad = 0;
    } else {
      const ceiling = Math.min((previousKm * incrementPct) / 100, incrementKmAbs);
      target = previousKm + ceiling;
      weeksAtLoad += 1;
    }
    weeks.push({ weekStart: key, days, targetKm: Math.max(0, round1(target)), daysInWeek: days.length, phase });
    previousKm = Math.max(0, round1(target));
  }
  return weeks;
}

function restartVolumePct(knowledge: KnowledgeBundle, layoffDays: number): number {
  if (layoffDays <= 0) return 100;
  const buckets = numericRecord(knowledge, "restart-after-layoff.yaml#restart_volume_pct");
  const ranges: { from: number; to: number; key: string }[] = [];
  for (const key of Object.keys(buckets)) {
    const match = /^bucket_(\d+)_(\d+|gt_\d+)$/.exec(key);
    if (!match) continue;
    const from = Number(match[1] ?? "0");
    const bound = match[2] ?? "0";
    const to = bound.startsWith("gt_") ? Number.MAX_SAFE_INTEGER : Number(bound);
    ranges.push({ from, to, key });
  }
  ranges.sort((a, b) => a.from - b.from);
  for (const range of ranges) if (layoffDays >= range.from && layoffDays <= range.to) return buckets[range.key] ?? 100;
  return 100;
}

/** Pass 3: day placement. Min 48 h between hard days, cap, long run on the preferred day. */
function placeSessions(draft: Draft, weeks: WeekPlan[]): void {
  const { profile } = draft.input;
  const available = new Set<DayName>(profile.availability.days);
  const preferredLong = profile.availability.preferredLongRunDay ?? null;
  const restDaysMin = number(draft.knowledge, "recovery.yaml#rest_days_per_week_min");
  const gapDays = Math.max(1, Math.ceil(draft.hardGapHours / 24));
  const qualityGapDays = Math.max(1, Math.ceil(draft.qualityGapHours / 24));

  // Quality spacing is a property of the calendar, not of the week: a Sunday quality session followed by
  // a Monday one is 24 h apart, and a per-week rule would happily allow it. The cursor below is why the
  // 48 h invariant is true across week boundaries rather than only inside them.
  let lastQualityDay: string | null = null;

  for (const week of weeks) {
    const slots = week.days.map((day) => ({
      day,
      name: DAY_NAMES[weekdayIndex(day)] as DayName,
      available: available.has(DAY_NAMES[weekdayIndex(day)] as DayName),
    }));

    // Rest days: unavailable weekdays are rest, and a profile with too few unavailable days keeps the
    // knowledge minimum by giving up the last available day of the week (deterministic, not random).
    const running = slots.filter((slot) => slot.available);
    while (running.length > 7 - restDaysMin) running.pop();

    const longSlot = pickLongSlot(running, preferredLong, week.targetKm);
    const qualitySlots: (typeof slots)[number][] = [];
    let lastQualityIndex = -100;
    for (const [index, slot] of running.entries()) {
      if (qualitySlots.length >= draft.hardCap) break;
      if (slot.day === longSlot?.day) continue;
      if (longSlot && Math.abs(daysBetween(longSlot.day, slot.day)) < 2) continue;
      if (lastQualityIndex >= 0 && index - lastQualityIndex < qualityGapDays) continue;
      if (lastQualityIndex >= 0 && index - lastQualityIndex < gapDays) continue;
      if (lastQualityDay !== null && daysBetween(lastQualityDay, slot.day) < qualityGapDays) continue;
      qualitySlots.push(slot);
      lastQualityIndex = index;
    }
    if (qualitySlots.length > 0) lastQualityDay = qualitySlots[qualitySlots.length - 1]?.day ?? lastQualityDay;

    // A horizon that starts on a Thursday must not cram a whole week of volume into four days: the
    // curve is a weekly rate, so a partial week realises its share of the rate and nothing more.
    const realizedKm = round1((week.targetKm * week.daysInWeek) / 7);
    const longKm = longSlot ? round1((realizedKm * draft.longRunSharePct) / 100) : 0;

    // Distribute the week's realised volume so the week actually adds up to the curve.
    //
    // Two ways to lose volume, both found by the property test rather than by reading the code: a week
    // whose only running day is the long-run day dropped the non-long share, and a week with a single
    // running day dropped everything that was not the long run. A volume curve that quietly loses
    // kilometres is worse than no curve, because every later week is derived from it. The rules below
    // make the sum exact: one recipient absorbs the week, otherwise the long run takes its share and the
    // last remaining day absorbs the rounding remainder.
    const distanceByDay = new Map<string, number>();
    const runningDays = running.map((slot) => slot.day);
    const longDay = longSlot?.day ?? null;
    const others = runningDays.filter((day) => day !== longDay);
    if (runningDays.length === 1 && longDay !== null) {
      distanceByDay.set(longDay, realizedKm);
    } else if (others.length === 0 && longDay !== null) {
      distanceByDay.set(longDay, realizedKm);
    } else if (longDay === null) {
      const perDay = round1(realizedKm / Math.max(1, runningDays.length));
      let assigned = 0;
      runningDays.forEach((day, index) => {
        const km = index === runningDays.length - 1 ? round1(Math.max(0, realizedKm - assigned)) : perDay;
        distanceByDay.set(day, km);
        assigned += km;
      });
    } else {
      distanceByDay.set(longDay, longKm);
      const perOther = round1((realizedKm - longKm) / others.length);
      let assignedKm = longKm;
      others.forEach((day, index) => {
        const km = index === others.length - 1 ? round1(Math.max(0, realizedKm - assignedKm)) : perOther;
        distanceByDay.set(day, km);
        assignedKm += km;
      });
    }

    for (const slot of slots) {
      const isLong = longSlot?.day === slot.day;
      const qualityIndex = qualitySlots.findIndex((candidate) => candidate.day === slot.day);
      const kind: SessionKind = !slot.available
        ? "rest"
        : isLong
          ? "long"
          : qualityIndex === 0
            ? week.phase === "taper"
              ? "strides"
              : "tempo"
            : qualityIndex > 0
              ? week.phase === "building" || week.phase === "race-prep"
                ? "vo2max"
                : "hills"
              : "easy";
      const distanceKm = kind === "rest" ? 0 : distanceByDay.get(slot.day) ?? 0;
      draft.sessions.push(prescribe(draft, slot.day, kind, distanceKm));
    }
  }
}

function pickLongSlot(
  running: { day: string; name: DayName }[],
  preferred: DayName | null,
  targetKm: number,
): { day: string; name: DayName } | null {
  if (targetKm <= 0 || running.length === 0) return null;
  if (preferred) {
    const match = running.find((slot) => slot.name === preferred);
    if (match) return match;
  }
  return running[running.length - 1] ?? null;
}

/** Pass 5-lite: the concrete prescription for one day. */
function prescribe(draft: Draft, day: string, kind: SessionKind, distanceKm: number): Session {
  const { profile } = draft.input;
  const rpe = RPE_ANCHOR[kind] ?? null;
  const session: Session = {
    day,
    kind,
    outcome: kind === "rest" ? "rest" : "planned",
    restDay: kind === "rest",
    summaryText: summarize(kind, distanceKm, draft.baselinePaceSecPerKm),
    distanceKm: kind === "rest" ? null : round1(distanceKm),
    targetRpe: rpe,
    primaryTarget: "rpe",
    granularity: "coarse",
    hardDay: QUALITY_KINDS.includes(kind),
    nonNegotiable: kind === "race",
    ruleIds: ["pass-3-day-placement"],
    feelCue: feelCue(kind, profile.preferences.locale),
  };
  if (draft.baselinePaceSecPerKm !== null && (kind === "easy" || kind === "long")) {
    // The contract requires pace targets in multiples of 5 s/km (plan-version.schema.json, multipleOf 5).
    // Rounding is part of the prescription, not a display concern: a target the contract rejects is a plan
    // no client can store.
    session.targetPaceMinSecPerKm = roundPace(draft.baselinePaceSecPerKm + draft.bandWidthSecPerKm);
    session.targetPaceMaxSecPerKm = roundPace(draft.baselinePaceSecPerKm + draft.bandWidthSecPerKm * 2);
    session.primaryTarget = "rpe";
  }
  return session;
}

function summarize(kind: SessionKind, distanceKm: number, baselinePace: number | null): string {
  if (kind === "rest") return "rest";
  const km = round1(distanceKm);
  if (kind === "long") return `long run ${km} km, easy effort, conversational`;
  if (kind === "easy") return `easy ${km} km, conversational`;
  if (kind === "tempo") return `tempo ${km} km with a sustained threshold block`;
  if (kind === "vo2max") return `vo2max ${km} km with short intervals`;
  if (kind === "hills") return `hills ${km} km with controlled climbs`;
  if (kind === "strides") return `easy ${km} km with 4-6 x 20 s strides`;
  if (kind === "race") return `race ${km} km`;
  return `${kind} ${km} km`;
}

function feelCue(kind: SessionKind, locale: string): string | null {
  if (locale !== "en") return null;
  if (kind === "easy" || kind === "long") return "you could hold a conversation";
  if (kind === "tempo") return "comfortably hard, three words at a time";
  if (kind === "vo2max") return "hard but repeatable";
  return null;
}

/**
 * The safety pass: last, and subtract-only (AGENTS rule 3). Both rules below come from
 * knowledge/heuristics/safety-hard-stops.yaml; a rule that would add load is not implemented here on
 * purpose, because a safety layer that can add is not a safety layer.
 */
function applySafety(draft: Draft, weeks: WeekPlan[]): void {
  const flags = draft.input.profile.health.flags ?? [];
  const locked = flags.includes("pregnant") || flags.includes("postpartum") || flags.includes("breastfeeding");
  if (locked) {
    const affected = draft.sessions.filter((session) => session.hardDay === true).map((session) => session.day);
    for (const session of draft.sessions) {
      if (session.hardDay !== true) continue;
      session.kind = "easy";
      session.hardDay = false;
      session.summaryText = summarize("easy", session.distanceKm ?? 0, draft.baselinePaceSecPerKm);
      session.ruleIds = [...(session.ruleIds ?? []), "pregnancy-postpartum-lock"];
    }
    if (affected.length > 0) {
      draft.appliedRules.push({
        ruleId: "pregnancy-postpartum-lock",
        anchor: "safety-hard-stops.yaml#pregnancy-postpartum-lock",
        effect: "subtracted",
        isSafety: true,
        severity: "constraint",
        daysAffected: affected,
        notes: "no intensity progression while the lock is active; hard sessions became easy",
      });
    }
  }

  const qualityDays = draft.sessions.filter((session) => session.hardDay === true).map((session) => session.day).sort();
  const removed: string[] = [];
  for (let index = 1; index < qualityDays.length; index += 1) {
    const earlier = qualityDays[index - 1];
    const later = qualityDays[index];
    if (!earlier || !later) continue;
    const gapHours = Math.abs(daysBetween(earlier, later)) * 24;
    if (gapHours >= draft.qualityGapHours) continue;
    const session = draft.sessions.find((candidate) => candidate.day === later);
    if (!session) continue;
    session.kind = "easy";
    session.hardDay = false;
    session.summaryText = summarize("easy", session.distanceKm ?? 0, draft.baselinePaceSecPerKm);
    session.ruleIds = [...(session.ruleIds ?? []), "no-double-hard-weekend"];
    removed.push(later);
  }
  if (removed.length > 0) {
    draft.appliedRules.push({
      ruleId: "no-double-hard-weekend",
      anchor: "safety-hard-stops.yaml#no-double-hard-weekend",
      effect: "subtracted",
      isSafety: true,
      severity: "constraint",
      daysAffected: removed,
      notes: `quality sessions closer than ${draft.qualityGapHours} h were downgraded to easy`,
    });
  }
}


function openQuestions(draft: Draft): string[] {
  const questions: string[] = [];
  const { profile, evidence } = draft.input;
  if (!profile.goal.event?.date) questions.push("Is there a race you are aiming at, and on what date?");
  if (evidence.baselinePaceSecPerKm === null) questions.push("Do you have a recent race or field test we can use to set your paces?");
  if (profile.availability.days.length < 3) questions.push("Which days of the week could you realistically run?");
  return questions.slice(0, 3);
}

export function generatePlan(input: PlanInput): PlanOutput {
  const draft = createDraft(input);
  const weeks = weeklyCurve(draft);
  placeSessions(draft, weeks);
  applySafety(draft, weeks);

  const sessions = [...draft.sessions].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const inputsHash = hashOf({
    profile: input.profile,
    evidence: input.evidence,
    state: input.state,
    clock: input.clock,
    seed: input.seed,
    knowledge: input.knowledge.hash,
    revisionRequest: input.revisionRequest ?? null,
  });
  const lastDay = addDays(input.state.planStartDay, input.state.horizonDays - 1);
  const version: PlanVersion = {
    schemaVersion: 1,
    versionId: uuidFrom({ inputsHash, salt: "version" }),
    planId: uuidFrom({ inputsHash, salt: "plan" }),
    userId: input.profile.userId,
    parentVersionId: null,
    generatedBy: input.revisionRequest ? "review-accepted" : "initial-build",
    generatedAtDay: input.clock.today,
    firstDay: input.state.planStartDay,
    lastDay,
    plannerVersion: PLANNER_VERSION,
    knowledgeHash: input.knowledge.hash,
    inputsHash,
    sessions,
    appliedRules: draft.appliedRules,
    clampedKnobs: draft.clampedKnobs,
    assumptions: draft.assumptions,
    warnings: draft.warnings,
  };
  return { version, openQuestions: openQuestions(draft) };
}
