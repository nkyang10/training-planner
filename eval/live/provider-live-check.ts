/**
 * A manual live check against a real provider. Not part of `pnpm test`: CI must never depend on an external endpoint,
 * and the key must never be committed. Run it by exporting the three variables first:
 *
 *   $env:TRAINING_PLANNER_MODEL_BASE_URL = "http://host:port/v1"
 *   $env:TRAINING_PLANNER_MODEL_API_KEY  = "..."      # never commit this
 *   $env:TRAINING_PLANNER_MODEL_NAME     = "model-id"
 *   npx tsx eval/live/provider-live-check.ts
 *
 * Two simulated runners go through the whole claim path - the request the advisor builds, the port's call, and the
 * deterministic gates' verdict on whatever comes back:
 *
 *   fresh      - a runner with no entries: the honest answer is no-change.
 *   struggling - a runner who skipped two planned sessions: the honest answer is a proposal, and the gates still decide.
 *
 * The observed result is written to docs/engineering/provider-live-check.md by hand, not by this script.
 */
import { ADVISOR_REASON_CODES, buildAdvisorRequest, validateProposal } from "../../packages/advisor/src/index";
import { ADJUST_COST_KEYS } from "../../packages/policy/src/index";
import { generatePlan } from "../../packages/planner-core/src/index";
import { baseEvidence, baseProfile } from "../../packages/planner-core/test/helpers";
import { computeSignals } from "../../packages/signals/src/index";
import { loadKnowledge } from "../../packages/knowledge/src/index";
import { createHttpModelPort } from "../../apps/api/src/provider";
import type { DayEntry } from "../../packages/domain/src/index";

const knowledge = loadKnowledge("knowledge/heuristics");
const baseUrl = process.env["TRAINING_PLANNER_MODEL_BASE_URL"];
const apiKey = process.env["TRAINING_PLANNER_MODEL_API_KEY"];
const model = process.env["TRAINING_PLANNER_MODEL_NAME"];
if (baseUrl === undefined || baseUrl.length === 0 || apiKey === undefined || apiKey.length === 0 || model === undefined || model.length === 0) {
  console.error("set TRAINING_PLANNER_MODEL_BASE_URL, TRAINING_PLANNER_MODEL_API_KEY and TRAINING_PLANNER_MODEL_NAME");
  process.exit(2);
}

const today = "2026-11-09";
const userId = "11111111-1111-4111-8111-111111111111";
const plan = generatePlan({
  profile: baseProfile,
  evidence: baseEvidence,
  state: { planStartDay: "2026-11-02", horizonDays: 21 },
  clock: { today: "2026-11-01" },
  seed: "live-check",
  knowledge,
}).version;

const entry = (day: string, outcome: DayEntry["outcome"], extra: Partial<DayEntry> = {}): DayEntry => ({
  day,
  outcome,
  revision: 1,
  tzAtEvent: "Asia/Taipei",
  idempotencyKey: `live-${day}`,
  ...extra,
});

const struggling: DayEntry[] = [
  entry("2026-11-03", "skipped", { outcomeDetail: "work" }),
  entry("2026-11-05", "skipped", { outcomeDetail: "sleep" }),
  entry("2026-11-07", "completed", { sessionTaken: "as-prescribed", completedKm: 6, rpe: 8 }),
];

const port = createHttpModelPort({ baseUrl, apiKey, model, timeoutMs: 60_000 });

const runCase = async (label: string, entries: DayEntry[]): Promise<unknown> => {
  const signals = computeSignals({ userId, today, entries, plan, knowledge, computedAt: `${today}T22:00:00.000Z` }).signals;
  const call = buildAdvisorRequest({
    plan,
    entries,
    signals,
    wizardAnswers: [{ stepId: "goal", answer: { type: "finish" }, revision: 1, source: "wizard" }],
    settings: { riskAppetite: "conservative", weeklyHours: 5, dislikedKinds: [], preferredLongDay: null },
    guidelines: [
      {
        guidelineId: "progression-ceiling",
        version: 1,
        tier: "constraint",
        scope: "progression",
        visibility: "public",
        text: "Weekly volume rises by at most 10 percent.",
        rationale: "Stated once, kept once.",
        effectiveFrom: "2026-11-01",
        createdBy: "operator",
      },
    ],
    today,
    knowledge,
    allowedCostKeys: [...ADJUST_COST_KEYS],
    allowedReasonCodes: [...ADVISOR_REASON_CODES],
  });

  const started = Date.now();
  let output: unknown;
  try {
    output = await port.complete(call, { userId });
  } catch (error) {
    return { case: label, elapsedMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  }
  const verdict = validateProposal({ output, request: call.request, plan, today, knowledge });
  return {
    case: label,
    elapsedMs: Date.now() - started,
    signals: signals.map((signal) => ({ key: signal.key, value: signal.value, confidence: signal.confidence })),
    hashes: call.hashes,
    output,
    verdict: {
      accepted: verdict.accepted,
      violations: verdict.violations,
      fallback: verdict.fallback,
      proposal: verdict.proposal ?? null,
    },
  };
};

const results = [await runCase("fresh", []), await runCase("struggling", struggling)];
console.log(JSON.stringify({ endpointHost: new URL(baseUrl).host, model, results }, null, 2));
