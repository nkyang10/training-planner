/**
 * The policy evaluator: one day entry in, one typed decision out.
 *
 * The order of the passes is the contract, not a style choice (docs/engine/feedback-loop.md §3):
 * safety-hard-stops -> missed-session-rules -> daily-feedback-rules -> review-triggers. A later pass may
 * never undo an earlier one, and the conflict rule is "the more conservative action wins".
 *
 * Everything numeric is read from knowledge by anchor, and everything the evaluator decides is recorded in
 * `appliedRules[]` with that anchor, so a comment printed six months from now can still be explained.
 */
import type { DayEntry, PlanVersion, Session } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { addDays, daysBetween, weekStart } from "@training-planner/planner-core";
import { ruleOf } from "./rules";
import type {
  AppliedPolicyRule,
  CommentFacts,
  FactLine,
  FactTemplate,
  HardStop,
  MicroAdjustment,
  PolicyDecision,
  PolicyHistory,
  PolicyInput,
  ReviewFlag,
  ReviewKind,
} from "./types";

const QUALITY_KINDS = new Set(["tempo", "vo2max", "hills", "mp", "test", "race"]);
const EASY_KINDS = new Set(["easy", "recovery", "strides", "cross-training", "strength"]);

const isQuality = (session: Session | undefined): boolean =>
  session !== undefined && (session.hardDay === true || QUALITY_KINDS.has(session.kind));
const isEasy = (session: Session | undefined): boolean => session !== undefined && EASY_KINDS.has(session.kind);

function numberAt(knowledge: KnowledgeBundle, anchor: string): number {
  return knowledge.number(anchor);
}

function recordAt(knowledge: KnowledgeBundle, anchor: string): Record<string, number> {
  const value = knowledge.knob(anchor).value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`knowledge knob ${anchor} is not an object`);
  }
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) if (typeof entry === "number") out[key] = entry;
  return out;
}

/**
 * Literal numbers that come from a rule sentence rather than a knob, each with the sentence that owns it.
 * They are collected here so "no magic numbers in the engine" stays a claim a reviewer can check: a new
 * literal either appears in this table with its anchor, or it is a number nobody can defend.
 */
const RULE_TEXT_NUMBERS = {
  /** safety-hard-stops.yaml#pain-escalation: "pain.intensity >= 7". */
  painEscalationIntensity: 7,
  /** safety-hard-stops.yaml#fever-or-below-neck-illness: "downgrade(all_quality_within_next_3d)". */
  illnessDowngradeHours: 3 * 24,
  /** safety-hard-stops.yaml#pain-escalation: "constrain(next_7d: no_intensity)". */
  painConstrainHours: 7 * 24,
  /** missed-session-rules.yaml#missed-quality-swap-if-legal: "not adjacent_to_long_run". */
  longRunAdjacencyHours: 24,
} as const;

/** The acknowledge sentence is about what happened, so it follows the outcome rather than the rule that fired. */
function acknowledgeTemplate(entry: DayEntry): FactTemplate {
  if (entry.sessionTaken === "alternate") return "acknowledge.alternate";
  switch (entry.outcome) {
    case "completed":
      return "acknowledge.completed";
    case "partial":
      return "acknowledge.partial";
    case "rest":
      return "acknowledge.rest";
    case "skipped":
      return "acknowledge.skipped";
    case "missed":
      return "acknowledge.skipped";
  }
}

const sessionOn = (plan: PlanVersion, day: string): Session | undefined =>
  plan.sessions.find((session) => session.day === day);

const firstSessionAfter = (plan: PlanVersion, day: string, predicate: (session: Session) => boolean): Session | undefined =>
  plan.sessions.filter((session) => session.day > day && predicate(session)).sort((a, b) => (a.day < b.day ? -1 : 1))[0];

/** Running kilometres in the Monday-Sunday week that contains `day`. Used as the load comparison for a change. */
function weekKm(plan: PlanVersion, day: string): number {
  const start = weekStart(day);
  const end = addDays(start, 6);
  const total = plan.sessions
    .filter((session) => session.day >= start && session.day <= end)
    .reduce((sum, session) => sum + (session.distanceKm ?? 0), 0);
  return Math.round(total * 10) / 10;
}

