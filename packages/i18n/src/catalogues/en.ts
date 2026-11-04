import type { Messages } from "../types";

/**
 * English catalogue. Copy rules: docs/ux/feedback-microcopy.md - second person, calm coach, no emoji, one
 * idea per sentence, at most one exclamation mark in the whole catalogue (there are none).
 */
export const en: Messages = {
  comment: {
    "acknowledge.completed": "{km} km logged today.",
    "acknowledge.partial": "Today is logged as partial, which is a real answer and not a zero.",
    "acknowledge.alternate": "You took the alternate, so the work counts.",
    "acknowledge.rest": "Rest day taken as planned.",
    "acknowledge.skipped": "The {kind} session was skipped.",
    "interpret.effort-gap": "Effort came in {gap} points above the plan.",
    "interpret.legs-heavy": "Legs at {legs} of {scale} is the reason tomorrow is easier.",
    "interpret.sleep-short": "Short sleep is one of the reasons tomorrow is easier.",
    "interpret.extra-subtracts": "Extra work counts against the next quality day, not for it.",
    "interpret.pain-reported": "Pain at {site}, {intensity} of {scale}, is what tomorrow's change answers.",
    "redirect.tomorrow-kept": "Tomorrow stays as written.",
    "redirect.tomorrow-downgraded": "Tomorrow is easier than written, and the card says what changed.",
    "redirect.tomorrow-swapped": "The quality session moves to {weekday}.",
    "redirect.safety-instruction": "{instruction}",
    "redirect.review-offered": "The shape of this block is worth a look, and I can show you the options.",
    "redirect.nudge-unlogged": "No entry for this day yet, and effort plus legs is enough.",
  },
  reason: {
    "missed-quality-moved": "the quality session moved to the nearest legal slot ({weekday})",
    "extra-activity-guard": "extra work too close to a quality day",
    "readiness-downgrade": "your report was heavy today",
    "illness-hold": "you reported illness",
    "pain-hold": "pain is escalating",
  },
  cost: {
    "easy-day-becomes-quality": "the easy day becomes the quality day",
    "quality-becomes-easy": "the quality session becomes easy this week",
    "no-intensity-this-week": "no intensity for the next week",
  },
  stop: {
    "chest-urgent": "Stop training and seek urgent medical assessment for chest symptoms.",
    "illness-hold":
      "No training today. Rest until you are 48 hours symptom-free without medication, then start easy.",
    "bone-referral": "Stop running and get this pain assessed by a clinician before the next session.",
    "pain-hold": "Do not run through this pain today; it needs a clinician's opinion before the next session.",
  },
  explain: {
    "explain.summary": "{sessions} sessions over {weeks} weeks, {km} km in total.",
    "explain.week-one": "Week of {weekday}: {km} km, {hard} hard session.",
    "explain.week-many": "Week of {weekday}: {km} km, {hard} hard sessions.",
    "explain.partial": "The first week is partial: {km} km over {days} days, which is {rate} km at a full week's rate.",
    "explain.peak": "Peak week {km} km, longest run {long} km.",
  },
  weekday: { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" },
  kind: {
    rest: "rest",
    recovery: "recovery",
    easy: "easy",
    strides: "strides",
    long: "long run",
    hills: "hills",
    tempo: "tempo",
    vo2max: "VO2max",
    mp: "marathon-pace",
    "cross-training": "cross-training",
    strength: "strength",
    test: "test",
    race: "race",
  },
  label: {
    changedBecause: "changed because",
    gaveUp: "trade-off:",
    nudge: "Log today",
  },
};
