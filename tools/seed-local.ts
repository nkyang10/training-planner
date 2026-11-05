/**
 * Local seed: a real, reviewable runner state in a SQLite database, so the web UI can be used as a runner would use it
 * instead of looked at as an empty draft.
 *
 * Run:  npx tsx tools/seed-local.ts
 * Then: API_TOKENS='{"demo-token":"<uuid>"}' TRAINING_PLANNER_DB=sqlite:data/local.sqlite ... (see docs/local-testing.md)
 *
 * Everything here is fictional but shaped like a real season: a goal, a wizard history with an original and a current
 * answer, three weeks of plan, entries with misses and one pain report, a stored comment, an open review with a real
 * diff, a granted consent, and one audited AI decision.
 */
import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import type { DayEntry, GuidelineContract, PlanVersion } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { generatePlan, uuidFrom } from "@training-planner/planner-core";
import { childPlanVersion } from "@training-planner/replan";
import { diffPlans } from "@training-planner/planner-core";
import { openReview } from "@training-planner/review";
import { createRepositoryFromSpec } from "@training-planner/storage";
import type { CommentRecord } from "@training-planner/storage";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3";
const TODAY = "2026-11-05";
const DATABASE = "data/local.sqlite";

mkdirSync(dirname(DATABASE), { recursive: true });
rmSync(DATABASE, { force: true });
const handle = createRepositoryFromSpec(`sqlite:${DATABASE}`);
const repository = handle.repository;

const at = (day: string, time = "08:00:00.000Z"): string => `${day}T${time}`;

// --- guidelines: two public, one internal safety rule (the runner's console must never show the internal one) ---
const guidelines: GuidelineContract[] = [
  {
    guidelineId: "progression-ceiling",
    version: 1,
    tier: "constraint",
    scope: "progression",
    visibility: "public",
    text: "Weekly volume rises by at most 10 percent.",
    rationale: "Stated once, kept once.",
    effectiveFrom: "2026-10-01",
    createdBy: "operator",
  },
  {
    guidelineId: "tone-warmth",
    version: 1,
    tier: "default",
    scope: "tone",
    visibility: "public",
    text: "Explain before judging; no cheerleading, no scolding.",
    rationale: "The runner reads this as a person, not a coach.",
    effectiveFrom: "2026-10-01",
    createdBy: "operator",
  },
  {
    guidelineId: "night-pain-stop",
    version: 1,
    tier: "non-negotiable",
    scope: "safety",
    visibility: "internal",
    text: "Night pain or gait change stops load until a clinician has looked.",
    rationale: "Safety is the master layer; the runner is told the action, not the whole rulebook.",
    effectiveFrom: "2026-10-01",
    createdBy: "operator",
  },
];
for (const guideline of guidelines) repository.saveGuideline(guideline);

// --- the wizard's history: the runner changed their mind, and both answers stay visible ---
repository.saveWizardAnswer(USER, { stepId: "goal", answer: { value: "time" }, revision: 1, source: "wizard" });
repository.saveWizardAnswer(USER, { stepId: "availability", answer: { values: ["Mon", "Wed", "Fri"] }, revision: 1, source: "wizard" });
repository.saveWizardAnswer(USER, { stepId: "risk-appetite", answer: { value: "conservative" }, revision: 1, source: "wizard" });
repository.saveWizardAnswer(USER, { stepId: "goal", answer: { value: "finish" }, revision: 2, source: "settings" });
repository.saveWizardAnswer(USER, { stepId: "availability", answer: { values: ["Mon", "Wed", "Fri", "Sun"] }, revision: 2, source: "settings" });

const profile = {
  userId: USER,
  revision: 1,
  age: 34,
  availability: { days: ["Mon", "Wed", "Fri", "Sun"] },
  goal: { type: "finish", event: null, riskAppetite: "conservative" },
  preferences: { units: "metric" as const, locale: "en" as const, timezone: "Asia/Taipei" },
  health: {},
};
repository.saveAthleteProfile(profile, {
  changedBy: "runner",
  source: "user",
  diff: [
    { path: "goal.type", from: "time", to: "finish" },
    { path: "availability.days", from: ["Mon", "Wed", "Fri"], to: ["Mon", "Wed", "Fri", "Sun"] },
  ],
  occurredAt: at(TODAY),
});

