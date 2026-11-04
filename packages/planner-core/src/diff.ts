/**
 * Plan diffs (ADR-0004, ADR-0005).
 *
 * Two rules make this function boring on purpose: it may not touch a day at or before the base
 * version's generation day, and it may not propose more than two changes. Boring is the feature - a
 * review that can rewrite history destroys every derived metric, and a review that proposes eight
 * changes is a rewrite wearing a review's clothes.
 */
import type { DiffChange, DiffChangeKind, PlanDiff, PlanVersion, Session } from "@training-planner/domain";
import type { DiffOptions } from "./types";
import { uuidFrom } from "./uuid";

const SUBTRACTIVE: DiffChangeKind[] = ["session.removed", "session.downgraded", "distance.reduced", "pace.band-widened", "day.became-rest"];

function summarize(session: Session): string {
  return session.summaryText;
}

function kindOfChange(before: Session | undefined, after: Session | undefined): DiffChangeKind | null {
  if (!before && after) return "session.added";
  if (before && !after) return "session.removed";
  if (!before || !after) return null;
  if (after.kind === "rest" && before.kind !== "rest") return "day.became-rest";
  if (before.kind !== after.kind) {
    const harder = ["easy", "tempo", "vo2max", "race"];
    const beforeRank = harder.indexOf(before.kind);
    const afterRank = harder.indexOf(after.kind);
    if (afterRank >= 0 && beforeRank > afterRank) return "session.downgraded";
    return "structure.changed";
  }
  const beforeKm = before.distanceKm ?? 0;
  const afterKm = after.distanceKm ?? 0;
  if (Math.abs(afterKm - beforeKm) > 0.05) return afterKm < beforeKm ? "distance.reduced" : "distance.changed";
  return null;
}

export function diffPlans(from: PlanVersion, to: PlanVersion, options: DiffOptions): PlanDiff {
  const frozenUntil = from.generatedAtDay;
  const maxChanges = options.maxChanges ?? 2;
  const before = new Map(from.sessions.map((session) => [session.day, session]));
  const after = new Map(to.sessions.map((session) => [session.day, session]));
  const days = [...new Set([...before.keys(), ...after.keys()])].sort();

  const changes: DiffChange[] = [];
  for (const day of days) {
    if (day <= frozenUntil) continue;
    const kind = kindOfChange(before.get(day), after.get(day));
    if (!kind) continue;
    if (options.isSafety === true && !SUBTRACTIVE.includes(kind)) continue;
    const beforeSession = before.get(day);
    const afterSession = after.get(day);
    changes.push({
      kind,
      day,
      beforeSummary: beforeSession ? summarize(beforeSession) : "no session",
      afterSummary: afterSession ? summarize(afterSession) : "no session",
      reason: options.reason ?? "review change",
      signalId: options.signalIds?.[0] ?? "review",
      expectedCost: options.expectedCost ?? "the changed day no longer matches the original block",
      knobsUsed: options.knobsUsed ?? [],
      isSafety: options.isSafety ?? false,
    });
  }

  const limited = changes.slice(0, maxChanges);
  return {
    schemaVersion: 1,
    diffId: uuidFrom({ from: from.versionId, to: to.versionId, options }),
    userId: to.userId,
    fromVersionId: from.versionId,
    toVersionId: to.versionId,
    createdAtDay: options.createdAtDay,
    changes: limited,
    changeCountWithinLimit: changes.length <= maxChanges,
    knowledgeHash: options.knowledgeHash,
  };
}

