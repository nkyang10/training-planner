/**
 * The signals, computed from the log and the plan. Pure: no clock, no network, no random.
 *
 * What this package is allowed to claim is the whole design. A signal carries `confidence` and a
 * `confidenceNote` that says *why* it is low, and a signal that cannot be computed at all goes into
 * `unavailable` with its reason instead of being emitted with a made-up number. A runner's plan must never be
 * re-planned on a signal that was really an absence of data.
 */
import type { DayEntry, DayEntryOutcome, PlanVersion, Signal, SignalConfidence, SignalDrive, SignalKey } from "@training-planner/domain";
import { canonicalJson, hashOf } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { painReportsOf, painTrendOf } from "@training-planner/entries";
import { addDays, daysBetween, weekStart } from "@training-planner/planner-core";
import type { DayRollup, SignalInput, SignalOutput, UnavailableSignal } from "./types";

const round = (value: number, digits = 3): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined ? null : (left + right) / 2;
};

const standardDeviation = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

/** The current revision of every logged day: a correction replaces the meaning of the day, not its history. */
function currentEntries(entries: readonly DayEntry[]): Map<string, DayEntry> {
  const byDay = new Map<string, DayEntry>();
  for (const entry of entries) {
    const existing = byDay.get(entry.day);
    if (existing === undefined || entry.revision > existing.revision) byDay.set(entry.day, entry);
  }
  return byDay;
}

const dayInWindow = (day: string, endDay: string, days: number): boolean => {
  const distance = daysBetween(day, endDay);
  return distance >= 0 && distance < days;
};