// --- a season: four weeks from 2026-10-19, with a generated plan the pages can render ---
const plan = generatePlan({
  profile: {
    userId: USER,
    revision: 1,
    age: 34,
    availability: { days: ["Mon", "Wed", "Fri", "Sun"] },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
  },
  evidence: { recentWeeklyKm: [18, 21, 22], layoffDays: 0, baselinePaceSecPerKm: null, baselineConfidence: "low" },
  state: { planStartDay: "2026-10-19", horizonDays: 28 },
  clock: { today: "2026-10-18" },
  seed: "local-seed",
  knowledge,
}).version;
// The base plan is saved, not "activated": activation is a review decision, exactly as the API's own /plan route does it.
repository.savePlanVersion(plan);

// --- the runner's log: three weeks of entries, a miss, a partial, and one knee report ---
const dayOf = (date: string): string => date;
const addDays = (day: string, count: number): string => {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};

const missed = new Set(["2026-10-24", "2026-11-01"]);
const partial = new Set(["2026-10-30"]);
let day = "2026-10-19";
let index = 0;
while (day <= "2026-11-04") {
  const session = plan.sessions.find((item) => item.day === day);
  const kind = session?.kind ?? "rest";
  const entry: DayEntry = {
    day: dayOf(day),
    outcome: kind === "rest" ? "rest" : missed.has(day) ? "missed" : partial.has(day) ? "partial" : "completed",
    revision: 1,
    tzAtEvent: "Asia/Taipei",
    sessionTaken: kind === "rest" ? "none" : missed.has(day) ? "none" : partial.has(day) ? "partial" : "as-prescribed",
    completedKm: kind === "rest" ? 0 : missed.has(day) ? 0 : partial.has(day) ? Math.round(((session?.distanceKm ?? 0) / 2) * 10) / 10 : session?.distanceKm ?? 0,
    rpe: kind === "rest" ? null : missed.has(day) ? null : partial.has(day) ? 6 : kind === "long" ? 6 : 4,
    mood: missed.has(day) ? 2 : 4,
    legs: partial.has(day) ? 4 : 3,
    wellness: { sleepHours: 7.5, sleepQuality: 4, fatigue: missed.has(day) ? 4 : 2 },
    note: missed.has(day) ? "Work ran late; moved nothing." : partial.has(day) ? "Cut it short, knee felt odd." : null,
    source: "web",
    idempotencyKey: `local-${day}`,
    clientSubmittedAt: at(day, "21:30:00.000Z"),
    ...(day === "2026-11-03"
      ? { pain: [{ site: "knee", side: "right" as const, intensity: 3, duringRun: true, nextMorningWorse: false, affectsGait: false, nightPain: false, duration: "few-days" as const, knownInjury: false }] }
      : {}),
  };
  repository.appendEntryWithEventAndPointer({
    entry,
    event: {
      eventId: uuidFrom({ userId: USER, day, type: "entry.submitted", index }),
      userId: USER,
      type: "entry.submitted",
      occurredAt: at(day, "21:30:00.000Z"),
      actor: "runner",
      payloadVersion: 1,
      payload: { entryId: entry.entryId ?? null },
      trainingDay: day,
      timezone: "Asia/Taipei",
      idempotencyKey: `local-${day}`,
    },
  });
  day = addDays(day, 1);
  index += 1;
}

// The pain row is a projection of the entry, written by the same pipeline the API uses, so the pain page can show a
// trajectory instead of "nothing reported".
repository.savePainReport({
  userId: USER,
  id: uuidFrom({ userId: USER, day: "2026-11-03", type: "pain-report", site: "knee", index: 0 }),
  day: "2026-11-03",
  site: "knee",
  side: "right",
  intensity: 3,
  duringRun: true,
  nextMorning: false,
  trendGaitChange: false,
  nightPain: false,
  duration: "few-days",
  knownInjury: false,
  note: null,
});

