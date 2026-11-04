/**
 * PLACEHOLDER. Phase M1 replaces every one of these with a zod mirror of the matching contract in
 * schemas/json/, and packages/domain/test/fixtures.test.ts proves the mirror by round-tripping
 * eval/contract-fixtures/ - the valid instances must parse, the invalid ones must not.
 *
 * `z.never()` is deliberate: a placeholder that accepts everything would make that test pass while
 * proving nothing, which is the exact failure mode this repository keeps designing gates against.
 */
import { z } from "zod";
import type { DayEntry, Review, Signal, TrainingEvent } from "./entries";
import type { AthleteProfile, PlanDiff, PlanVersion } from "./types";

export const athleteProfileSchema = z.never() as unknown as z.ZodType<AthleteProfile>;
export const dayEntrySchema = z.never() as unknown as z.ZodType<DayEntry>;
export const planVersionSchema = z.never() as unknown as z.ZodType<PlanVersion>;
export const planDiffSchema = z.never() as unknown as z.ZodType<PlanDiff>;
export const reviewSchema = z.never() as unknown as z.ZodType<Review>;
export const signalSchema = z.never() as unknown as z.ZodType<Signal>;
export const eventSchema = z.never() as unknown as z.ZodType<TrainingEvent>;
