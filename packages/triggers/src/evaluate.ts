/**
 * The rules from `review-triggers.yaml`, evaluated against computed signals.
 *
 * Three properties make this layer trustworthy:
 * - every fired rule names the knowledge anchor it was decided by;
 * - a rule that cannot be evaluated because a signal is unavailable is reported as `unevaluable` with the missing
 *   key, never skipped;
 * - arbitration is explicit data (presentation rank, then rule priority), so "which review opens" is a decision a
 *   reader can check instead of an accident of code order.
 */
import type { EvidenceGrade, ReviewEvidence, Signal, SignalKey } from "@training-planner/domain";
import { daysBetween } from "@training-planner/planner-core";
import type { Presentation, ReviewCandidate } from "@training-planner/review";
import type { DayRollup } from "@training-planner/signals";
import type { TriggerContext, TriggerFired, TriggerOutput, UnevaluableTrigger } from "./types";

const PRESENTATION_RANK: Record<Presentation, number> = {
  "interrupt-now": 3,
  "offer-at-next-open": 2,
  "weekly-summary": 1,
  recorded: 0,
};

/**
 * Tie-break order at the same presentation level: the runner's own request first, then the rules in the corpus
 * order, then the widest evidence window. Written down because "most specific" is otherwise a judgement call in
 * code that nobody can review.
 */
const RULE_PRIORITY: Record<string, number> = {
  "manual-always-allowed": 0,
  "plan-too-big": 1,
  "response-not-landing": 2,
  "load-rising-too-fast": 3,
};

const gradeOf = (signals: readonly Signal[]): EvidenceGrade => {
  if (signals.length === 0) return "D";
  if (signals.some((signal) => signal.confidence === "insufficient")) return "D";
  if (signals.every((signal) => signal.confidence === "high")) return "A";
  if (signals.some((signal) => signal.confidence === "medium")) return "B";
  return "C";
};

const evidenceOf = (ruleId: string, used: readonly Signal[], streakDays?: number): ReviewEvidence => ({
  signalIds: used.map((signal) => signal.key),
  ruleIds: [ruleId],
  evidenceGradeMax: gradeOf(used),
  ...(streakDays === undefined ? {} : { streakDays }),
});

const numberValue = (signal: Signal | undefined): number | null =>
  signal !== undefined && typeof signal.value === "number" ? signal.value : null;

const usableNumber = (signal: Signal | undefined): number | null =>
  signal === undefined || signal.confidence === "insufficient" ? null : numberValue(signal);

/** Hard sessions that did not happen in the window: skipped or missed, never merely unlogged. */
function qualityMisses(rollups: readonly DayRollup[], today: string, days: number): number {
  return rollups.filter((rollup) => {
    const distance = daysBetween(rollup.day, today);
    if (distance < 0 || distance >= days) return false;
    if (rollup.plannedHardDays === 0) return false;
    return rollup.outcome === "missed" || rollup.outcome === "skipped";
  }).length;
}