export function computeSignals(input: SignalInput): SignalOutput {
  const { userId, today, plan, knowledge, computedAt } = input;
  const current = currentEntries(input.entries);
  const thresholds = knowledge.knob("review-triggers.yaml#plan_too_big_thresholds").value as {
    completion_rate_lt: number;
    window_days: number;
    quality_misses_ge: number;
  };
  const rpeGapThreshold = knowledge.number("review-triggers.yaml#rpe_gap_threshold");
  const monotonyBand = knowledge.number("review-triggers.yaml#monotony_band");
  const knowledgeHash = knowledge.hash;

  const sessionOn = (day: string) => plan.sessions.find((session) => session.day === day);
  const plannedKmOn = (day: string): number => {
    const session = sessionOn(day);
    if (session === undefined || session.kind === "rest") return 0;
    return session.distanceKm ?? 0;
  };

  // ---- rollups -------------------------------------------------------------------------------------
  const rollups: DayRollup[] = [];
  const lastDay = plan.lastDay < today ? plan.lastDay : today;
  for (let day = plan.firstDay; day <= lastDay; day = addDays(day, 1)) {
    const sessions = plan.sessions.filter((session) => session.day === day);
    const plannedKm = sessions.reduce((sum, session) => sum + (session.kind === "rest" ? 0 : (session.distanceKm ?? 0)), 0);
    const entry = current.get(day);
    const outcome = entry?.outcome ?? null;
    const completedKm =
      entry === undefined
        ? 0
        : entry.completedKm ?? (outcome === "completed" ? plannedKm : 0);
    rollups.push({
      day,
      plannedSessions: sessions.filter((session) => session.kind !== "rest").length,
      plannedKm: round(plannedKm, 2),
      plannedHardDays: sessions.filter((session) => session.hardDay === true).length,
      restDay: sessions.every((session) => session.kind === "rest"),
      logged: entry !== undefined,
      outcome,
      completedKm: round(completedKm, 2),
      adherence: plannedKm === 0 ? null : round(completedKm / plannedKm, 3),
      unlogged: entry === undefined && day < today,
    });
  }
  const rollupOn = (day: string): DayRollup | undefined => rollups.find((rollup) => rollup.day === day);

  const signals: Signal[] = [];
  const unavailable: UnavailableSignal[] = [];

  const emit = (signal: {
    key: SignalKey;
    kind: "rolling-days" | "iso-week" | "single-day";
    days?: number;
    value: Signal["value"];
    unit?: string | null;
    confidence: SignalConfidence;
    confidenceNote?: string | null;
    mayDrive: SignalDrive[];
    direction?: Signal["direction"];
    consecutiveDays?: number | null;
    crossedThreshold?: boolean | null;
    dataQuality?: Signal["dataQuality"];
  }): void => {
    const window: Signal["window"] = { kind: signal.kind };
    if (signal.days !== undefined) window.days = signal.days;
    signals.push({
      key: signal.key,
      userId,
      asOfDay: today,
      window,
      value: signal.value,
      ...(signal.unit === undefined ? {} : { unit: signal.unit }),
      confidence: signal.confidence,
      ...(signal.confidenceNote === undefined ? {} : { confidenceNote: signal.confidenceNote }),
      mayDrive: signal.mayDrive,
      ...(signal.direction === undefined ? {} : { direction: signal.direction }),
      ...(signal.consecutiveDays === undefined ? {} : { consecutiveDays: signal.consecutiveDays }),
      ...(signal.crossedThreshold === undefined ? {} : { crossedThreshold: signal.crossedThreshold }),
      ...(signal.dataQuality === undefined ? {} : { dataQuality: signal.dataQuality }),
      computedAt,
      inputsHash: hashOf(
        canonicalJson({
          userId,
          today,
          planVersionId: plan.versionId,
          entries: [...current.values()].map((entry) => ({ day: entry.day, revision: entry.revision })),
        }),
      ),
      knowledgeHash,
    });
  };

  // ---- completion_rate: planned sessions in the window vs the ones that happened ---------------------
  const completionWindow = thresholds.window_days;
  const completionDays = rollups.filter((rollup) => dayInWindow(rollup.day, today, completionWindow) && rollup.plannedSessions > 0);
  const completedDays = completionDays.filter((rollup) => rollup.outcome === "completed" || rollup.outcome === "partial");
  if (completionDays.length < 2) {
    emit({
      key: "completion_rate",
      kind: "rolling-days",
      days: completionWindow,
      value: null,
      unit: "fraction",
      confidence: "insufficient",
      confidenceNote: `${completionDays.length} planned day(s) inside the window; at least 2 are needed`,
      mayDrive: ["review", "narrator"],
    });
  } else {
    const rate = completedDays.length / completionDays.length;
    const wholeWindow = daysBetween(plan.firstDay, addDays(today, -(completionWindow - 1))) >= 0;
    emit({
      key: "completion_rate",
      kind: "rolling-days",
      days: completionWindow,
      value: round(rate, 3),
      unit: "fraction",
      confidence: wholeWindow ? "high" : "medium",
      confidenceNote: wholeWindow ? null : "the plan does not cover the whole window yet",
      mayDrive: ["review", "narrator"],
      crossedThreshold: rate < thresholds.completion_rate_lt,
    });
  }

  // ---- rpe_gap: how much harder the sessions felt than they were prescribed --------------------------
  const gapSamples: { day: string; gap: number }[] = [];
  for (let day = addDays(today, -6); day <= today; day = addDays(day, 1)) {
    const entry = current.get(day);
    const session = sessionOn(day);
    if (entry === undefined || entry.rpe === null || entry.rpe === undefined) continue;
    if (session === undefined || session.targetRpe === null || session.targetRpe === undefined) continue;
    gapSamples.push({ day, gap: entry.rpe - session.targetRpe });
  }
  const medianGap = median(gapSamples.map((sample) => sample.gap));
  if (gapSamples.length < 2 || medianGap === null) {
    emit({
      key: "rpe_gap",
      kind: "rolling-days",
      days: 7,
      value: null,
      unit: "rpe-points",
      confidence: "insufficient",
      confidenceNote: `${gapSamples.length} session(s) with both a reported and a prescribed effort`,
      mayDrive: ["micro", "review"],
    });
  } else {
    // The streak counts consecutive *readings*, not calendar days: a rest day between two sessions does not break
    // it, which is what "three consecutive readings" in the trigger means. The trigger layer still owns the "3".
    const newestFirst = [...gapSamples].sort((a, b) => (a.day < b.day ? 1 : -1));
    let consecutiveDays = 0;
    for (const sample of newestFirst) {
      if (sample.gap <= rpeGapThreshold) break;
      consecutiveDays += 1;
    }
    emit({
      key: "rpe_gap",
      kind: "rolling-days",
      days: 7,
      value: round(medianGap, 2),
      unit: "rpe-points",
      confidence: gapSamples.length >= 3 ? "medium" : "low",
      confidenceNote: `${gapSamples.length} session(s) compared with their prescribed effort`,
      mayDrive: ["micro", "review"],
      consecutiveDays,
      crossedThreshold: medianGap > rpeGapThreshold,
    });
  }

  // ---- log_continuity: how much of the plan the runner has actually told us about -------------------
  const continuityDays = rollups.filter((rollup) => dayInWindow(rollup.day, today, 14) && rollup.plannedSessions > 0);
  const continuityLogged = continuityDays.filter((rollup) => rollup.logged);
  if (continuityDays.length < 3) {
    emit({
      key: "log_continuity",
      kind: "rolling-days",
      days: 14,
      value: null,
      unit: "fraction",
      confidence: "insufficient",
      confidenceNote: `${continuityDays.length} planned day(s) inside the window; at least 3 are needed`,
      mayDrive: ["display", "review"],
    });
  } else {
    emit({
      key: "log_continuity",
      kind: "rolling-days",
      days: 14,
      value: round(continuityLogged.length / continuityDays.length, 3),
      unit: "fraction",
      confidence: "high",
      mayDrive: ["display", "review"],
      dataQuality: {
        expectedDays: continuityDays.length,
        presentDays: continuityLogged.length,
        coveragePct: round((continuityLogged.length / continuityDays.length) * 100, 1),
        source: "manual",
      },
    });
  }

  // ---- weekly_load: the plan's kilometres for the ISO week containing today -------------------------
  const thisWeekStart = weekStart(today);
  const weekKm = plan.sessions
    .filter((session) => weekStart(session.day) === thisWeekStart)
    .reduce((sum, session) => sum + (session.kind === "rest" ? 0 : (session.distanceKm ?? 0)), 0);
  emit({
    key: "weekly_load",
    kind: "iso-week",
    value: round(weekKm, 2),
    unit: "km",
    confidence: "high",
    mayDrive: ["display"],
  });

  // ---- load_monotony: mean daily load over its standard deviation ----------------------------------
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(thisWeekStart, index));
  const dailyLoads = weekDays.map((day) => plannedKmOn(day));
  const meanLoad = dailyLoads.reduce((sum, value) => sum + value, 0) / 7;
  const sdLoad = standardDeviation(dailyLoads);
  if (sdLoad === 0) {
    emit({
      key: "load_monotony",
      kind: "rolling-days",
      days: 7,
      value: null,
      unit: "ratio",
      confidence: "insufficient",
      confidenceNote: "no variation in daily load inside the week",
      mayDrive: ["review"],
    });
  } else {
    const monotony = meanLoad / sdLoad;
    emit({
      key: "load_monotony",
      kind: "rolling-days",
      days: 7,
      value: round(monotony, 2),
      unit: "ratio",
      confidence: "medium",
      mayDrive: ["review"],
      crossedThreshold: monotony > monotonyBand,
    });
  }

  // ---- ramp_rate: this week's planned volume against the previous week's ---------------------------
  const previousWeekStart = addDays(thisWeekStart, -7);
  const previousKm = plan.sessions
    .filter((session) => weekStart(session.day) === previousWeekStart)
    .reduce((sum, session) => sum + (session.kind === "rest" ? 0 : (session.distanceKm ?? 0)), 0);
  if (previousKm === 0) {
    emit({
      key: "ramp_rate",
      kind: "rolling-days",
      days: 14,
      value: null,
      unit: "percent",
      confidence: "insufficient",
      confidenceNote: "the previous week planned no distance, so a ramp has no denominator",
      mayDrive: ["review"],
    });
  } else {
    emit({
      key: "ramp_rate",
      kind: "rolling-days",
      days: 14,
      value: round(((weekKm - previousKm) / previousKm) * 100, 1),
      unit: "percent",
      confidence: "medium",
      mayDrive: ["review"],
    });
  }

  // ---- pain_trend: the trajectory over the reports, from the same two functions the page and the API use ----
  //
  // The rows are derived here from the entries rather than read from the repository, because `computeSignals` takes
  // the log and nothing else; the derivation is `painReportsOf`, which is also what the write path stores, so the
  // signal and the page cannot disagree about the same report. The direction is `painTrendOf`'s, not a second rule:
  // one report is a point, and it is emitted as `unknown` rather than as a stable-looking number.
  const painReports = [...current.values()].flatMap((entry) => painReportsOf({ userId: input.userId, entry }));
  const trend = painTrendOf({ reports: painReports, today });
  if (trend.days === 0) {
    emit({
      key: "pain_trend",
      kind: "rolling-days",
      days: 7,
      value: null,
      unit: "0-10",
      confidence: "insufficient",
      confidenceNote: "no pain reported in the window, which is not the same as no pain",
      mayDrive: ["safety", "review"],
    });
  } else {
    emit({
      key: "pain_trend",
      kind: "rolling-days",
      days: 7,
      value: trend.peak,
      unit: "0-10",
      // Two days of reports is the first evidence of a direction; one report is not evidence of anything.
      confidence: trend.note === "compared-first-and-last" ? "medium" : "low",
      confidenceNote:
        trend.note === "one-report"
          ? "1 report is a point, not a trend"
          : `${trend.days} day(s) with reports in the window`,
      mayDrive: ["safety", "review"],
      direction: trend.direction,
      crossedThreshold: (trend.peak ?? 0) >= 7,
    });
  }

  // ---- device_coverage: the honest zero ------------------------------------------------------------
  const imported = new Set(input.importedDays ?? []);
  const expectedDays = Array.from({ length: 14 }, (_, index) => addDays(today, -index));
  const presentDays = expectedDays.filter((day) => imported.has(day)).length;
  emit({
    key: "device_coverage",
    kind: "rolling-days",
    days: 14,
    value: round(presentDays / expectedDays.length, 3),
    unit: "fraction",
    confidence: "insufficient",
    confidenceNote: "no activity source is connected yet (imports land in M4)",
    mayDrive: ["display"],
    dataQuality: {
      expectedDays: expectedDays.length,
      presentDays,
      coveragePct: round((presentDays / expectedDays.length) * 100, 1),
      source: "assumed",
    },
  });

  // ---- what the corpus names and this build cannot compute -----------------------------------------
  unavailable.push(
    { key: "hrv_lnrmssd_dev", reason: "needs a wearable HRV source; none is connected (M4)" },
    { key: "rhr_dev", reason: "needs resting-heart-rate data from a device; none is connected (M4)" },
    { key: "sleep_debt", reason: "needs sleep data from a device; none is connected (M4)" },
    { key: "wellness_index", reason: "needs the tier-2 wellness fields at a usable response rate; not yet measured" },
    { key: "acwr", reason: "needs an established load model; sRPE and TRIMP both need heart-rate data" },
    { key: "pace_bands", reason: "needs a field test or race result; a stale anchor must not be used silently" },
  );

  const sorted = [...signals].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { rollups, signals: sorted, unavailable };
}

/** Convenience for the API and the worker: the signal for a key, or undefined. */
export function signalByKey(output: SignalOutput, key: SignalKey): Signal | undefined {
  return output.signals.find((signal) => signal.key === key);
}

export type { PlanVersion };
