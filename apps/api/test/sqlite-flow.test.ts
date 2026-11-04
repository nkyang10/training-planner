/**
 * The whole loop on SQLite: profile -> plan -> consent -> advisor -> review -> accept, with every row written through the
 * real adapter and read back through the same connection. The memory adapter is already covered elsewhere; this test
 * exists because "the adapter passes its own tests" and "the product runs on it" are different claims.
 */
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadKnowledge } from "@training-planner/knowledge";
import { createMemorySessions, createRepositoryFromSpec } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import { baseEvidence } from "../../../packages/planner-core/test/helpers";
import { createApi } from "../src/server";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TODAY = "2026-11-05";
const NOW = "2026-11-05T08:00:00.000Z";

const profile = {
  userId: USER,
  revision: 1,
  age: 36,
  availability: { days: ["Mon", "Wed", "Fri", "Sun"] },
  goal: { type: "time", event: null },
  preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
  health: {},
};

let repository: Repository;
let base = "";
let server: ReturnType<typeof createServer>;
let easyDay = "";
let easyKm = 0;
let nextModelOutput: unknown = null;

beforeAll(async () => {
  repository = createRepositoryFromSpec("sqlite::memory:").repository;
  server = createServer(
    createApi({
      repository,
      sessions: createMemorySessions({ "token-s": USER }),
      knowledge,
      now: () => NOW,
      modelPort: { complete: async () => nextModelOutput },
      modelId: "sqlite-flow-model",
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  base = `http://127.0.0.1:${port}`;

  // A wizard answer that differs from the stored profile is what makes the apply a save rather than an "unchanged".
  const answered = await call("/wizard", { method: "POST", body: { stepId: "goal", answer: { value: "finish" } } });
  expect(answered.status).toBe(201);
  const applied = await call("/wizard/apply", { method: "POST", body: { profile } });
  expect(applied.status).toBe(201);

  const plan = await call("/plan", {
    method: "POST",
    body: { profile, evidence: baseEvidence, state: { planStartDay: "2026-11-02", horizonDays: 21 }, seed: "sqlite-flow" },
  });
  expect(plan.status).toBe(201);
  const version = repository.listPlanVersions(USER)[0];
  const easy = version?.sessions.find((session) => session.kind === "easy" && session.day > "2026-11-07");
  if (easy === undefined) throw new Error("the generated plan has no easy day after the freeze window");
  easyDay = easy.day;
  easyKm = easy.distanceKm ?? 0;

  repository.saveLlmConsent({
    userId: USER,
    granted: true,
    purpose: "review-decision",
    policyVersion: "v1",
    grantedAt: NOW,
    revokedAt: null,
    updatedAt: NOW,
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: { authorization: "Bearer token-s", "x-training-day": TODAY, "content-type": "application/json" },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("the runner's whole loop runs on the SQLite adapter", () => {
  it("opens an advisor review and activates the accepted edit's plan version, with the audit row persisted", async () => {
    nextModelOutput = {
      decision: "propose-change",
      reasonCode: "load-high",
      facts: [{ key: "plannedKm", value: easyKm }],
      proposedChanges: [
        { day: easyDay, kind: "easy", fromKm: easyKm, toKm: Math.max(0, easyKm - 2), costKey: "quality-becomes-easy", costSlots: { km: 2 } },
      ],
      confidence: "medium",
      needsHuman: false,
    };
    const opened = await call("/reviews/advisor", { method: "POST", body: {} });
    expect(opened.status).toBe(201);
    expect(opened.body["status"]).toBe("opened");
    const review = opened.body["review"] as { reviewId: string; options: Array<{ optionId: string; kind?: string; diffId?: string | null }> };
    const edit = review.options.find((option) => option.kind === "edit");
    expect(edit?.optionId).toBe("advisor-0");

    const audits = repository.listAiReviewProposals(USER);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.reviewId).toBe(review.reviewId);
    expect(audits[0]?.validatorVerdict).toBe("accepted");

    const accepted = await call(`/reviews/${review.reviewId}/decision`, {
      method: "POST",
      body: { decision: { kind: "accept", optionId: edit?.optionId } },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body["status"]).toBe("accepted");
    const appliedVersionId = accepted.body["appliedVersionId"] as string;
    expect(appliedVersionId).toBeTruthy();
    expect(repository.getActivePlanVersion(USER)?.versionId).toBe(appliedVersionId);

    // The accepted change is in the future and the past rows are untouched: the adapter kept the history.
    const active = repository.getActivePlanVersion(USER);
    const changed = active?.sessions.find((session) => session.day === easyDay);
    expect(changed?.distanceKm).toBe(Math.max(0, easyKm - 2));
    expect(repository.listReviews(USER)).toHaveLength(1);
  });
});