export function evaluateTriggers(context: TriggerContext): TriggerOutput {
  const { today, signals, knowledge } = context;
  const byKey = (key: SignalKey): Signal | undefined => signals.signals.find((signal) => signal.key === key);
  const fired: TriggerFired[] = [];
  const unevaluable: UnevaluableTrigger[] = [];

  const thresholds = knowledge.knob("review-triggers.yaml#plan_too_big_thresholds").value as {
    completion_rate_lt: number;
    window_days: number;
    quality_misses_ge: number;
  };

  // ---- plan-too-big: chronic under-completion, or specifically the hard days not happening -------------
  {
    const completion = byKey("completion_rate");
    const completionValue = usableNumber(completion);
    const misses = qualityMisses(signals.rollups, today, 7);
    const completionCrossed = completionValue !== null && completionValue < thresholds.completion_rate_lt;
    const missesCrossed = misses >= thresholds.quality_misses_ge;
    if (completionCrossed || missesCrossed) {
      const used = completion === undefined ? [] : [completion];
      fired.push({
        ruleId: "plan-too-big",
        anchor: "review-triggers.yaml#plan_too_big_thresholds",
        presentation: "offer-at-next-open",
        evidence: evidenceOf("plan-too-big", used),
        detail: `completion ${completionCrossed ? String(completionValue) : "not crossed"}; quality misses ${misses} of ${thresholds.quality_misses_ge} allowed`,
      });
    } else if (completionValue === null && !missesCrossed) {
      unevaluable.push({
        ruleId: "plan-too-big",
        anchor: "review-triggers.yaml#plan_too_big_thresholds",
        missing: "completion_rate",
        reason: completion?.confidenceNote ?? "no completion signal at all",
      });
    }
  }

  // ---- load-rising-too-fast: a ramp above the corpus ceiling, or a week with no shape ----------------
  {
    const ramp = byKey("ramp_rate");
    const monotony = byKey("load_monotony");
    const incrementPct = knowledge.number("load-progression.yaml#weekly_increment_pct");
    const rampValue = usableNumber(ramp);
    const rampCrossed = rampValue !== null && rampValue > incrementPct;
    const monotonyCrossed = monotony?.crossedThreshold === true;
    if (rampCrossed || monotonyCrossed) {
      const used = [ramp, monotony].filter((signal): signal is Signal => signal !== undefined && signal.confidence !== "insufficient");
      fired.push({
        ruleId: "load-rising-too-fast",
        anchor: "load-progression.yaml#weekly_increment_pct",
        presentation: "weekly-summary",
        evidence: evidenceOf("load-rising-too-fast", used),
        detail: `ramp ${rampCrossed ? `${String(rampValue)}%` : "not crossed"} against ${incrementPct}%; monotony ${monotonyCrossed ? "above band" : "inside band"}`,
      });
    } else if (rampValue === null && monotony?.confidence === "insufficient") {
      unevaluable.push({
        ruleId: "load-rising-too-fast",
        anchor: "load-progression.yaml#weekly_increment_pct",
        missing: "ramp_rate",
        reason: ramp?.confidenceNote ?? "no ramp signal at all",
      });
    }
  }

  // ---- response-not-landing: the same session feels harder, repeatedly ------------------------------
  {
    const gap = byKey("rpe_gap");
    const required = knowledge.number("review-triggers.yaml#performance_decline_sessions");
    const streak = gap?.consecutiveDays ?? 0;
    if (gap?.crossedThreshold === true && streak >= required) {
      fired.push({
        ruleId: "response-not-landing",
        anchor: "review-triggers.yaml#rpe_gap_threshold",
        presentation: "offer-at-next-open",
        evidence: evidenceOf("response-not-landing", [gap], streak),
        detail: `rpe gap ${String(usableNumber(gap))} for ${streak} consecutive readings (${required} needed)`,
      });
    } else if (gap === undefined || gap.confidence === "insufficient") {
      unevaluable.push({
        ruleId: "response-not-landing",
        anchor: "review-triggers.yaml#rpe_gap_threshold",
        missing: "rpe_gap",
        reason: gap?.confidenceNote ?? "no rpe_gap signal at all",
      });
    }
  }

  // ---- the rules that need inputs this build does not have ------------------------------------------
  unevaluable.push(
    {
      ruleId: "goal-feasibility",
      anchor: "review-triggers.yaml#goal_date_min_weeks",
      missing: null,
      reason: "the goal date is not carried on the plan version, so weeks-to-race cannot be computed",
    },
    {
      ruleId: "life-changed",
      anchor: "review-triggers.yaml#suppression-and-dwell",
      missing: null,
      reason: "profile constraints (available days, travel flags) are not part of the plan or the log yet",
    },
    {
      ruleId: "stale-evidence",
      anchor: "review-triggers.yaml#stale-evidence",
      missing: "pace_bands",
      reason: "pace bands need a field test or race result; a stale anchor must not be used silently",
    },
  );

  // ---- manual: the runner asked, and that is always allowed ----------------------------------------
  if (context.manual !== undefined) {
    fired.push({
      ruleId: "manual-always-allowed",
      anchor: "review-triggers.yaml#manual-always-allowed",
      presentation: "offer-at-next-open",
      evidence: { signalIds: [], ruleIds: ["manual-always-allowed"], evidenceGradeMax: "A" },
      detail: `manual request: ${context.manual.kind}`,
    });
  }

  const ranked = [...fired].sort((a, b) => {
    const byPresentation = PRESENTATION_RANK[b.presentation] - PRESENTATION_RANK[a.presentation];
    if (byPresentation !== 0) return byPresentation;
    return (RULE_PRIORITY[a.ruleId] ?? 99) - (RULE_PRIORITY[b.ruleId] ?? 99);
  });

  const chosen = ranked[0];
  const candidate: ReviewCandidate | undefined =
    chosen === undefined
      ? undefined
      : {
          kind: chosen.ruleId,
          ruleId: chosen.ruleId,
          anchor: chosen.anchor,
          evidence: chosen.evidence,
          presentation: chosen.presentation,
        };

  return { fired: ranked, candidate, unevaluable };
}
