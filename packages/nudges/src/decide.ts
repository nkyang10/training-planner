/**
 * When may a prompt be delivered?
 *
 * Five gates, in the order they matter, and each one is a reason a runner would recognise:
 *  1. **nothing to ask** - no plan, or today is answered, or there is no gap at all;
 *  2. **one shared budget** - every kind of prompt spends it, so a review prompt cannot arrive on top of a nudge;
 *  3. **the silence ladder** - an unanswered gap is asked about on days 1, 3 and 7, and never twice in between;
 *  4. **quiet hours** - a hard stop, not a preference: no prompt inside the window, and none after it opens;
 *  5. **the runner's own hour** - the median local logging hour once there is enough history, else the default.
 *
 * It writes nothing and sends nothing. Delivery is the caller's; the decision carries its own evidence.
 */
import { addDays, daysBetween } from "@training-planner/planner-core";
import type { NudgeDecision, NudgeInput, NudgeReason } from "./types";

const MINUTES_PER_HOUR = 60;

export function decideNudge(input: NudgeInput): NudgeDecision {
  const { knowledge, today } = input;
  const quietStart = knowledge.number("feedback-prompts.yaml#quiet_hours_start");
  const quietEnd = knowledge.number("feedback-prompts.yaml#quiet_hours_end");
  const perDay = knowledge.number("feedback-prompts.yaml#prompt_budget_per_day");
  const perWeek = knowledge.number("feedback-prompts.yaml#prompt_budget_per_week");
  const ladder = ladderDays(input);
  const nudgeHour = nudgeHourOf(input);
  const usedToday = input.delivered.filter((prompt) => prompt.day === today).length;
  const weekStart = addDays(today, -6);
  const usedThisWeek = input.delivered.filter((prompt) => prompt.day >= weekStart && prompt.day <= today).length;
  const budget = { usedToday, usedThisWeek, perDay, perWeek };
  const evidence = {
    nudgeHour: nudgeHour.hour,
    source: nudgeHour.source,
    samples: nudgeHour.samples,
    quietHours: { start: quietStart, end: quietEnd },
    ladderStep: null as number | null,
  };
  const refuse = (reason: NudgeReason): NudgeDecision => ({ prompt: null, reason, evidence, budget });

  // 1. Nothing to ask about.
  if (input.plan === null) return refuse("no-plan");
  if (today < input.plan.firstDay || today > input.plan.lastDay) return refuse("no-plan");
  const answered = new Set(input.entries.map((entry) => entry.day));
  const target = targetDay(input, answered);
  if (target === null) return refuse("already-answered");
  if (target.ladderStep !== null && !ladder.includes(target.ladderStep)) {
    evidence.ladderStep = target.ladderStep;
    return refuse("silence-ladder");
  }
  evidence.ladderStep = target.ladderStep;

  // 2. One shared budget, spent by every kind of prompt.
  if (usedToday >= perDay || usedThisWeek >= perWeek) return refuse("budget");

  // 3. A nudge for today that was already delivered is not a second nudge.
  if (input.delivered.some((prompt) => prompt.kind === "nudge" && prompt.day === today)) return refuse("delivered");

  // 4. Quiet hours: never inside the window, and not after it has opened.
  const inQuiet = quietStart > quietEnd
    ? nudgeHour.hour >= quietStart || nudgeHour.hour < quietEnd
    : nudgeHour.hour >= quietStart && nudgeHour.hour < quietEnd;
  const atMinute = (inQuiet ? quietEnd : nudgeHour.hour) * MINUTES_PER_HOUR;
  if (input.nowMinute >= quietStart * MINUTES_PER_HOUR) return refuse("quiet-hours");

  // 5. Deliver.
  return {
    prompt: { kind: "nudge", atMinute, forDay: target.day },
    reason: "ok",
    evidence,
    budget,
  };
}

/** The day the prompt is about: today when it is unlogged, else the newest gap that the ladder still asks about. */
function targetDay(input: NudgeInput, answered: Set<string>): { day: string; ladderStep: number | null } | null {
  if (!answered.has(input.today)) return { day: input.today, ladderStep: null };
  const gaps: string[] = [];
  for (let day = input.plan?.firstDay ?? input.today; day < input.today; day = addDays(day, 1)) {
    if (!answered.has(day)) gaps.push(day);
  }
  const newest = gaps[gaps.length - 1];
  if (newest === undefined) return null;
  return { day: newest, ladderStep: daysBetween(newest, input.today) };
}

function ladderDays(input: NudgeInput): number[] {
  const knob = input.knowledge.knob("feedback-prompts.yaml#silence_ladder_days");
  if (!Array.isArray(knob.value)) throw new Error("feedback-prompts.yaml#silence_ladder_days is not a list");
  const days = knob.value.filter((value): value is number => typeof value === "number");
  if (days.length !== knob.value.length) throw new Error("feedback-prompts.yaml#silence_ladder_days is not all numbers");
  return days;
}

/**
 * The runner's own hour, once there is enough history to call it a habit. The median of an even list takes the
 * lower middle value: deterministic, and never an invented average of two habits.
 */
function nudgeHourOf(input: NudgeInput): { hour: number; source: "behaviour" | "default"; samples: number } {
  const fallback = input.knowledge.number("feedback-prompts.yaml#nudge_hour_default");
  const lookback = input.knowledge.number("feedback-prompts.yaml#nudge_hour_lookback_days");
  const minimum = input.knowledge.number("feedback-prompts.yaml#nudge_hour_min_samples");
  const since = addDays(input.today, -lookback);
  const hours = input.entries
    .filter((entry) => entry.day >= since && entry.day <= input.today)
    .map((entry) => input.loggingHours[input.entries.indexOf(entry)])
    .filter((hour): hour is number => typeof hour === "number" && hour >= 0 && hour <= 23)
    .sort((a, b) => a - b);
  if (hours.length < minimum) return { hour: fallback, source: "default", samples: hours.length };
  const middle = hours[Math.floor((hours.length - 1) / 2)] ?? fallback;
  return { hour: middle, source: "behaviour", samples: hours.length };
}
