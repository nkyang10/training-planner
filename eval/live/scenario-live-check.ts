/**
 * A manual live check of the ten advisor scenarios against a real provider. Never part of `pnpm test` and never run by
 * CI: the endpoint is external and the key must not be committed. Export the three variables first:
 *
 *   $env:TRAINING_PLANNER_MODEL_BASE_URL = "http://host:port/v1"
 *   $env:TRAINING_PLANNER_MODEL_API_KEY  = "..."      # never commit this
 *   $env:TRAINING_PLANNER_MODEL_NAME     = "model-id"
 *   npx tsx eval/live/scenario-live-check.ts
 *
 * Unlike `packages/advisor/test/scenarios.test.ts`, the fixture's `proposal` is never sent. The point is what the real
 * model answers to each scenario's *context*, and what the deterministic gates decide about that answer.
 *
 * `scenarios.json` carries each scenario's entries and guidelines but not its plan. Every scenario therefore uses the
 * fixed seven-session week from the fixture harness, built with `makePlan(specs, "2026-11-01")`. The fixture's wizard
 * answers and settings are used because no scenario overrides them. No signals are computed, because the fixture
 * harness supplies none; adding them would change the context being measured.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ADVISOR_REASON_CODES, buildAdvisorRequest, validateProposal } from "../../packages/advisor/src/index";
import type { AdvisorInput, AdvisorSettings, WizardAnswer } from "../../packages/advisor/src/index";
import { ADJUST_COST_KEYS } from "../../packages/policy/src/index";
import { makePlan } from "../../packages/policy/test/helpers";
import type { SessionSpec } from "../../packages/policy/test/helpers";
import { loadKnowledge } from "../../packages/knowledge/src/index";
import { createHttpModelPort } from "../../apps/api/src/provider";
import type { GuidelineContract } from "../../packages/domain/src/index";

const knowledge = loadKnowledge("knowledge/heuristics");
const today = "2026-11-09";
const userId = "11111111-1111-4111-8111-111111111111";

const baseUrl = process.env["TRAINING_PLANNER_MODEL_BASE_URL"];
const apiKey = process.env["TRAINING_PLANNER_MODEL_API_KEY"];
const model = process.env["TRAINING_PLANNER_MODEL_NAME"];
if (
  baseUrl === undefined ||
  baseUrl.length === 0 ||
  apiKey === undefined ||
  apiKey.length === 0 ||
  model === undefined ||
  model.length === 0
) {
  console.error("set TRAINING_PLANNER_MODEL_BASE_URL, TRAINING_PLANNER_MODEL_API_KEY and TRAINING_PLANNER_MODEL_NAME");
  process.exit(2);
}

interface Scenario {
  name: string;
  why: string;
  guidelines?: GuidelineContract[];
  entries?: AdvisorInput["entries"];
  wizardAnswers?: readonly WizardAnswer[];
  settings?: AdvisorSettings;
  /** The fixture's expectation and its answer. Never read here: this harness measures the real model, not the fixture. */
  expect: { accepted: boolean; violationContains?: string };
  proposal: unknown;
}

const scenarios = (
  JSON.parse(readFileSync(join(process.cwd(), "eval", "advisor-scenarios", "scenarios.json"), "utf8")) as {
    scenarios: Scenario[];
  }
).scenarios;

