/**
 * The coach's reference memory: short passages from this repository's own research and rules.
 *
 * A reference is **guidance for language**, not authority over numbers. Every passage cites a real path and a heading
 * that exists in that file, so a claim can be audited against the repository rather than trusted because a model said it.
 * Safety passages are tagged `safety` and always outrank training passages in selection.
 */
export type ReferenceTier = "safety" | "training" | "tone";

export interface CoachReference {
  id: string;
  title: string;
  tags: readonly string[];
  text: string;
  tier: ReferenceTier;
  sourcePath: string;
  sourceHeading: string;
  reason?: string;
}

export const COACH_REFERENCES: readonly CoachReference[] = [
  {
    id: "safety-subtract-only",
    title: "Safety can only subtract",
    tags: ["safety", "pain", "load"],
    text: "A safety rule may remove or downgrade a session; it may never add distance, duration or intensity. When a hard stop fires, the session is removed and no substitute workout is proposed.",
    tier: "safety",
    sourcePath: "knowledge/heuristics/safety-hard-stops.yaml",
    sourceHeading: "subtract_only: true",
  },
  {
    id: "safety-pain-triage",
    title: "Pain that changes gait or wakes you is a stop",
    tags: ["safety", "pain", "injury"],
    text: "Pain that changes gait, wakes the runner at night, or comes with chest symptoms is a hard stop, not a training problem to program around; the comment ends with a clinician referral.",
    tier: "safety",
    sourcePath: "knowledge/heuristics/safety-hard-stops.yaml",
    sourceHeading: "no-diet-or-weight-language",
  },
  {
    id: "safety-no-diet-language",
    title: "No diet or weight language",
    tags: ["safety", "tone", "health"],
    text: "Neither the safety layer nor the narrator may emit energy-availability guidance, targets or estimates; weight and calorie prescriptions are outside this product.",
    tier: "safety",
    sourcePath: "knowledge/heuristics/safety-hard-stops.yaml",
    sourceHeading: "no-diet-or-weight-language",
  },
  {
    id: "review-freeze-window",
    title: "The freeze window protects the near future",
    tags: ["review", "freeze", "plan"],
    text: "A review may only change days after the freeze window; today and the next days are already in motion, and a plan that rewrites them is a plan the runner cannot follow.",
    tier: "training",
    sourcePath: "knowledge/heuristics/review-triggers.yaml",
    sourceHeading: "knobs:",
  },
  {
    id: "review-two-changes",
    title: "At most two changes, prefer one",
    tags: ["review", "load", "plan"],
    text: "A review proposes at most two changes and prefers one. Every change carries its reason, the signal that triggered it and its expected cost, and no-change is a valid decision.",
    tier: "training",
    sourcePath: "docs/engine/review-trigger-policy.md",
    sourceHeading: "## 3. Review workflow (in order)",
  },
  {
    id: "review-user-trigger",
    title: "A runner asking for a review is first-class",
    tags: ["review", "user", "autonomy"],
    text: "A user-triggered review is a first-class path, not an emergency hatch: the runner may ask for a re-plan, and the system answers with the same gates as a system-triggered review.",
    tier: "training",
    sourcePath: "docs/engine/review-trigger-policy.md",
    sourceHeading: "### 1.1 User-triggered (first-class, not an emergency hatch)",
  },
  {
    id: "review-arbitration",
    title: "Safety outranks preference",
    tags: ["review", "safety", "preference"],
    text: "When several triggers fire, safety outranks master constraints, which outrank user preference; a preference may shape the plan only where no safety rule applies.",
    tier: "safety",
    sourcePath: "docs/engine/review-trigger-policy.md",
    sourceHeading: "## 2. Arbitration: when several triggers fire",
  },
  {
    id: "tone-acknowledge-interpret-redirect",
    title: "Acknowledge, interpret, redirect",
    tags: ["tone", "comment", "coaching"],
    text: "Every comment acknowledges what the runner did, interprets it against the plan, then redirects to the next action; it never scolds and never diagnoses.",
    tier: "tone",
    sourcePath: "docs/ux/feedback-microcopy.md",
    sourceHeading: "## The AIR contract (Acknowledge · Interpret · Redirect)",
  },
  {
    id: "tone-never-say",
    title: "Never say never",
    tags: ["tone", "comment", "humility"],
    text: "The narrator never claims a guaranteed outcome, a diagnosis or a fixed target; health data is reported as the runner gave it, with the uncertainty left visible.",
    tier: "tone",
    sourcePath: "docs/ux/feedback-microcopy.md",
    sourceHeading: "## Never say",
  },
];
