import { COACH_REFERENCES } from "./corpus";
import type { CoachReference } from "./corpus";

export interface CoachReferenceContext {
  /** The review is considering a change; comment/narrative context always includes tone. */
  kind: "review" | "comment" | "narrative";
  pain: boolean;
  missedSessions: number;
  highRpe: boolean;
  reviewOptionsCount: number;
}

/**
 * Select at most four references, safety first, deterministically.
 *
 * The context is a fact object, not free text: pain pulls safety/pain passages, missed sessions pull adherence/review
 * passages, a high RPE pulls load passages, and a comment or narrative always carries the tone passages. Ties break on
 * tier (safety before training before tone) then id, so two identical contexts select the same list.
 */
export function selectCoachReferences(context: CoachReferenceContext): CoachReference[] {
  const wanted = new Set<string>();
  if (context.kind === "comment" || context.kind === "narrative") wanted.add("tone");
  if (context.pain) {
    wanted.add("safety");
    wanted.add("pain");
  }
  if (context.missedSessions > 0) {
    wanted.add("review");
    wanted.add("load");
  }
  if (context.highRpe) wanted.add("load");
  if (context.reviewOptionsCount > 0) wanted.add("review");
  if (wanted.size === 0) wanted.add("review");

  const tierRank: Record<CoachReference["tier"], number> = { safety: 0, training: 1, tone: 2 };
  const scored = COACH_REFERENCES.map((reference) => {
    const matches = reference.tags.filter((tag) => wanted.has(tag));
    return { reference, score: matches.length, matched: matches };
  })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      const tier = tierRank[left.reference.tier] - tierRank[right.reference.tier];
      if (tier !== 0) return tier;
      if (left.score !== right.score) return right.score - left.score;
      return left.reference.id < right.reference.id ? -1 : 1;
    })
    .slice(0, 4);

  return scored.map((candidate) => ({ ...candidate.reference, reason: `matched ${candidate.matched.join(", ")}` }));
}