/** The fixed week `packages/advisor/test/scenarios.test.ts` builds every scenario's request over. */
const specs: SessionSpec[] = [
  { day: "2026-11-08", kind: "easy", km: 5, rpe: 4 },
  { day: "2026-11-10", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-11", kind: "rest", km: 0 },
  { day: "2026-11-12", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-13", kind: "rest", km: 0 },
  { day: "2026-11-14", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-15", kind: "long", km: 14, rpe: 6 },
];

const fixtureEntries: AdvisorInput["entries"] = [
  { day: "2026-11-08", outcome: "completed", revision: 1, tzAtEvent: "Asia/Taipei", completedKm: 6, rpe: 4 },
];

const fixtureSettings: AdvisorSettings = {
  riskAppetite: "conservative",
  weeklyHours: 5,
  dislikedKinds: ["hills"],
  preferredLongDay: "Sun",
};

const fixtureWizardAnswers: readonly WizardAnswer[] = [
  { stepId: "goal", answer: { type: "finish" }, revision: 1, source: "wizard" },
];

const baseGuideline: GuidelineContract = {
  guidelineId: "progression-ceiling",
  version: 1,
  tier: "constraint",
  scope: "progression",
  visibility: "public",
  text: "Weekly volume rises by at most 10 percent.",
  rationale: "Stated once, kept once.",
  effectiveFrom: "2026-11-01",
  createdBy: "operator",
};

/** The same context `scenarios.test.ts` builds, except the fixture's expected proposal is never included. */
const inputFor = (scenario: Scenario): AdvisorInput => ({
  plan: makePlan(specs, "2026-11-01"),
  entries: scenario.entries ?? fixtureEntries,
  wizardAnswers: scenario.wizardAnswers ?? fixtureWizardAnswers,
  settings: scenario.settings ?? fixtureSettings,
  guidelines: scenario.guidelines ?? [baseGuideline],
  today,
  knowledge,
  allowedCostKeys: [...ADJUST_COST_KEYS],
  allowedReasonCodes: [...ADVISOR_REASON_CODES],
});

interface ScenarioResult {
  name: string;
  /** The model's `decision` field, or null when the call itself failed. */
  decision: string | null;
  /** The gates' verdict, or null when there was no answer to judge. */
  accepted: boolean | null;
  violations: string[];
  error: string | null;
  elapsedMs: number;
  guidelineVersionHash: string;
  promptHash: string;
}

const decisionOf = (output: unknown): string => {
  if (typeof output !== "object" || output === null) return "(not an object)";
  const decision = (output as Record<string, unknown>)["decision"];
  return typeof decision === "string" ? decision : "(no decision field)";
};

const runScenario = async (scenario: Scenario): Promise<ScenarioResult> => {
  const input = inputFor(scenario);
  const call = buildAdvisorRequest(input);
  const port = createHttpModelPort({ baseUrl, apiKey, model, timeoutMs: 60_000 });

  const started = Date.now();
  let output: unknown;
  try {
    output = await port.complete(call, { userId });
  } catch (error) {
    return {
      name: scenario.name,
      decision: null,
      accepted: null,
      violations: [],
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - started,
      guidelineVersionHash: call.hashes.guidelineVersionHash,
      promptHash: call.hashes.promptHash,
    };
  }

  const verdict = validateProposal({ output, request: call.request, plan: input.plan, today, knowledge });
  return {
    name: scenario.name,
    decision: decisionOf(output),
    accepted: verdict.accepted,
    violations: verdict.violations,
    error: null,
    elapsedMs: Date.now() - started,
    guidelineVersionHash: call.hashes.guidelineVersionHash,
    promptHash: call.hashes.promptHash,
  };
};

const results: ScenarioResult[] = [];
for (const scenario of scenarios) results.push(await runScenario(scenario));

const violationsOf = (result: ScenarioResult): string => {
  if (result.error !== null) return `ERROR: ${result.error}`;
  return result.violations.length === 0 ? "(none)" : result.violations.join("; ");
};

console.log("scenario live check against the real provider");
console.log(
  `endpoint host: ${new URL(baseUrl).host} | model: ${model} | today: ${today} | scenarios: ${scenarios.length}`,
);
console.log("");

for (const result of results) {
  const decision = result.decision ?? "(error)";
  const accepted = result.accepted === null ? "n/a" : String(result.accepted);
  console.log(
    `${result.name} | decision=${decision} | accepted=${accepted} | violations=${violationsOf(result)} | ${result.elapsedMs} ms`,
  );
}

console.log("");
console.log("hashes:");
for (const result of results) {
  console.log(
    `${result.name} | guidelineVersionHash=${result.guidelineVersionHash} | promptHash=${result.promptHash}`,
  );
}

const acceptedCount = results.filter((result) => result.accepted === true).length;
const rejectedCount = results.filter((result) => result.accepted === false).length;
const errorCount = results.filter((result) => result.error !== null).length;

console.log("");
console.log(
  `summary: accepted=${acceptedCount} rejected=${rejectedCount} errors=${errorCount} total=${results.length}`,
);
console.log("");
console.log("per-scenario table:");
console.log("scenario | decision | accepted | violations");
for (const result of results) {
  const decision = result.decision ?? "(error)";
  const accepted = result.accepted === null ? "n/a" : String(result.accepted);
  console.log(`${result.name} | ${decision} | ${accepted} | ${violationsOf(result)}`);
}
