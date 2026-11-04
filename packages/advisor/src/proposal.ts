/**
 * The proposal shape the model must return, and the vocabulary it must speak.
 *
 * This is a zod schema, not prose: a proposal that does not parse is not "almost a proposal", it is a failed call,
 * and the validator records it as such. `strict()` matters - a model that adds a field the product does not read is
 * a model whose output nobody can audit.
 */
import { z } from "zod";

export const ADVISOR_DECISIONS = ["no-change", "propose-change"] as const;

/** The reason vocabulary. A new reason is a deliberate addition here and in the caller, never a model invention. */
export const ADVISOR_REASON_CODES = [
  "adherence-low",
  "pain-rising",
  "load-high",
  "goal-changed",
  "preference-changed",
  "phase-boundary",
  "no-action-needed",
] as const;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const advisorChangeSchema = z
  .object({
    /** The future day that changes. The validator re-checks that it is after today and outside the freeze window. */
    day: isoDay,
    /** The session kind after the change. Must be a kind the plan already uses, so the model cannot invent one. */
    kind: z.string().min(1),
    /** The prescription before the change, as kilometres. The validator requires it to equal the plan's value. */
    fromKm: z.number().nonnegative(),
    /** The prescription after the change. */
    toKm: z.number().nonnegative(),
    /** What the change costs, from the caller's cost vocabulary (packages/policy's ADJUST_COST_KEYS). */
    costKey: z.string().min(1),
    costSlots: z.record(z.union([z.string(), z.number()])),
  })
  .strict();

export const advisorProposalSchema = z
  .object({
    decision: z.enum(ADVISOR_DECISIONS),
    reasonCode: z.string().min(1),
    /** The facts the model says it used. Every number here must exist in the request's context. */
    facts: z.array(z.object({ key: z.string().min(1), value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }).strict()).max(20),
    proposedChanges: z.array(advisorChangeSchema).max(2),
    confidence: z.enum(["low", "medium", "high"]),
    /** True when the model thinks a human or a clinician should look before the runner decides. */
    needsHuman: z.boolean(),
  })
  .strict();

export type AdvisorProposal = z.infer<typeof advisorProposalSchema>;
export type AdvisorChange = z.infer<typeof advisorChangeSchema>;
