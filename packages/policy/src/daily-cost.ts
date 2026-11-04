/**
 * What a day's choice cost, as a fact object.
 *
 * The review sheet already says what an option gives up; this is the same sentence for the daily case, where the
 * runner picked an alternate or cut a session short. The judgement is policy's, the words are the narrator's, and
 * the only number here comes from the corpus: `session-substitution.yaml#equivalence_max_drop_pct` is how much of
 * the intended stimulus a substitute may lose, and it is a guess (confidence: low) - which is why the copy says
 * "up to" rather than promising a measurement.
 *
 * No cost is invented: a day with no prescription has nothing to give up, an extra session is not a loss, and a
 * day done as prescribed costs nothing. A trade-off line that fires on a good day teaches the runner to stop
 * reading it.
 */
import type { DayEntry, Session } from "@training-planner/domain";
import type { KnowledgeBundle } from "@training-planner/knowledge";

/** The daily trade-off vocabulary. Keys are nouns; the sentence lives in packages/i18n's catalogue. */
export type DailyCostKey = "alternate-quality" | "alternate-volume" | "partial-quality";

export interface DailyCost {
  key: DailyCostKey;
  /** Data only, never prose: the narrator fills the template and the guardrails re-check the numbers. */
  slots: Record<string, string | number>;
}

export interface DailyCostInput {
  /** The prescription for the day; a day outside the plan has no cost to state. */
  session: Session;
  entry: DayEntry;
  knowledge: KnowledgeBundle;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** What the day contributed, by the same rule the worker closes a day with. */
function doneKmOf(session: Session, entry: DayEntry): number {
  const reported = entry.completedKm;
  if (typeof reported === "number" && Number.isFinite(reported) && reported >= 0) return reported;
  return entry.outcome === "completed" ? (session.distanceKm ?? 0) : 0;
}

export function dailyCostOf(input: DailyCostInput): DailyCost | null {
  const { session, entry, knowledge } = input;
  if (session.restDay) return null;
  const planned = session.distanceKm ?? 0;
  const done = doneKmOf(session, entry);
  const quality = session.hardDay === true;

  if (entry.sessionTaken === "alternate") {
    if (quality) {
      // A substitute for a quality session is the one case the corpus can put a number on: the equivalence cap.
      const pct = knowledge.number("session-substitution.yaml#equivalence_max_drop_pct");
      return { key: "alternate-quality", slots: { kind: session.kind, pct } };
    }
    const lost = round1(planned - done);
    // An alternate that covered the distance gave up nothing measurable, and saying otherwise would be invented.
    return lost > 0 ? { key: "alternate-volume", slots: { km: lost } } : null;
  }

  if (entry.outcome === "partial" && quality) {
    return { key: "partial-quality", slots: { kind: session.kind, planned: round1(planned), done: round1(done) } };
  }

  // `extra` is more work, not a trade-off; `none` on a day with no quality is a lost easy day the comment already
  // names. Neither gets a cost line here.
  return null;
}
