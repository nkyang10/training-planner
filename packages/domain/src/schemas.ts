// GENERATED FILE - do not edit by hand.
// Source: schemas/json/*.schema.json. Regenerate with `pnpm gen:domain`.
// The fixture round-trip test in packages/domain/test proves this output against eval/contract-fixtures.
import { z } from "zod";

/** A required property with no declared shape: presence is the requirement, not a type. */
const requiredAny = z.custom<unknown>((value) => value !== undefined, { message: "required" });

/** if/then from JSON Schema: the consequence is only required when the condition matches. */
const whenThen = <T extends z.ZodTypeAny>(base: T, cond: z.ZodTypeAny, consequence: z.ZodTypeAny, message: string): T =>
  base.superRefine((value, ctx) => {
    if (!cond.safeParse(value).success) return;
    if (!consequence.safeParse(value).success) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  }) as unknown as T;

export const athleteProfileSchema = z.object({
    "userId": z.string().uuid(),
    "revision": z.number().int().min(1),
    "displayName": z.string().max(120).optional(),
    "age": z.number().min(12).max(110).optional(),
    "sex": z.union([z.literal("female"), z.literal("male"), z.literal("intersex"), z.literal("unspecified"), z.null()]).optional(),
    "background": z.object({
    "yearsRunning": z.number().min(0).max(70).optional(),
    "currentWeeklyKm": z.number().min(0).max(250).optional(),
    "currentWeeklySessions": z.number().int().min(0).max(14).optional(),
    "longestRecentLongRunKm": z.number().min(0).max(160).nullable().optional(),
    "consecutiveWeeksConsistent": z.number().int().min(0).max(520).nullable().optional(),
    "recentRaceEvidence": z.array(z.object({
    "date": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "distanceKm": z.number().max(350).gt(0),
    "durationSec": z.number().int().min(1),
    "surface": z.union([z.literal("road"), z.literal("track"), z.literal("trail"), z.literal("treadmill"), z.literal("mixed")]).optional(),
    "conditionsNote": z.string().max(280).optional(),
    "certified": z.boolean().optional(),
    "expiresAt": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).strict()).optional(),
    "priorStructuredTraining": z.boolean().optional(),
    "runningHistoryNote": z.string().max(2000).optional(),
  }).strict().optional(),
    "availability": z.object({
    "days": z.array(z.union([z.literal("Mon"), z.literal("Tue"), z.literal("Wed"), z.literal("Thu"), z.literal("Fri"), z.literal("Sat"), z.literal("Sun")])).min(1).max(7),
    "sessionBudgetMin": z.object({}).passthrough().optional(),
    "hardDaysAllowed": z.number().int().min(0).max(2).optional(),
    "nonNegotiableDays": z.array(z.union([z.literal("Mon"), z.literal("Tue"), z.literal("Wed"), z.literal("Thu"), z.literal("Fri"), z.literal("Sat"), z.literal("Sun")])).max(2).optional(),
    "preferredLongRunDay": z.union([z.literal("Mon"), z.literal("Tue"), z.literal("Wed"), z.literal("Thu"), z.literal("Fri"), z.literal("Sat"), z.literal("Sun")]).optional(),
    "knownConflicts": z.array(z.object({
    "date": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "toDate": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    "canTrain": z.boolean().optional(),
    "reason": z.union([z.literal("work"), z.literal("family"), z.literal("travel"), z.literal("illness"), z.literal("injury"), z.literal("holiday"), z.literal("other")]).optional(),
    "travelZones": z.array(z.string()).max(2).optional(),
  }).strict()).optional(),
  }).strict(),
    "goal": z.object({
    "type": z.union([z.literal("finish"), z.literal("time"), z.literal("experience"), z.literal("fitness-maintenance"), z.literal("return-to-running")]),
    "event": z.object({
    "name": z.string().max(120).optional(),
    "date": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    "distanceKm": z.number().max(350).gt(0).optional(),
    "priority": z.union([z.literal("A"), z.literal("B"), z.literal("C")]).optional(),
    "terrain": z.union([z.literal("road"), z.literal("track"), z.literal("trail"), z.literal("mixed"), z.literal("treadmill")]).optional(),
    "elevationGainM": z.number().min(0).nullable().optional(),
    "expectedConditions": z.string().max(280).optional(),
  }).strict().nullable().optional(),
    "targetStatement": z.string().max(200).optional(),
    "outcomeStatement": z.string().max(400).optional(),
    "secondaryEvents": z.array(z.object({}).passthrough()).max(4).optional(),
    "flexibility": z.union([z.literal("fixed"), z.literal("date-flexible"), z.literal("distance-flexible"), z.literal("both-flexible")]).optional(),
    "planStyle": z.union([z.literal("structured"), z.literal("flexible")]).optional(),
    "riskAppetite": z.union([z.literal("conservative"), z.literal("moderate"), z.literal("aggressive")]).optional(),
  }).strict(),
    "health": z.object({
    "flags": z.array(z.union([z.literal("cardiac-history"), z.literal("hypertension"), z.literal("asthma"), z.literal("diabetes"), z.literal("anaemia"), z.literal("thyroid"), z.literal("pregnant"), z.literal("postpartum"), z.literal("breastfeeding"), z.literal("eating-disorder-history"), z.literal("bone-stress-history"), z.literal("menstrual-irregularity"), z.literal("other")])).optional(),
    "injuryHistory": z.array(z.object({
    "site": z.string().optional(),
    "year": z.number().int().optional(),
    "resolved": z.boolean().optional(),
    "loadSensitive": z.boolean().optional(),
  }).strict()).optional(),
    "clinicianClearance": z.boolean().nullable().optional(),
    "clinicianClearanceDate": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    "pregnancyPostpartum": z.union([z.literal("none"), z.literal("pregnant"), z.literal("postpartum"), z.literal("breastfeeding"), z.null()]).optional(),
    "smoker": z.boolean().nullable().optional(),
    "heatExposureDaily": z.boolean().optional(),
    "altitudeResidence": z.union([z.literal("low"), z.literal("moderate"), z.literal("high")]).optional(),
  }).strict(),
    "measurement": z.object({
    "hrMax": z.number().int().min(100).max(230).nullable().optional(),
    "restingHr": z.number().int().min(25).max(120).nullable().optional(),
    "lactateThresholdHr": z.number().int().min(100).max(220).nullable().optional(),
    "lactateThresholdPaceSecPerKm": z.number().min(100).max(900).nullable().optional(),
    "fieldTest": z.object({}).passthrough().nullable().optional(),
    "method": z.union([z.literal("lab"), z.literal("field-test"), z.literal("derived"), z.literal("derivable-only"), z.literal("none")]).optional(),
  }).strict().optional(),
    "preferences": z.object({
    "units": z.union([z.literal("metric"), z.literal("imperial")]),
    "locale": z.union([z.literal("en"), z.literal("zh-Hant")]),
    "timezone": z.string(),
    "dayStartHour": z.number().int().min(0).max(11).optional(),
    "usesHeartRate": z.boolean().optional(),
    "usesPower": z.boolean().optional(),
    "aiNarratorEnabled": z.boolean().optional(),
    "nudgesEnabled": z.boolean().optional(),
    "nudgeWallTime": z.string().regex(new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$")).optional(),
    "weeklySummaryDay": z.union([z.literal("Mon"), z.literal("Tue"), z.literal("Wed"), z.literal("Thu"), z.literal("Fri"), z.literal("Sat"), z.literal("Sun")]).optional(),
    "preferredSessionTypes": z.array(z.string()).optional(),
    "dislikes": z.array(z.string()).optional(),
  }).strict(),
    "metadata": z.object({
    "createdAt": z.string().datetime({ offset: true }).optional(),
    "updatedAt": z.string().datetime({ offset: true }).optional(),
    "onboardingComplete": z.boolean().optional(),
    "consentIds": z.array(z.string()).optional(),
  }).strict().optional(),
  }).strict();

export const dayEntrySchema = whenThen(whenThen(whenThen(whenThen(whenThen(whenThen(z.object({
    "entryId": z.string().uuid().optional(),
    "userId": z.string().uuid().optional(),
    "day": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "revision": z.number().int().min(1),
    "supersededBy": z.string().uuid().nullable().optional(),
    "correctedFromRevision": z.number().int().min(1).nullable().optional(),
    "correctionReason": z.string().max(280).nullable().optional(),
    "tzAtEvent": z.string(),
    "clientSubmittedAt": z.string().datetime({ offset: true }).nullable().optional(),
    "serverReceivedAt": z.string().datetime({ offset: true }).nullable().optional(),
    "idempotencyKey": z.string().min(8).max(128).optional(),
    "outcome": z.union([z.literal("rest"), z.literal("completed"), z.literal("partial"), z.literal("skipped"), z.literal("missed")]),
    "sessionTaken": z.union([z.literal("as-prescribed"), z.literal("alternate"), z.literal("extra"), z.literal("partial"), z.literal("none")]).optional(),
    "outcomeDetail": z.union([z.literal("illness"), z.literal("travel"), z.literal("work"), z.literal("family"), z.literal("sleep"), z.literal("motivation"), z.literal("pain"), z.literal("weather"), z.literal("equipment"), z.literal("social"), z.literal("just-didnt"), z.literal("other"), z.null()]).optional(),
    "completedKm": z.number().min(0).max(250).nullable().optional(),
    "durationMin": z.number().min(0).max(1500).nullable().optional(),
    "rpe": z.number().int().min(1).max(10).nullable().optional(),
    "legs": z.number().int().min(1).max(5).nullable().optional(),
    "mood": z.number().int().min(1).max(5).nullable().optional(),
    "wellness": z.object({
    "sleepHours": z.number().min(0).max(16).nullable().optional(),
    "sleepQuality": z.number().int().min(1).max(5).nullable().optional(),
    "restingHr": z.number().int().min(25).max(140).nullable().optional(),
    "hrvLnRMSSD": z.number().min(0).max(12).nullable().optional(),
    "stress": z.number().int().min(1).max(5).nullable().optional(),
    "fatigue": z.number().int().min(1).max(5).nullable().optional(),
    "muscleSoreness": z.number().int().min(1).max(5).nullable().optional(),
    "musoreSoreness": z.number().int().min(1).max(5).nullable().optional(),
    "illnessSymptoms": z.array(z.union([z.literal("none"), z.literal("above-neck"), z.literal("below-neck"), z.literal("fever"), z.literal("GI"), z.literal("chest"), z.literal("other")])).optional(),
    "fuelingNote": z.string().max(280).nullable().optional(),
  }).strict().nullable().optional(),
    "pain": z.array(z.object({
    "site": z.string().max(60),
    "side": z.union([z.literal("left"), z.literal("right"), z.literal("central"), z.null()]).optional(),
    "intensity": z.number().int().min(0).max(10),
    "duringRun": z.boolean().optional(),
    "nextMorningWorse": z.boolean().optional(),
    "affectsGait": z.boolean().optional(),
    "nightPain": z.boolean().optional(),
    "duration": z.union([z.literal("today"), z.literal("few-days"), z.literal("1-2-weeks"), z.literal("over-2-weeks"), z.literal("recurring")]).optional(),
    "knownInjury": z.boolean().optional(),
  }).strict()).max(5).optional(),
    "note": z.string().max(2000).nullable().optional(),
    "intent": z.union([z.literal("as-planned"), z.literal("listened-to-body"), z.literal("pushed-anyway"), z.literal("just-move"), z.literal("training-for-race"), z.literal("just-check-me"), z.literal("other"), z.null()]).optional(),
    "source": z.union([z.literal("mobile"), z.literal("web"), z.literal("offline-queue"), z.literal("import-assistant"), z.literal("voice")]).optional(),
    "linkedActivityIds": z.array(z.string().uuid()).optional(),
  }).strict(), z.object({
    "outcome": z.literal("skipped").optional(),
  }).passthrough(), z.object({
    "outcomeDetail": z.string(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "outcome": z.literal("partial").optional(),
  }).passthrough(), z.union([z.object({
    "completedKm": requiredAny,
  }).passthrough(), z.object({
    "durationMin": requiredAny,
  }).passthrough()]), "the object does not satisfy the contract's if/then rule"), z.object({
    "outcome": z.literal("completed").optional(),
    "sessionTaken": requiredAny,
  }).passthrough(), z.object({
    "sessionTaken": z.union([z.literal("as-prescribed"), z.literal("alternate"), z.literal("extra")]).optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "outcome": z.union([z.literal("rest"), z.literal("skipped"), z.literal("missed")]).optional(),
    "sessionTaken": requiredAny,
  }).passthrough(), z.object({
    "sessionTaken": z.literal("none").optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "outcome": z.literal("partial").optional(),
    "sessionTaken": z.union([z.literal("as-prescribed"), z.literal("alternate"), z.literal("extra"), z.literal("none")]),
  }).passthrough(), z.object({
    "sessionTaken": z.literal("partial").optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "sessionTaken": z.literal("partial"),
  }).passthrough(), z.union([z.object({
    "completedKm": z.number().gt(0),
  }).passthrough(), z.object({
    "durationMin": z.number().gt(0),
  }).passthrough()]), "the object does not satisfy the contract's if/then rule");

const planVersionSession = whenThen(whenThen(whenThen(z.object({
    "day": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "kind": z.union([z.literal("rest"), z.literal("recovery"), z.literal("easy"), z.literal("strides"), z.literal("long"), z.literal("hills"), z.literal("tempo"), z.literal("vo2max"), z.literal("mp"), z.literal("cross-training"), z.literal("strength"), z.literal("test"), z.literal("race")]),
    "outcome": z.union([z.literal("planned"), z.literal("rest"), z.literal("completed"), z.literal("partial"), z.literal("skipped"), z.literal("missed")]),
    "restDay": z.boolean(),
    "summaryText": z.string().min(1).max(240),
    "distanceKm": z.number().min(0).max(250).nullable().optional(),
    "durationMin": z.number().min(0).max(1500).nullable().optional(),
    "targetPaceMinSecPerKm": z.number().min(120).max(900).multipleOf(5).nullable().optional(),
    "targetPaceMaxSecPerKm": z.number().min(120).max(900).multipleOf(5).nullable().optional(),
    "targetHrMin": z.number().int().min(40).max(230).nullable().optional(),
    "targetHrMax": z.number().int().min(40).max(230).nullable().optional(),
    "targetRpe": z.number().int().min(1).max(10).nullable().optional(),
    "primaryTarget": z.union([z.literal("pace"), z.literal("hr"), z.literal("rpe"), z.literal("feel")]).optional(),
    "feelCue": z.string().max(160).nullable().optional(),
    "paceAnchorDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    "granularity": z.union([z.literal("coarse"), z.literal("detailed")]).optional(),
    "hardDay": z.boolean().optional(),
    "nonNegotiable": z.boolean().optional(),
    "ruleIds": z.array(z.string().regex(new RegExp("^[a-z0-9]+(?:-[a-z0-9]+)*$"))).max(20).optional(),
  }).strict(), z.object({
    "restDay": z.literal(true),
  }).passthrough(), z.object({
    "kind": z.literal("rest").optional(),
    "hardDay": z.literal(false).optional(),
    "nonNegotiable": z.literal(false).optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "primaryTarget": z.literal("pace"),
  }).passthrough(), z.object({
    "targetPaceMinSecPerKm": z.number().optional(),
    "targetPaceMaxSecPerKm": z.number().optional(),
    "paceAnchorDay": z.string().optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "outcome": z.union([z.literal("completed"), z.literal("partial"), z.literal("skipped"), z.literal("missed")]),
  }).passthrough(), z.object({
    "granularity": z.literal("detailed").optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule");

const planVersionAppliedRule = whenThen(z.object({
    "ruleId": z.string().regex(new RegExp("^[a-z0-9]+(?:-[a-z0-9]+)*$")),
    "anchor": z.string().min(3).max(200),
    "effect": z.union([z.literal("subtracted"), z.literal("dosed"), z.literal("clamped"), z.literal("informed")]),
    "isSafety": z.boolean().optional(),
    "severity": z.union([z.literal("constraint"), z.literal("hard-stop"), z.literal("advisory")]).optional(),
    "daysAffected": z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(400).optional(),
    "notes": z.string().max(400).optional(),
  }).strict(), z.object({
    "isSafety": z.literal(true),
  }).passthrough(), z.object({
    "effect": z.literal("subtracted").optional(),
    "severity": z.union([z.literal("hard-stop"), z.literal("constraint")]).optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule");

const planVersionClampedKnob = z.object({
    "anchor": z.string().min(3).max(200),
    "requestedValue": z.union([z.number(), z.string(), z.boolean()]).nullable(),
    "allowedMin": z.number(),
    "allowedMax": z.number(),
    "appliedValue": z.number(),
    "unit": z.string().max(40).nullable().optional(),
    "requestedBy": z.string().max(120).nullable().optional(),
  }).strict();

const planVersionNote = z.object({
    "id": z.string().regex(new RegExp("^[a-z0-9]+(?:-[a-z0-9]+)*$")),
    "detail": z.string().min(1).max(500),
    "day": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    "blocksGeneration": z.boolean().optional(),
  }).strict();

export const planVersionSchema = whenThen(whenThen(z.object({
    "schemaVersion": z.literal(1),
    "versionId": z.string().uuid(),
    "planId": z.string().uuid(),
    "userId": z.string().uuid(),
    "parentVersionId": z.string().uuid().nullable(),
    "generatedBy": z.union([z.literal("initial-build"), z.literal("rolling-refine"), z.literal("micro-adjust"), z.literal("review-accepted")]),
    "generatedAtDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "firstDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "lastDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "timeZone": z.string().min(1).max(64).optional(),
    "dayStartHour": z.number().int().min(0).max(23).optional(),
    "plannerVersion": z.string().min(1).max(64),
    "knowledgeHash": z.string().regex(new RegExp("^sha256:[0-9a-f]{64}$")),
    "inputsHash": z.string().regex(new RegExp("^sha256:[0-9a-f]{64}$")),
    "sessions": z.array(planVersionSession).min(1).max(740),
    "appliedRules": z.array(planVersionAppliedRule).max(500),
    "clampedKnobs": z.array(planVersionClampedKnob).max(200),
    "assumptions": z.array(planVersionNote).max(50),
    "warnings": z.array(planVersionNote).max(50),
  }).strict(), z.object({
    "generatedBy": z.union([z.literal("rolling-refine"), z.literal("micro-adjust"), z.literal("review-accepted")]),
  }).passthrough(), z.object({
    "parentVersionId": z.string().optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule"), z.object({
    "generatedBy": z.literal("initial-build"),
  }).passthrough(), z.object({
    "parentVersionId": z.null().optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule");

const planDiffChange = whenThen(z.object({
    "kind": z.union([z.literal("session.added"), z.literal("session.removed"), z.literal("distance.changed"), z.literal("pace.band-changed"), z.literal("day.became-rest"), z.literal("day.swapped"), z.literal("session.moved"), z.literal("structure.changed"), z.literal("session.downgraded"), z.literal("distance.reduced"), z.literal("pace.band-widened"), z.literal("pace.band-relaxed")]),
    "day": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "beforeSummary": z.string().max(240),
    "afterSummary": z.string().max(240),
    "reason": z.string().max(400),
    "signalId": z.string(),
    "expectedCost": z.string().max(200),
    "expectedBenefit": z.string().max(200).optional(),
    "knobsUsed": z.array(z.string()),
    "isSafety": z.boolean().optional(),
  }).strict(), z.object({
    "isSafety": z.literal(true),
  }).passthrough(), z.object({
    "kind": z.union([z.literal("session.removed"), z.literal("session.downgraded"), z.literal("distance.reduced"), z.literal("pace.band-widened"), z.literal("pace.band-relaxed"), z.literal("day.became-rest")]).optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule");

export const planDiffSchema = z.object({
    "schemaVersion": z.literal(1),
    "diffId": z.string().uuid(),
    "userId": z.string().uuid(),
    "fromVersionId": z.string().uuid(),
    "toVersionId": z.string().uuid(),
    "createdAtDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "firstTouchedDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    "changes": z.array(planDiffChange).min(0).max(2),
    "changeCountWithinLimit": z.literal(true),
    "frozenDays": z.number().int().min(0).max(7).optional(),
    "knowledgeHash": z.string().regex(new RegExp("^sha256:[0-9a-f]{64}$")),
  }).strict();

export const reviewSchema = z.object({
    "schemaVersion": z.literal(1),
    "reviewId": z.string().uuid(),
    "userId": z.string().uuid(),
    "openedAtDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "openedBy": z.union([z.literal("system-signal"), z.literal("user-request"), z.literal("post-race"), z.literal("post-layoff"), z.literal("phase-boundary")]).optional(),
    "evidence": z.object({
    "signalIds": z.array(z.string()).min(1),
    "ruleIds": z.array(z.string()).min(1),
    "evidenceGradeMax": z.union([z.literal("A"), z.literal("B"), z.literal("C")]),
    "streakDays": z.number().int().min(1).optional(),
  }).strict(),
    "horizonDays": z.number().int().min(3).max(28),
    "freezeDays": z.number().int().min(0).max(7).optional(),
    "options": z.array(z.object({
    "optionId": z.string(),
    "labelKey": z.string(),
    "keepAsIs": z.boolean(),
    "diffId": z.string().uuid().nullable(),
    "costSummary": z.string().max(200),
    "expiresAfterDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict()).min(2).max(4),
    "status": z.union([z.literal("open"), z.literal("accepted"), z.literal("rejected"), z.literal("deferred"), z.literal("expired"), z.literal("superseded")]),
    "chosenOptionId": z.string().nullable().optional(),
    "decidedAtDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    "resultDiffId": z.string().uuid().nullable().optional(),
    "rejectedThresholdRaiseDays": z.number().int().min(0).max(90).optional(),
    "outcomeCheckDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    "narrative": z.object({
    "locale": z.union([z.literal("en"), z.literal("zh-Hant")]),
    "text": z.string().max(1200),
    "allowedNumbers": z.array(z.number()),
    "generated": z.boolean(),
  }).strict().nullable().optional(),
  }).strict();

export const signalSchema = z.object({
    "key": z.union([z.literal("load_sRPE"), z.literal("load_trimp"), z.literal("load_normalized"), z.literal("weekly_load"), z.literal("load_monotony"), z.literal("strain"), z.literal("ctl"), z.literal("atl"), z.literal("tsb"), z.literal("acwr"), z.literal("ramp_rate"), z.literal("hrv_lnrmssd_dev"), z.literal("hrv_data_sufficiency"), z.literal("rhr_dev"), z.literal("sleep_debt"), z.literal("wellness_index"), z.literal("vdot_equivalent"), z.literal("pace_bands"), z.literal("pace_at_hr_easy"), z.literal("hr_drift"), z.literal("threshold_hr_est"), z.literal("durability"), z.literal("economy_proxy"), z.literal("completion_rate"), z.literal("rpe_gap"), z.literal("log_continuity"), z.literal("log_quality_by_daytype"), z.literal("device_coverage"), z.literal("pain_trend"), z.literal("adherence_intent_mix")]),
    "userId": z.string().uuid(),
    "asOfDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "window": z.object({
    "kind": z.union([z.literal("rolling-ema"), z.literal("rolling-days"), z.literal("iso-week"), z.literal("phase"), z.literal("since-event"), z.literal("single-day")]),
    "days": z.number().int().min(1).max(365).nullable().optional(),
    "tauDays": z.number().min(0.5).max(120).nullable().optional(),
    "startDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    "endDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).strict(),
    "value": z.union([z.number(), z.boolean(), z.string(), z.object({}).passthrough(), z.array(z.record(z.unknown()))]).nullable(),
    "unit": z.string().nullable().optional(),
    "baselineValue": z.number().nullable().optional(),
    "deviationPct": z.number().min(-100).max(500).nullable().optional(),
    "direction": z.union([z.literal("stable"), z.literal("rising"), z.literal("falling"), z.literal("volatile"), z.literal("unknown")]).optional(),
    "confidence": z.union([z.literal("low"), z.literal("medium"), z.literal("high"), z.literal("insufficient")]),
    "confidenceNote": z.string().max(200).nullable().optional(),
    "mayDrive": z.array(z.union([z.literal("display"), z.literal("micro"), z.literal("review"), z.literal("safety"), z.literal("narrator")])).min(1),
    "consecutiveDays": z.number().int().min(0).max(60).nullable().optional(),
    "crossedThreshold": z.boolean().nullable().optional(),
    "dataQuality": z.object({
    "expectedDays": z.number().int().min(0).optional(),
    "presentDays": z.number().int().min(0).optional(),
    "coveragePct": z.number().min(0).max(100).nullable().optional(),
    "source": z.union([z.literal("manual"), z.literal("device"), z.literal("import"), z.literal("mixed"), z.literal("assumed")]).optional(),
    "exclusions": z.array(z.string()).optional(),
  }).strict().nullable().optional(),
    "computedAt": z.string().datetime({ offset: true }),
    "inputsHash": z.string().regex(new RegExp("^sha256:[0-9a-f]{64}$")),
    "knowledgeHash": z.string().regex(new RegExp("^sha256:[0-9a-f]{64}$")),
    "formulaVersion": z.string().optional(),
  }).strict();

export const eventSchema = whenThen(whenThen(whenThen(z.object({
    "eventId": z.string().uuid(),
    "userId": z.string().uuid(),
    "type": z.string().regex(new RegExp("^[a-z][a-zA-Z]*\\.[a-zA-Z][a-zA-Z]*$")),
    "occurredAt": z.string().datetime({ offset: true }),
    "actor": z.union([z.literal("runner"), z.literal("system"), z.literal("worker"), z.literal("import"), z.literal("support")]),
    "payloadVersion": z.literal(1),
    "payload": z.object({}).passthrough(),
    "trainingDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "timezone": z.string().min(1),
    "dayStartHour": z.number().int().min(0).max(11).optional(),
    "idempotencyKey": z.string().max(200).nullable().optional(),
    "causationId": z.string().uuid().nullable().optional(),
    "supersedesEventId": z.string().uuid().nullable().optional(),
    "schemaUrl": z.string().url().nullable().optional(),
  }).strict(), z.object({
    "actor": z.literal("runner"),
  }).passthrough(), z.object({
    "idempotencyKey": z.string(),
  }).passthrough(), "A runner action always arrives over a network that retries, so it always carries an idempotency key; a null key on a runner action is a client bug and must fail at write time rather than duplicate a daily entry."), z.object({
    "type": z.literal("day.closed"),
  }).passthrough(), z.object({
    "actor": z.union([z.literal("system"), z.literal("worker")]),
    "payload": z.object({
    "status": z.union([z.literal("logged"), z.literal("closed-unlogged")]),
    "plannedKm": z.number().min(0),
    "plannedSessions": z.number().int().min(0),
    "completedKm": z.number().min(0),
    "outcome": z.string().nullable(),
  }).passthrough(),
  }).passthrough(), "A day closes once, and the sweep is the only thing allowed to say so: a runner cannot close their own day, because that would let a tap decide whether the day counts as unlogged. The payload carries both what the plan asked and what was reported, so `closed-unlogged` is a status with a null outcome rather than a zero that looks like a decision."), z.object({
    "type": z.string().regex(new RegExp("^safety\\.")),
  }).passthrough(), z.object({
    "actor": z.union([z.literal("system"), z.literal("worker"), z.literal("support")]).optional(),
    "causationId": requiredAny,
  }).passthrough(), "Safety events are raised by the system, never by a tap, and an override records which flag it overrode. A safety event without a cause chain is the one audit gap that must never be possible (AGENTS rule 3).");

export const promptDeliverySchema = z.object({
    "userId": z.string().uuid(),
    "kind": z.union([z.literal("nudge"), z.literal("review"), z.literal("weekly-summary")]),
    "day": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "forDay": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "atMinute": z.number().int().min(0).max(1439),
  }).strict();

export const guidelineSchema = whenThen(z.object({
    "guidelineId": z.string().regex(new RegExp("^[a-z0-9]+(-[a-z0-9]+)*$")),
    "version": z.number().int().min(1),
    "tier": z.union([z.literal("non-negotiable"), z.literal("constraint"), z.literal("default")]),
    "scope": z.union([z.literal("safety"), z.literal("medical"), z.literal("progression"), z.literal("tone"), z.literal("review-cadence")]),
    "visibility": z.union([z.literal("internal"), z.literal("public")]),
    "text": z.string().min(1).max(2000),
    "rationale": z.string().min(1).max(2000),
    "effectiveFrom": z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    "createdBy": z.string().min(1).max(120),
    "supersedesVersion": z.number().int().min(1).optional(),
  }).strict(), z.object({
    "scope": z.union([z.literal("safety"), z.literal("medical")]),
  }).passthrough(), z.object({
    "visibility": z.literal("internal").optional(),
  }).passthrough(), "the object does not satisfy the contract's if/then rule");

export type AthleteProfileContract = z.infer<typeof athleteProfileSchema>;
export type DayEntryContract = z.infer<typeof dayEntrySchema>;
export type PlanVersionContract = z.infer<typeof planVersionSchema>;
export type PlanDiffContract = z.infer<typeof planDiffSchema>;
export type ReviewContract = z.infer<typeof reviewSchema>;
export type SignalContract = z.infer<typeof signalSchema>;
export type EventContract = z.infer<typeof eventSchema>;
export type PromptDeliveryContract = z.infer<typeof promptDeliverySchema>;
export type GuidelineContract = z.infer<typeof guidelineSchema>;