// --- a stored system comment, exactly as the runner read it ---
const comment: CommentRecord = {
  commentId: uuidFrom({ userId: USER, day: "2026-11-03", type: "system-comment" }),
  userId: USER,
  day: "2026-11-03",
  locale: "en",
  sentences: [
    "You logged a knee report at 3 out of 10 today.",
    "I am not changing the plan on one report, but I will keep the next two days easy and ask you to say if the next morning is worse.",
  ],
  text: "You logged a knee report at 3 out of 10 today. I am not changing the plan on one report, but I will keep the next two days easy and ask you to say if the next morning is worse.",
  knowledgeHash: knowledge.hash,
  createdAt: at("2026-11-03", "21:35:00.000Z"),
};
repository.saveComment(comment);

// --- one open review with a real diff: a future easy day gets shorter, and the past is untouched ---
// The review must point at a day that can actually change: the first non-rest day after the freeze window. A rest day
// "reduced by 2 km" would be a review that claims a change it cannot show.
const firstEditable = addDays(TODAY, 2);
const editable = plan.sessions.find((session) => session.kind === "easy" && session.day > firstEditable);
if (editable === undefined) throw new Error("the seeded plan has no future easy session to review");
const editableDay = editable.day;
const sessions = plan.sessions.map((session) =>
  session.day === editableDay ? { ...session, distanceKm: Math.max(0, (session.distanceKm ?? 0) - 2), summaryText: `${session.kind} ${Math.max(0, (session.distanceKm ?? 0) - 2)} km` } : session,
);
const child = childPlanVersion(plan, sessions, TODAY, "local-seed");
const diff = diffPlans(plan, child, {
  createdAtDay: TODAY,
  knowledgeHash: knowledge.hash,
  maxChanges: 2,
  reason: "load-high",
  signalIds: [],
  expectedCost: "quality-becomes-easy",
  knobsUsed: [],
});
repository.saveProposedPlanVersion(child);
repository.savePlanDiff(diff);
const opened = openReview({
  userId: USER,
  today: TODAY,
  candidate: {
    kind: "manual",
    ruleId: null,
    anchor: null,
    evidence: { signalIds: [], ruleIds: [], evidenceGradeMax: "C" },
    presentation: "recorded",
  },
  knowledge,
  options: [
    { optionId: "keep", labelKey: "keep-the-plan", keepAsIs: true, diffId: null, costKey: "risk-noted", costSlots: {}, loadDeltaPct: 0 },
    {
      optionId: "edit",
      labelKey: "ease-the-easy-day",
      keepAsIs: false,
      diffId: diff.diffId,
      costKey: "quality-becomes-easy",
      costSlots: { km: 2 },
      loadDeltaPct: -18.2,
    },
  ],
  renderCost: (option) => (option.keepAsIs ? "nothing changes" : "2 km less on one easy day"),
});
if (opened.status !== "opened") throw new Error(`seed review was not opened: ${JSON.stringify(opened)}`);
repository.saveReview(opened.review);

// --- consent and one audited AI decision: the console can show that the model is a proposal, not an authority ---
repository.saveLlmConsent({
  userId: USER,
  granted: true,
  purpose: "review-decision",
  policyVersion: "v1",
  grantedAt: at("2026-10-20"),
  revokedAt: null,
  updatedAt: at("2026-10-20"),
});
repository.saveAiReviewProposal({
  userId: USER,
  id: uuidFrom({ userId: USER, day: TODAY, type: "ai.review.proposal", prompt: "seed" }),
  day: TODAY,
  guidelineVersionHash: "sha256:" + "0".repeat(64),
  model: "local-seed",
  promptHash: "sha256:" + "1".repeat(64),
  output: { decision: "no-change", reasonCode: "no-action-needed" },
  validatorVerdict: "accepted",
  fallbackUsed: false,
  reviewId: opened.review.reviewId,
  createdAt: at(TODAY),
});

const counts = {
  entries: repository.listEntries(USER).length,
  planVersions: repository.listPlanVersions(USER).length,
  guidelines: repository.listGuidelines().length,
  wizardAnswers: repository.listWizardAnswers(USER).length,
  comments: repository.listComments(USER).length,
  reviews: repository.listReviews(USER).length,
};
handle.close();
console.log(
  JSON.stringify(
    {
      database: DATABASE,
      user: USER,
      token: "demo-token",
      reviewId: opened.review.reviewId,
      counts,
      next: 'API_TOKENS=\'{"demo-token":"d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3"}\' TRAINING_PLANNER_DB=sqlite:data/local.sqlite',
    },
    null,
    2,
  ),
);
