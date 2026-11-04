/**
 * The golden-fixture format: the interface between the fixtures in this directory and the runner in
 * packages/planner-core/test/golden.test.ts.
 *
 * Why a schema at all, when the README already shows the shape: a fixture that is *almost* right is the
 * most expensive kind. It generates a plan, the plan looks plausible, and the expectation that should
 * have caught a regression was silently ignored because one key was misspelled. Parsing the fixture with
 * zod turns that into a red test with a path in the message.
 *
 * The two shape exports at the bottom are compile-time proof that this format and the frozen planner
 * inputs (packages/planner-core/src/types.ts) have not drifted apart. If either changes, this file stops
 * compiling - which is the cheapest possible place to find out.
 */
import { z } from "zod";
import type { Evidence, PlanState } from "@training-planner/planner-core";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const contentHash = z.string().regex(/^sha256:[0-9a-f]{64}$/);

export const expectationSchema = z.object({
  /** One session per calendar day, so this equals horizonDays for a complete plan. */
  sessionCount: z.number().int().positive(),
  firstDay: isoDay,
  lastDay: isoDay,
  restDaysMin: z.number().int().min(0),
  hardDaysMaxPerWeek: z.number().int().min(0).max(3),
  minHoursBetweenHardDays: z.number().min(0),
  weeklyIncrementPctMax: z.number().positive(),
  longRunMaxKm: z.number().positive(),
  /**
   * Optional: week 1 as a fraction of the runner's recent median volume, both as 7-day-normalised rates.
   * The first week of a block is reduced (workout-dosage.yaml#first_week_of_phase_reduction), so this is
   * below 1 for a fixture whose plan starts on a phase boundary. Comparing week 1 to week 2 instead would
   * measure the calendar: a plan that begins mid-week normalises differently, and two consecutive reduced
   * weeks can make week 2 look smaller than week 1 while both are reduced.
   */
  firstWeekVsRecentMax: z.number().positive().max(1).optional(),
  /**
   * Optional: the first quality kinds in the order the plan prescribes them. This is the assertion the corpus
   * claimed existed ("the novice golden plan asserts mustNotContain") and did not: the format had no way to say it,
   * so the novice's forbidden kinds were prose. It encodes the sequencing rule of
   * knowledge/plan-construction/quality-sequencing.md.
   */
  qualityKinds: z.array(z.string()).min(1).optional(),
  /**
   * Optional: the wall time the plan prescribes for named days. This is the assertion for
   * pace-bands.yaml#elapsed_estimate: a duration is distance times a pace the plan already prescribes, never a
   * second pace invented for the display, and a runner with no pace evidence gets no duration at all. Rest days
   * are not listed because they have no time.
   */
  sessionDurations: z
    .array(z.object({ day: isoDay, durationMin: z.number().int().positive() }))
    .min(1)
    .optional(),
  invariantsHold: z.boolean(),
  /** Null until a coach has read the plan; then it is the frozen hash and a change is a failure. */
  planHash: contentHash.nullable(),
});

export const fixtureSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().min(1),
  input: z.object({
    /** Validated with athleteProfileSchema by the runner, not here: this file must not own two contracts. */
    profile: z.record(z.unknown()),
    evidence: z.object({
      recentWeeklyKm: z.array(z.number().nonnegative()).min(1),
      layoffDays: z.number().int().min(0).optional(),
      baselinePaceSecPerKm: z.number().positive().nullable().optional(),
      baselineConfidence: z.enum(["low", "medium", "high"]).optional(),
    }),
    state: z.object({
      planStartDay: isoDay,
      horizonDays: z.number().int().min(1).max(740),
      completedDays: z.array(isoDay).optional(),
    }),
    clock: z.object({ today: isoDay }),
    seed: z.string().min(1),
  }),
  expect: expectationSchema,
});

export type GoldenExpectation = z.infer<typeof expectationSchema>;
export type GoldenFixture = z.infer<typeof fixtureSchema>;

/** Read by the runner, so "eight fixtures" is a number a test can assert rather than a sentence. */
export const GOLDEN_FIXTURE_COUNT = 9;

/** Compile-time drift checks against the frozen planner inputs. */
export const evidenceShape: z.ZodType<Evidence> = fixtureSchema.shape.input.shape.evidence;
export const stateShape: z.ZodType<PlanState> = fixtureSchema.shape.input.shape.state;
