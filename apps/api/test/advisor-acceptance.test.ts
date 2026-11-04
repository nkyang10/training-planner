/**
 * The provider contract's acceptance test (ADR-0009, P4b).
 *
 * `packages/advisor/test/scenarios.test.ts` measures the gates directly. This file measures the **whole route**: a real
 * HTTP provider port calls a local stub server, the route parses the answer, the gates judge it, the audit row records
 * it, and the response says what happened. It is the difference between "the validator is right" and "the product wires
 * the validator to the provider correctly" - a route that forgot to pass the runner id, or a port that mangled the
 * answer, would pass the unit tests and fail here.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DayEntry, GuidelineContract, PlanVersion } from "@training-planner/domain";
import { loadKnowledge } from "@training-planner/knowledge";
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import { makePlan } from "../../../packages/policy/test/helpers";
import type { SessionSpec } from "../../../packages/policy/test/helpers";
import { makeEntry, makeEvent } from "../../../packages/storage/test/helpers";
import { createApi } from "../src/server";
import { createHttpModelPort } from "../src/provider";

const knowledge = loadKnowledge("knowledge/heuristics");
const TODAY = "2026-11-09";
const NOW = "2026-11-09T08:00:00.000Z";

interface Scenario {
  name: string;
  why: string;
  guidelines?: GuidelineContract[];
  entries?: Array<Record<string, unknown>>;
  expect: { accepted: boolean; violationContains?: string };
  proposal: unknown;
}

const scenarios = (
  JSON.parse(readFileSync(join(process.cwd(), "eval", "advisor-scenarios", "scenarios.json"), "utf8")) as {
    scenarios: Scenario[];
  }
).scenarios;

const specs: SessionSpec[] = [
  { day: "2026-11-08", kind: "easy", km: 5, rpe: 4 },
  { day: "2026-11-10", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-11", kind: "rest", km: 0 },
  { day: "2026-11-12", kind: "tempo", km: 10, hard: true, rpe: 7 },
  { day: "2026-11-13", kind: "rest", km: 0 },
  { day: "2026-11-14", kind: "easy", km: 6, rpe: 4 },
  { day: "2026-11-15", kind: "long", km: 14, rpe: 6 },
];

const userIdOf = (index: number): string => `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`;
const tokenOf = (index: number): string => `token-${index}`;

const repository: Repository = createMemoryRepository();
const sessions = createMemorySessions(
  Object.fromEntries(scenarios.map((_, index) => [tokenOf(index), userIdOf(index)])),
);

let apiServer: Server;
let stubServer: Server;
let base = "";
let currentProposal: unknown = null;

const planFor = (userId: string): PlanVersion => {
  const basePlan = makePlan(specs, "2026-11-01");
  return { ...basePlan, userId, versionId: `bbbbbbbb-bbbb-4bbb-8bbb-${userId.slice(-12)}` };
};

beforeAll(async () => {
  // The stub provider: a real http.Server, no external network. It answers with whatever the current scenario says.
  stubServer = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      void chunks;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(currentProposal) } }] }));
    });
  });
  await new Promise<void>((resolve) => stubServer.listen(0, "127.0.0.1", resolve));
  const address = stubServer.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;

  const modelPort = createHttpModelPort(
    { endpoint: `http://127.0.0.1:${port}/v1/chat/completions`, apiKey: "stub-key", model: "stub-model" },
    { now: () => Date.parse(NOW) },
  );

  apiServer = createServer(
    createApi({
      repository,
      sessions,
      knowledge,
      now: () => NOW,
      modelPort,
      modelId: "stub-provider",
    }),
  );
  await new Promise<void>((resolve) => apiServer.listen(0, "127.0.0.1", resolve));
  const apiAddress = apiServer.address();
  const apiPort = typeof apiAddress === "object" && apiAddress !== null ? apiAddress.port : 0;
  base = `http://127.0.0.1:${apiPort}`;

  const savedGuidelines = new Set<string>();
  scenarios.forEach((scenario, index) => {
    const userId = userIdOf(index);
    repository.savePlanVersion(planFor(userId));
    repository.saveLlmConsent({
      userId,
      granted: true,
      purpose: "review-decision",
      policyVersion: "v1",
      grantedAt: NOW,
      revokedAt: null,
      updatedAt: NOW,
    });
    for (const guideline of scenario.guidelines ?? []) {
      const key = `${guideline.guidelineId}@${guideline.version}`;
      if (savedGuidelines.has(key)) continue;
      savedGuidelines.add(key);
      repository.saveGuideline(guideline);
    }
    for (const entry of scenario.entries ?? []) {
      const row = makeEntry({ ...(entry as Partial<DayEntry>), idempotencyKey: `${scenario.name}-${String((entry as { day?: string }).day)}` });
      repository.appendEntryWithEventAndPointer({
        entry: row,
        event: makeEvent({ userId, entry: row, idempotencyKey: row.idempotencyKey ?? null }),
      });
    }
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => apiServer.close(() => resolve()));
  await new Promise<void>((resolve) => stubServer.close(() => resolve()));
});

async function advisor(index: number): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}/reviews/advisor`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokenOf(index)}`,
      "x-training-day": TODAY,
      "content-type": "application/json",
    },
    body: "{}",
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("every scenario travels the whole provider path, and the route answers what the gates decided", () => {
  for (const [index, scenario] of scenarios.entries()) {
    it(`${scenario.name}: ${scenario.why}`, async () => {
      currentProposal = scenario.proposal;
      const response = await advisor(index);

      if (scenario.expect.accepted && (scenario.proposal as { decision: string }).decision === "no-change") {
        expect(response.status).toBe(200);
        expect(response.body["status"]).toBe("no-change");
      } else if (scenario.expect.accepted) {
        expect(response.status).toBe(201);
        expect(response.body["status"]).toBe("opened");
        const options = response.body["options"] as Array<{ optionId: string; kind?: string }>;
        expect(options.length).toBeGreaterThanOrEqual(2);
        expect(options[1]?.kind).toBe("edit");
      } else {
        expect(response.status).toBe(200);
        expect(response.body["status"]).toBe("rejected");
        expect(response.body["fallback"]).toBe("deterministic-replan");
        if (scenario.expect.violationContains !== undefined) {
          expect((response.body["violations"] as string[]).join(" ")).toContain(scenario.expect.violationContains);
        }
      }

      // Every answer left an audit row, and the row carries the hashes the ADR requires.
      const audits = repository.listAiReviewProposals(userIdOf(index));
      expect(audits).toHaveLength(1);
      expect(audits[0]?.validatorVerdict).toBe(scenario.expect.accepted ? "accepted" : "rejected");
      expect(audits[0]?.fallbackUsed).toBe(!scenario.expect.accepted);
      expect(audits[0]?.model).toBe("stub-provider");
      expect(audits[0]?.promptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(audits[0]?.guidelineVersionHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    });
  }
});