/** Civil-day distance in hours; no clock is read, so two runs on two machines cannot disagree. */
const gapHours = (a: string, b: string): number => Math.abs(daysBetween(a, b)) * 24;

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const { entry, plan, today, knowledge } = input;
  const history: PolicyHistory = input.history ?? {};
  const tomorrow = addDays(today, 1);

  const appliedRules: AppliedPolicyRule[] = [];
  const openQuestions: string[] = [];
  const acknowledge: FactLine[] = [];
  const interpret: FactLine[] = [];
  const redirect: FactLine[] = [];
  const numbers = new Set<number>();
  const suppressed: string[] = [];

  const apply = (ruleId: string, effect: AppliedPolicyRule["effect"], note?: string): void => {
    const spec = ruleOf(ruleId);
    appliedRules.push({ ruleId: spec.id, anchor: spec.anchor, tier: spec.tier, effect, ...(note === undefined ? {} : { note }) });
  };
  /** A rule that governs a sentence without changing a session still fired; it is recorded once. */
  const applyOnce = (ruleId: string, effect: AppliedPolicyRule["effect"], note?: string): void => {
    if (appliedRules.some((rule) => rule.ruleId === ruleId)) return;
    apply(ruleId, effect, note);
  };

  const fact = (target: FactLine[], template: FactTemplate, ruleId: string, slots: Record<string, string | number> = {}): void => {
    for (const value of Object.values(slots)) if (typeof value === "number") numbers.add(value);
    target.push({ template, slots, ruleId, anchor: ruleOf(ruleId).anchor });
  };

  const commentMaxSentences = recordAt(knowledge, "daily-feedback-rules.yaml#comment-contract")["max_sentences"] ?? 4;
  const scale = recordAt(knowledge, "daily-feedback-rules.yaml#rpe_scale");
  const legsScale = scale["legs"] ?? 5;

  // The entry names the day being judged; `today` is only the boundary for what may change. They differ on a
  // backfilled entry, and confusing them would judge the wrong session - a correction from yesterday would be
  // read against today s prescription.
  const entrySession = sessionOn(plan, entry.day);
  const tomorrowSession = sessionOn(plan, tomorrow);
  const pain = entry.pain ?? [];
  const symptoms = entry.wellness?.illnessSymptoms ?? [];

  let hardStop: HardStop | undefined;
  let adjustTomorrow: MicroAdjustment | undefined;
  let flagReview: ReviewFlag | undefined;
  let nudgeFact: FactLine | undefined;

  const downgrade = (day: string, session: Session | undefined, ruleId: string, reason: string, cost: string, isSafety: boolean): void => {
    if (session === undefined || adjustTomorrow !== undefined) return;
    const before = weekKm(plan, day);
    const factor = 1 - numberAt(knowledge, "wellness.yaml#downgrade_magnitude_pct") / 100;
    const after = Math.round(before * factor * 10) / 10;
    adjustTomorrow = {
      day,
      kind: "downgrade",
      beforeSummary: `${session.kind} ${session.distanceKm ?? 0} km`,
      afterSummary: `${session.kind === "rest" ? "rest" : "easy"} ${Math.round((session.distanceKm ?? 0) * factor * 10) / 10} km`,
      reason,
      ruleId,
      anchor: ruleOf(ruleId).anchor,
      expectedCost: cost,
      isSafety,
      beforeKm: before,
      afterKm: after,
    };
  };

  // ---------------------------------------------------------------------------------------------
  // Pass 1 - safety. Before any planning logic; nothing later may undo what this pass decides.
  // ---------------------------------------------------------------------------------------------
  const chestPain = pain.some((report) => report.site.toLowerCase().includes("chest"));
  const chestSymptom = symptoms.includes("chest");
  if (chestPain || chestSymptom) {
    hardStop = {
      ruleId: "chest-cardiac",
      anchor: ruleOf("chest-cardiac").anchor,
      scope: "all-future-sessions-in-phase",
      instruction: "Stop training and seek urgent medical assessment for chest symptoms.",
      referral: "urgent",
      suppressCoaching: true,
    };
  }

  const illnessStop = symptoms.some((symptom) => ["fever", "below-neck", "GI", "chest"].includes(symptom));
  if (hardStop === undefined && illnessStop && entry.outcome !== "rest") {
    hardStop = {
      ruleId: "fever-or-below-neck-illness",
      anchor: ruleOf("fever-or-below-neck-illness").anchor,
      scope: "today",
      instruction: "No training today. Rest until you have been symptom-free for 48 hours, then start easy.",
      referral: null,
      suppressCoaching: true,
    };
    const nextQuality = firstSessionAfter(plan, today, isQuality);
    if (nextQuality && gapHours(today, nextQuality.day) <= RULE_TEXT_NUMBERS.illnessDowngradeHours) {
      downgrade(nextQuality.day, nextQuality, "fever-or-below-neck-illness", "you are ill", "the quality session moves to easy", true);
    }
  }

  const boneFlag = pain.some(
    (report) =>
      report.nightPain === true ||
      (report.affectsGait === true && ["1-2-weeks", "over-2-weeks", "recurring"].includes(report.duration ?? "")),
  );
  if (hardStop === undefined && boneFlag) {
    hardStop = {
      ruleId: "night-pain-or-bone-tenderness",
      anchor: ruleOf("night-pain-or-bone-tenderness").anchor,
      scope: "all-sessions",
      instruction: "Stop running and get this pain assessed by a clinician before the next session.",
      referral: "routine-urgent",
      suppressCoaching: true,
    };
  }

  const escalating = pain.some((report) => report.intensity >= RULE_TEXT_NUMBERS.painEscalationIntensity);
  if (hardStop === undefined && escalating) {
    hardStop = {
      ruleId: "pain-escalation",
      anchor: ruleOf("pain-escalation").anchor,
      scope: "today",
      instruction: "Do not run through this pain today; it needs a clinician's opinion before the next session.",
      referral: "routine-urgent",
      suppressCoaching: true,
    };
    const nextQuality = firstSessionAfter(plan, today, isQuality);
    if (nextQuality && gapHours(today, nextQuality.day) <= RULE_TEXT_NUMBERS.painConstrainHours) {
      downgrade(nextQuality.day, nextQuality, "pain-escalation", "pain is escalating", "no intensity for the next week", true);
    }
  }

  if (hardStop !== undefined) {
    apply(hardStop.ruleId, "informed", hardStop.scope);
    apply("safety-text-first", "dosed", "sentence one is the instruction; praise and coaching suppressed");
    suppressed.push("praise", "coaching");
    fact(acknowledge, acknowledgeTemplate(entry), "safety-text-first");
    fact(redirect, "redirect.safety-instruction", "safety-text-first", { scope: hardStop.scope });
    if (hardStop.referral !== null) fact(interpret, "interpret.pain-reported", "safety-text-first");
    return finish({
      entry,
      plan,
      today,
      acknowledge,
      interpret,
      redirect,
      numbers,
      suppressed,
      appliedRules,
      openQuestions,
      commentMaxSentences,
      hardStop,
      adjustTomorrow,
      flagReview,
      nudge: nudgeFact,
      silence: false,
      safetyFirst: true,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Pass 2 - missed work. Missed work is gone; the plan adapts around it and never makes it up.
  // ---------------------------------------------------------------------------------------------
  const streakDays = history.consecutiveMissDays ?? 0;
  const multiMissDays = numberAt(knowledge, "missed-session-rules.yaml#multi_miss_streak_days");

  if (entry.outcome === "missed") {
    apply("unlogged-is-not-zero", "informed", "absence is a signal, not a zero");
    apply("no-comment-on-unlogged", "suppressed", "no comment on an unlogged day");
    suppressed.push("comment");
    nudgeFact = {
      template: "redirect.nudge-unlogged",
      slots: { days: streakDays + 1 },
      ruleId: "unlogged-is-not-zero",
      anchor: ruleOf("unlogged-is-not-zero").anchor,
    };
    numbers.add(streakDays + 1);
    if (streakDays + 1 >= multiMissDays) {
      apply("streak-reanchors-volume", "informed", `${streakDays + 1} consecutive missed days`);
      flagReview = {
        kind: "capacity-change",
        ruleId: "streak-reanchors-volume",
        anchor: ruleOf("streak-reanchors-volume").anchor,
        why: "the plan's capacity assumption is stale after a miss streak",
        proposals: ["reanchor-volume", "rebuild-week-template"],
      };
    }
    return finish({
      entry,
      plan,
      today,
      acknowledge,
      interpret,
      redirect,
      numbers,
      suppressed,
      appliedRules,
      openQuestions,
      commentMaxSentences,
      hardStop,
      adjustTomorrow,
      flagReview,
      nudge: nudgeFact,
      silence: true,
      safetyFirst: false,
    });
  }

  if (entry.outcome === "skipped") {
    apply("never-make-up", "informed", "no future day may be loaded to compensate");
    if (isEasy(entrySession) || entrySession === undefined || entrySession.kind === "rest") {
      apply("missed-easy-delete", "informed", "an easy miss is deleted, not rescheduled");
      fact(acknowledge, "acknowledge.skipped", "missed-easy-delete", { kind: entrySession?.kind ?? "rest" });
      fact(redirect, "redirect.tomorrow-kept", "missed-easy-delete");
    } else {
      const swapWindow = numberAt(knowledge, "missed-session-rules.yaml#swap_window_days");
      const slot = findLegalSlot(plan, entry.day, swapWindow, knowledge);
      if (slot !== undefined) {
        apply("missed-quality-swap-if-legal", "dosed", `quality moves to ${slot}`);
        const before = weekKm(plan, entry.day);
        adjustTomorrow = {
          day: slot,
          kind: "swap",
          beforeSummary: `${entrySession?.kind ?? "quality"} ${entrySession?.distanceKm ?? 0} km missed`,
          afterSummary: `${entrySession?.kind ?? "quality"} ${entrySession?.distanceKm ?? 0} km on ${slot}`,
          reason: "the quality session moved to the nearest legal slot",
          ruleId: "missed-quality-swap-if-legal",
          anchor: ruleOf("missed-quality-swap-if-legal").anchor,
          expectedCost: "the week's easy day becomes the quality day",
          isSafety: false,
          beforeKm: before,
          afterKm: before,
        };
        fact(acknowledge, "acknowledge.skipped", "missed-quality-swap-if-legal", { kind: entrySession?.kind ?? "quality" });
        fact(redirect, "redirect.tomorrow-swapped", "missed-quality-swap-if-legal", { day: slot });
      } else {
        apply("missed-quality-drop-if-illegal", "informed", "no legal slot inside the swap window");
        fact(acknowledge, "acknowledge.skipped", "missed-quality-drop-if-illegal", { kind: entrySession?.kind ?? "quality" });
        fact(redirect, "redirect.tomorrow-kept", "missed-quality-drop-if-illegal");
      }
    }
  }

  if (entry.outcome === "partial") {
    apply("never-make-up", "informed", "partial work is recorded as partial, never topped up");
    fact(acknowledge, "acknowledge.partial", "never-make-up", {
      ...(entry.completedKm !== undefined && entry.completedKm !== null ? { km: entry.completedKm } : {}),
      ...(entry.durationMin !== undefined && entry.durationMin !== null ? { min: entry.durationMin } : {}),
    });
    fact(redirect, "redirect.tomorrow-kept", "never-make-up");
  }

  if (entry.sessionTaken === "alternate") {
    apply("alternate-counts-as-met", "informed", "the alternate was a success");
    fact(acknowledge, "acknowledge.alternate", "alternate-counts-as-met");
  }

  if (entry.sessionTaken === "extra") {
    apply("extra-activity-subtracts", "informed", "extra activity protects the next quality day");
    fact(interpret, "interpret.extra-subtracts", "extra-activity-subtracts");
    const guardHours = numberAt(knowledge, "missed-session-rules.yaml#extra_activity_stack_guard_h");
    const nextQuality = firstSessionAfter(plan, today, isQuality);
    if (nextQuality && gapHours(today, nextQuality.day) <= guardHours) {
      downgrade(nextQuality.day, nextQuality, "extra-activity-subtracts", "you did extra work close to a quality day", "the quality session becomes easy", false);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Pass 3 - the day itself: effort gap, legs, sleep, pain.
  // ---------------------------------------------------------------------------------------------
  const plannedRpe = entrySession?.targetRpe ?? null;
  const rpeGap = entry.rpe !== undefined && entry.rpe !== null && plannedRpe !== null ? entry.rpe - plannedRpe : null;
  const trigger = recordAt(knowledge, "daily-feedback-rules.yaml#pain-question-trigger");
  const rpeGapTrigger = trigger["rpe_gap_gte"] ?? 2;

  const abnormal: string[] = [];
  if (entry.legs !== undefined && entry.legs !== null && entry.legs >= 4) abnormal.push("legs");
  if (entry.wellness?.fatigue !== undefined && entry.wellness?.fatigue !== null && entry.wellness.fatigue > 3) abnormal.push("fatigue");
  if (entry.wellness?.stress !== undefined && entry.wellness?.stress !== null && entry.wellness.stress > 3) abnormal.push("stress");
  if (entry.wellness?.sleepQuality !== undefined && entry.wellness?.sleepQuality !== null && entry.wellness.sleepQuality < 3) {
    abnormal.push("sleep");
  }

  if (rpeGap !== null && rpeGap >= rpeGapTrigger) {
    fact(interpret, "interpret.effort-gap", "readiness-subtracts-only", { gap: Math.round(rpeGap * 10) / 10 });
  }
  if (abnormal.includes("legs") && entry.legs !== undefined && entry.legs !== null) {
    fact(interpret, "interpret.legs-heavy", "readiness-subtracts-only", { legs: entry.legs, scale: legsScale });
  }
  if (abnormal.includes("sleep") && entry.wellness?.sleepQuality !== undefined && entry.wellness?.sleepQuality !== null) {
    fact(interpret, "interpret.sleep-short", "readiness-subtracts-only", { quality: entry.wellness.sleepQuality });
  }
  if (pain.length > 0) {
    const worst = pain.reduce((max, report) => (report.intensity > max.intensity ? report : max));
    fact(interpret, "interpret.pain-reported", "readiness-subtracts-only", { intensity: worst.intensity, site: worst.site });
    openQuestions.push("pain-trajectory");
  }

  const painReported = pain.length > 0;
  const wantsPainQuestion =
    !painReported && ((entry.legs ?? 0) >= (trigger["legs_gte"] ?? 4) || (rpeGap ?? 0) >= rpeGapTrigger);
  if (wantsPainQuestion) {
    apply("pain-question-trigger", "informed", "a heavy report raises the pain question");
    openQuestions.push("pain-site-and-duration");
  }

  // Readiness subtracts only: never a reason to add volume, intensity or frequency.
  const needsDowngrade = abnormal.length > 0 || pain.some((report) => report.intensity >= 4);
  if (needsDowngrade && tomorrowSession !== undefined && isQuality(tomorrowSession) && adjustTomorrow === undefined) {
    apply("readiness-subtracts-only", "informed", abnormal.length > 0 ? abnormal.join("+") : "pain reported");
    apply("wellness-downgrade-magnitude", "dosed", "downgrade magnitude from wellness.yaml");
    downgrade(
      tomorrow,
      tomorrowSession,
      "readiness-subtracts-only",
      abnormal.length > 0 ? `you reported ${abnormal.join(" and ")}` : "you reported pain",
      "the quality session becomes easy this week",
      false,
    );
    fact(redirect, "redirect.tomorrow-downgraded", "readiness-subtracts-only", { day: tomorrow });
  } else if (adjustTomorrow === undefined && tomorrowSession !== undefined) {
    applyOnce("comment-contract", "informed", "the sentence comes from the comment contract");
    fact(redirect, "redirect.tomorrow-kept", "comment-contract");
  }

  if (acknowledge.length === 0) {
    applyOnce("comment-contract", "informed", "the sentence comes from the comment contract");
    fact(acknowledge, acknowledgeTemplate(entry), "comment-contract");
  }

  // ---------------------------------------------------------------------------------------------
  // Pass 4 - review candidates. They raise an offer; they never edit the plan.
  // ---------------------------------------------------------------------------------------------
  const planTooBig = recordAt(knowledge, "review-triggers.yaml#plan_too_big_thresholds");
  const completionRate = history.completionRate14d;
  const qualityMisses = history.qualityMisses7d ?? 0;
  const tooBig =
    (completionRate !== undefined && completionRate < (planTooBig["completion_rate_lt"] ?? 0.7)) ||
    qualityMisses >= (planTooBig["quality_misses_ge"] ?? 2);

  if (tooBig && flagReview === undefined) {
    apply("plan-too-big", "informed", `completion ${completionRate ?? "unknown"}, quality misses ${qualityMisses}`);
    flagReview = {
      kind: "plan-too-big",
      ruleId: "plan-too-big",
      anchor: ruleOf("plan-too-big").anchor,
      why: "the week is not being completed as written",
      proposals: ["reduce-hard-days", "shorten-sessions", "persona-time-poor-3-days"],
    };
  }

  if (flagReview !== undefined) {
    const maxPrompts = numberAt(knowledge, "review-triggers.yaml#max_prompts_per_week");
    const dwellDays = numberAt(knowledge, "review-triggers.yaml#dwell_days");
    const cooldownDays = numberAt(knowledge, "review-triggers.yaml#cooldown_after_accepted_review_days");
    const prompts = history.promptsThisWeek ?? 0;
    const sinceAccepted = history.daysSinceAcceptedReview ?? null;
    const sinceTrigger = history.daysSinceTrigger?.[flagReview.kind] ?? null;
    const reason =
      prompts >= maxPrompts
        ? `${prompts} review prompts already this week`
        : sinceAccepted !== null && sinceAccepted <= cooldownDays
          ? `a review was accepted ${sinceAccepted} days ago`
          : sinceTrigger !== null && sinceTrigger < dwellDays
            ? `this trigger fired ${sinceTrigger} days ago`
            : null;
    if (reason !== null) {
      apply("suppression-and-dwell", "suppressed", reason);
      suppressed.push(`review:${flagReview.kind}`);
      flagReview = undefined;
    } else {
      fact(redirect, "redirect.review-offered", flagReview.ruleId);
    }
  }

  return finish({
    entry,
    plan,
    today,
    acknowledge,
    interpret,
    redirect,
    numbers,
    suppressed,
    appliedRules,
    openQuestions,
    commentMaxSentences,
    hardStop,
    adjustTomorrow,
    flagReview,
    nudge: nudgeFact,
    silence: false,
    safetyFirst: false,
  });
}

interface Assembly {
  entry: DayEntry;
  plan: PlanVersion;
  today: string;
  acknowledge: FactLine[];
  interpret: FactLine[];
  redirect: FactLine[];
  numbers: Set<number>;
  suppressed: string[];
  appliedRules: AppliedPolicyRule[];
  openQuestions: string[];
  commentMaxSentences: number;
  hardStop: HardStop | undefined;
  adjustTomorrow: MicroAdjustment | undefined;
  flagReview: ReviewFlag | undefined;
  nudge: FactLine | undefined;
  silence: boolean;
  safetyFirst: boolean;
}

/** Trim to the comment contract, order the rules by precedence, and freeze the fact object. */
function finish(input: Assembly): PolicyDecision {
  const lines = [...input.acknowledge, ...input.interpret, ...input.redirect];
  const trimmed = input.silence ? [] : lines.slice(0, Math.max(1, input.commentMaxSentences));
  const acknowledge = trimmed.filter((line) => line.template.startsWith("acknowledge."));
  const interpret = trimmed.filter((line) => line.template.startsWith("interpret."));
  const redirect = trimmed.filter((line) => line.template.startsWith("redirect."));

  const commentFacts: CommentFacts = {
    day: input.entry.day,
    outcome: input.entry.outcome,
    acknowledge,
    interpret,
    redirect,
    allowedNumbers: [...input.numbers].sort((a, b) => a - b),
    tone: {
      register: "coach-to-runner",
      safetyFirst: input.safetyFirst,
      praiseSuppressed: input.safetyFirst,
    },
    ...(input.nudge === undefined ? {} : { nudge: input.nudge }),
    silence: input.silence,
    suppressed: [...input.suppressed],
  };

  const order = (rule: AppliedPolicyRule): number => {
    const group = ruleOf(rule.ruleId).group;
    return ["safety", "missed", "daily", "load", "review"].indexOf(group);
  };

  return {
    commentFacts,
    ...(input.adjustTomorrow === undefined ? {} : { adjustTomorrow: input.adjustTomorrow }),
    ...(input.flagReview === undefined ? {} : { flagReview: input.flagReview }),
    ...(input.hardStop === undefined ? {} : { hardStop: input.hardStop }),
    appliedRules: [...input.appliedRules].sort((a, b) => order(a) - order(b)),
    openQuestions: [...new Set(input.openQuestions)],
  };
}

/**
 * The nearest future day inside the swap window that can carry the missed quality session: a day that is
 * rest or easy today, far enough from every other hard day, and not the day before a long run.
 */
function findLegalSlot(plan: PlanVersion, today: string, swapWindowDays: number, knowledge: KnowledgeBundle): string | undefined {
  const hardGapHours = numberAt(knowledge, "recovery.yaml#hard_day_gap_hours");
  const candidates = plan.sessions
    .filter((session) => session.day > today && gapHours(today, session.day) <= swapWindowDays * 24)
    .filter((session) => session.kind === "rest" || isEasy(session))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  for (const candidate of candidates) {
    const hardDays = plan.sessions.filter((session) => session.day !== candidate.day && isQuality(session));
    const spaced = hardDays.every((session) => gapHours(session.day, candidate.day) >= hardGapHours);
    const longRuns = plan.sessions.filter((session) => session.kind === "long");
    const notBeforeLongRun = longRuns.every((session) => gapHours(session.day, candidate.day) > RULE_TEXT_NUMBERS.longRunAdjacencyHours);
    if (spaced && notBeforeLongRun) return candidate.day;
  }
  return undefined;
}

export type { ReviewFlag, ReviewKind };
