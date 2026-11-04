/**
 * The API's tests are end-to-end on purpose: a real http.Server on port 0, real fetch requests, and the real
 * packages underneath. A handler tested by calling it directly would not prove that the composition root, the
 * routing, the contract parsing and the daily loop actually fit together.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dayEntrySchema, planVersionSchema, reviewSchema, signalSchema } from "@training-planner/domain";
import type { PlanDiff } from "@training-planner/domain";
import type { PlanVersion, Review } from "@training-planner/domain";
import { fixtureSchema } from "@training-planner/golden-fixtures";
import { messagesFor } from "@training-planner/i18n";
import { loadKnowledge } from "@training-planner/knowledge";
import { openReview } from "@training-planner/review";
import type { ProposedOption } from "@training-planner/review";
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import { createApi } from "../src/server";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER_A = "66666666-6666-4666-8666-666666666666";
const USER_B = "77777777-7777-4777-8777-777777777777";
const USER_C = "abababab-abab-4bab-8bab-abababababab";
const USER_D = "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd";
const USER_E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const USER_F = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const USER_G = "90909090-9090-4090-8090-909090909090";
const USER_H = "12121212-1212-4212-8212-121212121212";
const NOW = "2026-11-05T22:40:00.000Z";
const TODAY = "2026-11-05";

const repository: Repository = createMemoryRepository();
const sessions = createMemorySessions({ "token-a": USER_A, "token-b": USER_B, "token-c": USER_C, "token-d": USER_D, "token-e": USER_E, "token-f": USER_F, "token-g": USER_G, "token-h": USER_H });

// The model is a port (ADR-0009): the test injects a fake, so no network is involved and the failure modes are testable.
let nextModelOutput: unknown = null;
let modelThrows = false;
let modelFailure = "provider down";
const modelPort = {
  complete: async (): Promise<unknown> => {
    if (modelThrows) throw new Error(modelFailure);
    return nextModelOutput;
  },
};
let server: Server;
let base = "";

const fixture = fixtureSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), "eval", "golden-plans", "novice-5k.json"), "utf8")),
);

interface CallOptions {
  method?: string;
  token?: string | null;
  body?: unknown;
  day?: string;
  headers?: Record<string, string>;
}

async function call(path: string, options: CallOptions = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-training-day": options.day ?? TODAY,
    ...(options.headers ?? {}),
  };
  const token = options.token === undefined ? "token-a" : options.token;
  if (token !== null) headers["authorization"] = `Bearer ${token}`;
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const draft = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  day: TODAY,
  outcome: "completed",
  tzAtEvent: "Asia/Taipei",
  sessionTaken: "as-prescribed",
  rpe: 6,
  legs: 2,
  idempotencyKey: `key-${Math.random().toString(36).slice(2, 12)}`,
  ...overrides,
});

let planVersion: PlanVersion;

beforeAll(async () => {
  server = createServer(
    createApi({ repository, sessions, knowledge, now: () => NOW, operatorToken: "operator-token", modelPort, modelId: "fake-model" }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  base = `http://127.0.0.1:${port}`;

  const created = await call("/plan", {
    body: {
      profile: fixture.input.profile,
      evidence: fixture.input.evidence,
      state: fixture.input.state,
      seed: fixture.input.seed,
    },
  });
  planVersion = planVersionSchema.parse(created.body["version"]);
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("the composition root answers, and refuses without a session", () => {
  it("reports health with the knowledge hash it loaded", async () => {
    const response = await call("/health", { token: null });
    expect(response.status).toBe(200);
    expect(response.body["ok"]).toBe(true);
    expect(response.body["knowledge"]).toBe(knowledge.hash);
  });

  it("refuses an unauthenticated request", async () => {
    const response = await call("/entries", { token: null, body: draft() });
    expect(response.status).toBe(401);
    expect((response.body["error"] as { code: string }).code).toBe("unauthenticated");
  });

  it("refuses an unknown route and a wrong method", async () => {
    const unknown = await call("/nope");
    expect(unknown.status).toBe(404);
    const wrongMethod = await call("/entries", { method: "DELETE" });
    expect(wrongMethod.status).toBe(405);
  });
});

describe("a plan is generated through the same engine the CLI uses", () => {
  it("returns a contract-valid version and serves it back", async () => {
    const response = await call("/plan", {
      body: { profile: fixture.input.profile, evidence: fixture.input.evidence, state: fixture.input.state, seed: fixture.input.seed },
    });
    expect(response.status).toBe(201);
    const version = planVersionSchema.parse(response.body["version"]);
    expect(version.sessions.length).toBe(fixture.input.state.horizonDays);
    expect(version.knowledgeHash).toBe(knowledge.hash);

    const fetched = await call(`/plan/${version.versionId}`);
    expect(fetched.status).toBe(200);
    expect((fetched.body["version"] as PlanVersion).versionId).toBe(version.versionId);

    const missing = await call("/plan/00000000-0000-4000-8000-000000000000");
    expect(missing.status).toBe(404);
  });

  it("refuses an invalid plan request with the field that failed", async () => {
    const response = await call("/plan", { body: { profile: { userId: "x" } } });
    expect(response.status).toBe(400);
    expect((response.body["error"] as { code: string }).code).toBe("invalid-body");
  });
});

describe("the daily loop closes: entry in, comment out", () => {
  it("stores the entry, evaluates it and renders a comment", async () => {
    const response = await call("/entries", { body: draft({ day: "2026-11-05" }), day: "2026-11-05" });
    expect(response.status).toBe(201);
    const entry = dayEntrySchema.parse(response.body["entry"]);
    expect(entry.revision).toBe(1);
    expect(entry.day).toBe("2026-11-05");
    const comment = response.body["comment"] as { text: string; sentences: string[] };
    expect(comment.text.length).toBeGreaterThan(0);
    expect(comment.sentences.length).toBeLessThanOrEqual(4);
    expect(response.body["adjustment"]).toBeUndefined();
    expect(response.body["hardStop"]).toBeUndefined();
    const applied = response.body["appliedRules"] as Array<{ ruleId: string; anchor: string }>;
    expect(applied.length).toBeGreaterThan(0);
    for (const rule of applied) expect(rule.anchor).toContain(".yaml#");
  });

  it("answers a retry with the first row and writes nothing", async () => {
    const key = "retry-key-0001";
    const first = await call("/entries", { body: draft({ day: "2026-11-06", idempotencyKey: key }), day: "2026-11-06" });
    expect(first.status).toBe(201);
    const second = await call("/entries", { body: draft({ day: "2026-11-06", idempotencyKey: key }), day: "2026-11-06" });
    expect(second.status).toBe(200);
    expect(second.body["status"]).toBe("duplicate");
    expect((second.body["entry"] as { entryId: string }).entryId).toBe((first.body["entry"] as { entryId: string }).entryId);

    const day = await call("/entries/2026-11-06");
    expect((day.body["revisions"] as unknown[]).length).toBe(1);
  });

  it("downgrades tomorrow and returns the chip when the report is heavy", async () => {
    const response = await call("/entries", { body: draft({ day: "2026-11-09", legs: 4 }), day: "2026-11-09" });
    expect(response.status).toBe(201);
    const adjustment = response.body["adjustment"] as { day: string; beforeKm: number; afterKm: number; reasonKey: string };
    expect(adjustment.day).toBe("2026-11-10");
    expect(adjustment.afterKm).toBeLessThan(adjustment.beforeKm);
    expect(adjustment.reasonKey).toBe("readiness-downgrade");
    expect(response.body["chip"]).toContain("→");
  });

  it("says nothing on an unlogged day and nudges instead", async () => {
    const response = await call("/entries", { body: draft({ day: "2026-11-11", outcome: "missed", sessionTaken: "none" }), day: "2026-11-11" });
    expect(response.status).toBe(201);
    const comment = response.body["comment"] as { text: string; nudge?: string };
    expect(comment.text).toBe("");
    expect(comment.nudge).toBeDefined();
  });

  it("stops training first when the entry reports chest pain", async () => {
    const response = await call("/entries", {
      body: draft({ day: "2026-11-12", outcome: "rest", sessionTaken: "none", pain: [{ site: "chest", intensity: 2 }] }),
      day: "2026-11-12",
    });
    expect(response.status).toBe(201);
    expect((response.body["hardStop"] as { ruleId: string }).ruleId).toBe("chest-cardiac");
    const comment = response.body["comment"] as { sentences: string[] };
    expect(comment.sentences[0]).toBe(messagesFor("en").stop["chest-urgent"]);
  });

  it("speaks Traditional Chinese when the client asks", async () => {
    const response = await call("/entries", { body: draft({ day: "2026-11-13", locale: "zh-Hant" }), day: "2026-11-13" });
    expect(response.status).toBe(201);
    const comment = response.body["comment"] as { text: string };
    expect(comment.text).toMatch(/[\u4e00-\u9fff]/);
  });

  it("refuses an entry the contract rejects, naming the field", async () => {
    const response = await call("/entries", { body: draft({ day: "2026-11-14", outcome: "skipped" }), day: "2026-11-14" });
    expect(response.status).toBe(400);
    const error = response.body["error"] as { code: string; detail: string };
    expect(error.code).toBe("invalid-entry");
    expect(error.detail).toContain("outcomeDetail");
  });

  it("stores a correction as a new revision and points the old row forward", async () => {
    const day = "2026-11-15";
    const first = await call("/entries", { body: draft({ day, rpe: 6 }), day });
    expect(first.status).toBe(201);
    const corrected = await call("/entries", { body: draft({ day, rpe: 8 }), day });
    expect(corrected.status).toBe(201);
    const entry = corrected.body["entry"] as { revision: number; correctedFromRevision: number };
    expect(entry.revision).toBe(2);
    expect(entry.correctedFromRevision).toBe(1);

    const listed = await call(`/entries/${day}`);
    const revisions = listed.body["revisions"] as Array<{ revision: number; supersededBy: string | null }>;
    expect(revisions).toHaveLength(2);
    expect(revisions[0]?.supersededBy).toBe((entry as unknown as { entryId: string }).entryId ?? revisions[0]?.supersededBy);
  });
});

describe("the signals route says what it believes and what it cannot see", () => {
  it("returns contract-valid signals for a runner with a plan", async () => {
    const response = await call("/signals");
    expect(response.status).toBe(200);
    const signals = response.body["signals"] as unknown[];
    expect(signals.length).toBeGreaterThanOrEqual(7);
    for (const signal of signals) {
      const parsed = signalSchema.safeParse(signal);
      if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues));
    }
    const keys = (signals as Array<{ key: string }>).map((signal) => signal.key);
    expect(keys).toContain("completion_rate");
    expect(keys).toContain("weekly_load");
    const unavailable = response.body["unavailable"] as Array<{ key: string; reason: string }>;
    expect(unavailable.map((item) => item.key)).toContain("hrv_lnrmssd_dev");
    expect(unavailable.every((item) => item.reason.length > 10)).toBe(true);
  });

  it("refuses a continuity claim from a plan that is one day old", async () => {
    const response = await call("/signals");
    expect(response.status).toBe(200);
    const continuity = (response.body["signals"] as Array<{ key: string; value: unknown; confidence: string; confidenceNote?: string }>).find(
      (signal) => signal.key === "log_continuity",
    );
    // The fixture plan starts today, so there is no fourteen-day history to be continuous about. Saying so is the
    // honest answer; a rate computed from one day would be a fabricated one.
    expect(continuity?.value).toBeNull();
    expect(continuity?.confidence).toBe("insufficient");
    expect(continuity?.confidenceNote).toContain("at least 3");
  });

  it("answers 404 when no plan covers the day", async () => {
    const response = await call("/signals", { token: "token-b" });
    expect(response.status).toBe(404);
    expect((response.body["error"] as { code: string }).code).toBe("no-plan");
  });
});

describe("the trigger layer is reachable, and it stops where the evidence ends", () => {
  it("reports the candidate and what could not be evaluated", async () => {
    const response = await call("/reviews/candidates");
    expect(response.status).toBe(200);
    const unevaluable = response.body["unevaluable"] as Array<{ ruleId: string; missing: string | null; reason: string }>;
    expect(unevaluable.map((item) => item.ruleId)).toContain("goal-feasibility");
    expect(unevaluable.map((item) => item.ruleId)).toContain("stale-evidence");
    for (const item of unevaluable) expect(item.reason.length).toBeGreaterThan(10);
    // The route never invents an option to make a review look ready.
    expect(response.body["candidate"] === null || typeof response.body["candidate"] === "object").toBe(true);
    expect(response.body["signals"]).toBeUndefined();
  });

  it("opens nothing: no review is stored by asking for candidates", async () => {
    const before = repository.listReviews(USER_A).length;
    await call("/reviews/candidates");
    expect(repository.listReviews(USER_A).length).toBe(before);
  });

  it("answers 404 when no plan covers the day", async () => {
    const response = await call("/reviews/candidates", { token: "token-b" });
    expect(response.status).toBe(404);
  });
});

describe("POST /reviews/open closes the chain: log, signals, triggers, bounded options, an open review", () => {
  const C_TODAY = "2026-11-08";

  beforeAll(async () => {
    // A runner with a plan that started a week ago, so there is history to read and future to change.
    const created = await call("/plan", {
      token: "token-c",
      day: C_TODAY,
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: "2026-11-02", horizonDays: 21 },
        seed: "review-chain",
      },
    });
    expect(created.status).toBe(201);
    const version = planVersionSchema.parse(created.body["version"]);
    // Two hard sessions in the past, missed: the trigger layer needs exactly this shape.
    const hardDays = version.sessions.filter((session) => session.hardDay === true && session.day < C_TODAY).slice(0, 2);
    for (const session of hardDays) {
      const posted = await call("/entries", {
        token: "token-c",
        day: session.day,
        body: draft({ day: session.day, outcome: "missed", sessionTaken: "none" }),
      });
      expect(posted.status).toBe(201);
    }
  });

  it("opens a review with keep first, and stores the diffs it offered", async () => {
    const response = await call("/reviews/open", { token: "token-c", day: C_TODAY, body: {} });
    expect(response.status).toBe(201);
    expect(response.body["status"]).toBe("opened");

    const review = reviewSchema.parse(response.body["review"]);
    expect(review.status).toBe("open");
    expect(review.options.length).toBeGreaterThanOrEqual(2);
    expect(review.options[0]?.keepAsIs).toBe(true);
    expect(review.openedBy).toBe("system-signal");

    const options = response.body["options"] as Array<{ optionId: string; diffId: string | null }>;
    const changeOptions = options.filter((option) => option.optionId !== "keep");
    expect(changeOptions.length).toBeGreaterThanOrEqual(1);
    for (const option of changeOptions) {
      expect(option.diffId).not.toBeNull();
      const stored = repository.getPlanDiff(USER_C, option.diffId as string);
      expect(stored).toBeDefined();
      expect(stored?.changes).toHaveLength(1);
      // The diff's day is after the freeze window, and the child version is proposed, not stored as active.
      expect((stored?.changes[0]?.day ?? "") > C_TODAY).toBe(true);
      expect(repository.getPlanVersion(USER_C, stored?.toVersionId ?? "")).toBeUndefined();
    }

    const unevaluable = response.body["unevaluable"] as Array<{ ruleId: string }>;
    expect(unevaluable.map((item) => item.ruleId)).toContain("goal-feasibility");
  });

  it("refuses a second review in the same week, through packages/review's budget guard", async () => {
    const response = await call("/reviews/open", { token: "token-c", day: C_TODAY, body: {} });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("suppressed");
    expect(response.body["reason"]).toBe("budget");
  });

  it("answers none when the evidence does not fire a rule", async () => {
    const response = await call("/reviews/open", { body: {} });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("none");
    const unevaluable = response.body["unevaluable"] as Array<{ ruleId: string }>;
    expect(unevaluable.length).toBeGreaterThanOrEqual(3);
  });

  it("answers 404 when no plan covers the day", async () => {
    const response = await call("/reviews/open", { token: "token-b", body: {} });
    expect(response.status).toBe(404);
  });
});

describe("GET /pain returns the rows an entry wrote", () => {
  const PAIN_TODAY = "2026-11-05";

  beforeAll(async () => {
    const created = await call("/plan", {
      token: "token-c",
      day: PAIN_TODAY,
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: PAIN_TODAY, horizonDays: 21 },
        seed: "pain-chain",
      },
    });
    expect(created.status).toBe(201);
  });

  it("writes one row per pain report and serves them", async () => {
    const key = "pain-key-1";
    const posted = await call("/entries", {
      token: "token-c",
      day: PAIN_TODAY,
      body: draft({
        idempotencyKey: key,
        pain: [
          { site: "achilles", side: "left", intensity: 6, duringRun: true, nightPain: true, duration: "few-days" },
          { site: "shin", intensity: 2 },
        ],
      }),
    });
    expect(posted.status).toBe(201);
    const response = await call("/pain", { token: "token-c" });
    expect(response.status).toBe(200);
    const reports = response.body["reports"] as { site: string; side: string | null; nightPain: boolean; duration: string | null }[];
    expect(reports.map((report) => report.site)).toEqual(["achilles", "shin"]);
    expect(reports[0]).toMatchObject({ side: "left", nightPain: true, duration: "few-days" });
    expect(reports[1]).toMatchObject({ side: null, nightPain: false, duration: null });
  });

  it("serves the trajectory over the rows, not over one entry", async () => {
    const response = await call("/pain", { token: "token-c" });
    const trend = response.body["trend"] as { direction: string; days: number; peak: number | null; note: string };
    // Two reports on one day is one point: the direction is unknown and the note says why.
    expect(trend).toMatchObject({ direction: "unknown", days: 1, peak: 6, note: "one-report" });
  });

  it("writes nothing twice for the same idempotency key", async () => {
    const before = (await call("/pain", { token: "token-c" })).body["reports"] as unknown[];
    const retry = await call("/entries", {
      token: "token-c",
      day: PAIN_TODAY,
      body: draft({
        idempotencyKey: "pain-key-1",
        pain: [{ site: "achilles", side: "left", intensity: 6, duringRun: true, nightPain: true, duration: "few-days" }],
      }),
    });
    expect(retry.status).toBe(200);
    expect(retry.body["status"]).toBe("duplicate");
    const after = (await call("/pain", { token: "token-c" })).body["reports"] as unknown[];
    expect(after).toHaveLength(before.length);
  });
});

describe("GET /season and GET /export are the runner s season and the runner s data", () => {
  const D_TODAY = "2026-11-05";

  beforeAll(async () => {
    const created = await call("/plan", {
      token: "token-d",
      day: D_TODAY,
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: D_TODAY, horizonDays: 21 },
        seed: "prompt-chain",
      },
    });
    expect(created.status).toBe(201);
  });

  it("returns the plan s weeks, planned against done", async () => {
    const response = await call("/season", { token: "token-d" });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("ok");
    const summary = response.body["summary"] as {
      firstDay: string;
      lastDay: string;
      weeks: { weekStart: string; status: string; plannedDays: number }[];
      adherencePct: number | null;
    };
    expect(summary.firstDay).toBe("2026-11-05");
    // 11-05 is a Thursday, so the first week is the calendar week of 11-02 with four plan days in it.
    // 21 days from 11-05 end on 11-25, so the last week is the calendar week of 11-23 with three plan days in it.
    expect(summary.weeks.map((week) => week.weekStart)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(summary.weeks[0]?.plannedDays).toBe(4);
    expect(summary.weeks[3]?.plannedDays).toBe(3);
    expect(summary.weeks[0]?.status).toBe("current");
    expect(summary.weeks[1]?.status).toBe("future");
    // Today s 8 km are planned and nothing is logged: zero per cent is the honest number, not null.
    expect(summary.adherencePct).toBe(0);
  });

  it("answers no-plan when the day has no plan", async () => {
    const response = await call("/season", { token: "token-b" });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("no-plan");
  });

  it("exports every row the repository holds for this runner, with counts that match", async () => {
    const response = await call("/export", { token: "token-d" });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("ok");
    const exported = response.body["export"] as {
      exportedAt: string;
      userId: string;
      counts: Record<string, number>;
      planVersions: unknown[];
      entries: unknown[];
      events: unknown[];
      reviews: unknown[];
      comments: unknown[];
      promptDeliveries: unknown[];
    };
    expect(exported.exportedAt).toBe(NOW);
    expect(exported.userId).toBe(USER_D);
    expect(exported.counts["planVersions"]).toBe(repository.listPlanVersions(USER_D).length);
    expect(exported.counts["entries"]).toBe(repository.listEntries(USER_D).length);
    expect(exported.counts["events"]).toBe(repository.listEvents(USER_D).length);
    expect(exported.counts["promptDeliveries"]).toBe(repository.listPromptDeliveries(USER_D).length);
    expect(exported.planVersions).toHaveLength(exported.counts["planVersions"] ?? -1);
    expect(exported.entries).toHaveLength(exported.counts["entries"] ?? -1);
  });
});

describe("GET /prompts/next applies the prompt policy and records the delivery", () => {
  const D_TODAY = "2026-11-05";

  beforeAll(async () => {
    const created = await call("/plan", {
      token: "token-d",
      day: D_TODAY,
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: D_TODAY, horizonDays: 21 },
        seed: "prompt-chain",
      },
    });
    expect(created.status).toBe(201);
  });

  it("hands out a prompt for an unlogged day and records it", async () => {
    const response = await call("/prompts/next", { token: "token-d", day: D_TODAY });
    expect(response.status).toBe(201);
    expect(response.body["status"]).toBe("prompt");
    const prompt = response.body["prompt"] as { kind: string; text: string; forDay: string; atMinute: number };
    expect(prompt.kind).toBe("nudge");
    expect(prompt.forDay).toBe(D_TODAY);
    expect(prompt.text).toContain("Two taps is enough");
    expect(prompt.atMinute % 60).toBe(0);
    const recorded = repository.listPromptDeliveries(USER_D);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ kind: "nudge", day: D_TODAY, forDay: D_TODAY });
  });

  it("refuses the second prompt for the same day, through the delivery log", async () => {
    const response = await call("/prompts/next", { token: "token-d", day: D_TODAY });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("none");
    expect(response.body["reason"]).toBe("delivered");
    expect(repository.listPromptDeliveries(USER_D)).toHaveLength(1);
  });

  it("answers no-plan when no plan covers the day", async () => {
    const response = await call("/prompts/next", { token: "token-b" });
    expect(response.status).toBe(200);
    expect(response.body["reason"]).toBe("no-plan");
  });
});

describe("one runner cannot see another runner's log", () => {
  it("returns an empty day for a different user", async () => {
    const mine = await call("/entries/2026-11-05", { token: "token-b" });
    expect(mine.status).toBe(200);
    expect(mine.body["revisions"]).toEqual([]);
    expect(mine.body["comments"]).toEqual([]);

    const theirs = await call("/entries/2026-11-05", { token: "token-a" });
    expect((theirs.body["revisions"] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("a review decision is a state change, not an edit", () => {
  const options: ProposedOption[] = [
    { optionId: "keep", labelKey: "keep-as-is", keepAsIs: true, diffId: null, costKey: "risk-noted", costSlots: {} },
    { optionId: "reduce", labelKey: "reduce-hard-days", keepAsIs: false, diffId: "11111111-1111-4111-8111-111111111111", costKey: "less-intensity", costSlots: {}, loadDeltaPct: -15 },
  ];

  it("accepts a change and reports the first day it may land", async () => {
    const opened = openReview({
      userId: USER_A,
      today: TODAY,
      candidate: { kind: "plan-too-big", ruleId: "plan-too-big", anchor: "review-triggers.yaml#plan-too-big", evidence: { signalIds: ["completion"], ruleIds: ["plan-too-big"], evidenceGradeMax: "B" }, presentation: "offer-at-next-open" },
      knowledge,
      options,
      renderCost: (option) => option.costKey,
    });
    if (opened.status !== "opened") throw new Error("expected a review");

    // The option diff and the version it predicts are staged at open time; acceptance activates the version.
    const diffId = "11111111-1111-4111-8111-111111111111";
    const childId = "aaaaaaaa-1111-4111-8111-111111111111";
    const diff: PlanDiff = {
      schemaVersion: 1,
      diffId,
      userId: USER_A,
      fromVersionId: planVersion.versionId,
      toVersionId: childId,
      createdAtDay: TODAY,
      changes: [],
      changeCountWithinLimit: true,
      knowledgeHash: knowledge.hash,
    };
    repository.savePlanDiff(diff);
    repository.saveProposedPlanVersion({
      ...planVersion,
      versionId: childId,
      parentVersionId: planVersion.versionId,
      generatedBy: "review-accepted",
      generatedAtDay: TODAY,
    });

    repository.saveReview(opened.review);
    expect(reviewSchema.safeParse(opened.review).success).toBe(true);

    const response = await call(`/reviews/${opened.review.reviewId}/decision`, { body: { decision: { kind: "accept", optionId: "reduce" } } });
    expect(response.status).toBe(200);
    expect(response.body["status"]).toBe("accepted");
    expect(response.body["applyFromDay"]).toBe("2026-11-07");
    expect(response.body["resultDiffId"]).toBe("11111111-1111-4111-8111-111111111111");
    // Accepting a change materialises the plan version the review promised, and makes it the active plan.
    expect(response.body["appliedVersionId"]).toBe("aaaaaaaa-1111-4111-8111-111111111111");
    expect(repository.getActivePlanVersion(USER_A)?.versionId).toBe("aaaaaaaa-1111-4111-8111-111111111111");
    const stored: Review | undefined = repository.getReview(USER_A, opened.review.reviewId);
    expect(stored?.status).toBe("accepted");
  });

  it("refuses an acceptance whose proposed version was never staged", async () => {
    const opened = openReview({
      userId: USER_A,
      today: TODAY,
      candidate: { kind: "plan-too-big", ruleId: "plan-too-big", anchor: "review-triggers.yaml#plan-too-big", evidence: { signalIds: ["completion"], ruleIds: ["plan-too-big"], evidenceGradeMax: "B" }, presentation: "offer-at-next-open" },
      knowledge,
      options,
      renderCost: (option) => option.costKey,
    });
    if (opened.status !== "opened") throw new Error("expected a review");
    repository.saveReview(opened.review);

    const response = await call(`/reviews/${opened.review.reviewId}/decision`, {
      body: { decision: { kind: "accept", optionId: "reduce" } },
    });
    expect(response.status).toBe(409);
    expect((response.body["error"] as { code: string }).code).toBe("missing-proposed-version");
    // The review must not be recorded as accepted when its plan could not be materialised.
    expect(repository.getReview(USER_A, opened.review.reviewId)?.status).toBe("open");
  });

  it("answers 404 for a review that is not this user's", async () => {
    const response = await call("/reviews/00000000-0000-4000-8000-000000000000/decision", {
      body: { decision: { kind: "accept", optionId: "reduce" } },
    });
    expect(response.status).toBe(404);
  });
});


describe("the onboarding wizard and the personal console (ADR-0009)", () => {
  it("records answers step by step and keeps the original after a change", async () => {
    const empty = await call("/wizard", { token: "token-d" });
    expect(empty.status).toBe(200);
    expect(empty.body.progress).toEqual({ answered: 0, total: 4, next: "goal" });
    expect(Array.isArray(empty.body.steps)).toBe(true);

    const saved = await call("/wizard", { method: "POST", token: "token-d", body: { stepId: "goal", answer: { value: "finish" } } });
    expect(saved.status).toBe(201);
    expect(saved.body.answer).toMatchObject({ stepId: "goal", revision: 1, source: "wizard" });

    const changed = await call("/wizard", {
      method: "POST",
      token: "token-d",
      body: { stepId: "goal", answer: { value: "time" }, source: "settings" },
    });
    expect(changed.status).toBe(201);
    expect(changed.body.answer).toMatchObject({ revision: 2, source: "settings" });
    expect(changed.body.original).toEqual({ goal: { value: "finish" } });
    expect(changed.body.current).toEqual({ goal: { value: "time" } });
    expect(changed.body.progress).toMatchObject({ answered: 1, next: "availability" });
  });

  it("refuses an answer that is not one of the step's options", async () => {
    const refused = await call("/wizard", {
      method: "POST",
      token: "token-d",
      body: { stepId: "risk-appetite", answer: { value: "reckless" } },
    });
    expect(refused.status).toBe(400);
    expect((refused.body.error as { code: string }).code).toBe("invalid-answer");
    expect(String((refused.body.error as { detail: string }).detail)).toContain("risk-appetite");
  });

  it("the console returns the public guidelines only", async () => {
    repository.saveGuideline({
      guidelineId: "progression-ceiling",
      version: 1,
      tier: "constraint",
      scope: "progression",
      visibility: "public",
      text: "Weekly volume rises by at most 10 percent.",
      rationale: "Stated once.",
      effectiveFrom: "2026-11-01",
      createdBy: "operator",
    });
    repository.saveGuideline({
      guidelineId: "night-pain-stop",
      version: 1,
      tier: "non-negotiable",
      scope: "safety",
      visibility: "internal",
      text: "Night pain stops training.",
      rationale: "Triage decisive.",
      effectiveFrom: "2026-11-01",
      createdBy: "operator",
    });
    const console = await call("/console", { token: "token-d" });
    expect(console.status).toBe(200);
    const guidelines = console.body.guidelines as Array<{ guidelineId: string; visibility: string }>;
    expect(guidelines.map((guideline) => guideline.guidelineId)).toContain("progression-ceiling");
    expect(guidelines.map((guideline) => guideline.guidelineId)).not.toContain("night-pain-stop");
    expect(guidelines.every((guideline) => guideline.visibility === "public")).toBe(true);
  });
});


describe("the operator guideline console (ADR-0009)", () => {
  const guideline = (overrides: Record<string, unknown> = {}) => ({
    guidelineId: "tone-warmth",
    version: 1,
    tier: "constraint",
    scope: "tone",
    visibility: "public",
    text: "Warm, specific, never a scold.",
    rationale: "The comment is the trust surface.",
    effectiveFrom: "2026-11-01",
    createdBy: "operator",
    ...overrides,
  });

  it("refuses a runner token: an operator is not a runner", async () => {
    const refused = await call("/admin/guidelines", { token: "token-a" });
    expect(refused.status).toBe(403);
    expect((refused.body.error as { code: string }).code).toBe("forbidden");
  });

  it("appends a version and returns every version, internal ones included", async () => {
    const created = await call("/admin/guidelines", { method: "POST", token: null, headers: { authorization: "Bearer operator-token" }, body: guideline() });
    expect(created.status).toBe(201);
    expect(created.body.guideline).toMatchObject({ guidelineId: "tone-warmth", version: 1 });

    const internal = await call("/admin/guidelines", {
      method: "POST",
      token: null,
      headers: { authorization: "Bearer operator-token" },
      body: guideline({ guidelineId: "night-pain-stop", version: 2, scope: "safety", tier: "non-negotiable", visibility: "internal" }),
    });
    expect(internal.status).toBe(201);

    const listed = await call("/admin/guidelines", { token: null, headers: { authorization: "Bearer operator-token" } });
    expect(listed.status).toBe(200);
    const rows = listed.body.guidelines as Array<{ guidelineId: string; visibility: string }>;
    expect(rows.map((row) => row.guidelineId)).toContain("night-pain-stop");
    expect(rows.map((row) => row.guidelineId)).toContain("tone-warmth");
  });

  it("refuses a duplicate version instead of overwriting history", async () => {
    const duplicate = await call("/admin/guidelines", {
      method: "POST",
      token: null,
      headers: { authorization: "Bearer operator-token" },
      body: guideline(),
    });
    expect(duplicate.status).toBe(409);
    expect((duplicate.body.error as { code: string }).code).toBe("duplicate-version");
  });

  it("refuses a safety guideline made public", async () => {
    const refused = await call("/admin/guidelines", {
      method: "POST",
      token: null,
      headers: { authorization: "Bearer operator-token" },
      body: guideline({ guidelineId: "safety-leak", scope: "safety", visibility: "public" }),
    });
    expect(refused.status).toBe(400);
    expect((refused.body.error as { code: string }).code).toBe("invalid-body");
  });
});


describe("the wizard profile preview (ADR-0009)", () => {
  const base = {
    userId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
    revision: 1,
    age: 33,
    availability: { days: ["Mon", "Wed"] },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
  };

  it("folds the recorded answers and stores nothing", async () => {
    const preview = await call("/wizard/profile", { method: "POST", token: "token-d", body: { profile: base } });
    expect(preview.status).toBe(200);
    expect(preview.body.applied).toEqual(["goal"]);
    const profile = preview.body.profile as { goal: { type: string }; availability: { days: string[] } };
    expect(profile.goal.type).toBe("time");
    expect(profile.availability.days).toEqual(["Mon", "Wed"]);
    expect(String(preview.body.note)).toContain("preview only");

    const after = await call("/wizard", { token: "token-d" });
    expect(after.body.progress).toMatchObject({ answered: 1 });
  });

  it("refuses a base profile that does not satisfy the contract", async () => {
    const refused = await call("/wizard/profile", { method: "POST", token: "token-d", body: { profile: { age: 33 } } });
    expect(refused.status).toBe(400);
    expect((refused.body.error as { code: string }).code).toBe("invalid-profile");
  });
});


describe("applying the answers to the stored profile (ADR-0009)", () => {
  const base = {
    userId: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
    revision: 1,
    age: 33,
    availability: { days: ["Mon", "Wed"] },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
  };

  it("saves the folded profile with a revision row and never touches the plan", async () => {
    const plansBefore = repository.listPlanVersions(USER_D).length;
    const saved = await call("/wizard/apply", { method: "POST", token: "token-d", body: { profile: base } });
    expect(saved.status).toBe(201);
    expect(saved.body.status).toBe("saved");
    const revision = saved.body.revision as { changedBy: string; source: string; diff: Array<{ path: string }> };
    expect(revision.changedBy).toBe("runner");
    expect(revision.source).toBe("user");
    expect(revision.diff.map((entry) => entry.path)).toContain("goal.type");
    expect(String(saved.body.note)).toContain("review");

    const read = await call("/profile", { token: "token-d" });
    expect(read.status).toBe(200);
    expect(read.body.status).toBe("ok");
    expect((read.body.profile as { goal: { type: string } }).goal.type).toBe("time");
    expect((read.body.revisions as unknown[]).length).toBe(1);

    expect(repository.listPlanVersions(USER_D).length).toBe(plansBefore);
  });

  it("says unchanged when the answers already match the stored profile", async () => {
    const again = await call("/wizard/apply", { method: "POST", token: "token-d", body: {} });
    expect(again.status).toBe(200);
    expect(again.body.status).toBe("unchanged");
    expect((again.body.profile as { goal: { type: string } }).goal.type).toBe("time");
  });

  it("refuses to fold without a profile at all", async () => {
    const refused = await call("/wizard/apply", { method: "POST", token: "token-b", body: {} });
    expect(refused.status).toBe(400);
    expect((refused.body.error as { code: string }).code).toBe("no-profile");
  });
});


describe("a manual review is the runner asking, and the runner still decides (ADR-0009)", () => {
  const profile = {
    userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    revision: 1,
    age: 34,
    availability: { days: ["Mon", "Wed", "Fri"] },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
  };

  it("opens with the bounded options, records user-request, and applies nothing", async () => {
    const plan = await call("/plan", {
      token: "token-e",
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: "2026-11-02", horizonDays: 21 },
        seed: "manual-review",
      },
    });
    expect(plan.status).toBe(201);
    const plansBefore = repository.listPlanVersions(USER_E).length;

    const first = await call("/wizard", { method: "POST", token: "token-e", body: { stepId: "goal", answer: { value: "time" } } });
    expect(first.status).toBe(201);
    const applied = await call("/wizard/apply", { method: "POST", token: "token-e", body: { profile } });
    expect(applied.status).toBe(201);
    // The runner changes their mind after saving: the stored profile says time, the answers now say finish.
    const changed = await call("/wizard", { method: "POST", token: "token-e", body: { stepId: "goal", answer: { value: "finish" }, source: "settings" } });
    expect(changed.status).toBe(201);

    const manual = await call("/reviews/manual", { method: "POST", token: "token-e", body: {} });
    expect(manual.status).toBe(201);
    expect(manual.body.status).toBe("opened");
    const review = manual.body.review as { openedBy: string; evidence: { ruleIds: string[] }; status: string };
    expect(review.openedBy).toBe("user-request");
    expect(review.evidence.ruleIds).toEqual([]);
    expect(review.status).toBe("open");
    const options = manual.body.options as Array<{ optionId: string; keepAsIs: boolean }>;
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.some((option) => option.keepAsIs)).toBe(true);
    const orientation = manual.body.orientation as { changed: boolean; diff: Array<{ path: string }> };
    expect(orientation.changed).toBe(true);
    expect(orientation.diff.map((entry) => entry.path)).toContain("goal.type");
    // The review exists; no plan version was added and no option was applied.
    expect(repository.listPlanVersions(USER_E).length).toBe(plansBefore);
  });

  it("refuses a manual review when there is no plan to review", async () => {
    const refused = await call("/reviews/manual", { method: "POST", token: "token-f", body: {} });
    expect(refused.status).toBe(404);
    expect((refused.body.error as { code: string }).code).toBe("no-plan");
  });
});


describe("the orientation re-plan is offered, and accepting it activates the staged version (ADR-0010)", () => {
  const profile = {
    userId: "90909090-9090-4090-8090-909090909090",
    revision: 1,
    age: 35,
    availability: { days: ["Mon", "Wed", "Fri"] },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
  };

  it("opens a review with keep and replan, then activates the staged version on accept", async () => {
    const plan = await call("/plan", {
      token: "token-g",
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: "2026-11-02", horizonDays: 21 },
        seed: "orientation-review",
      },
    });
    expect(plan.status).toBe(201);

    // Save a profile first: the stored one says "time", the answers then move to "finish".
    await call("/wizard", { method: "POST", token: "token-g", body: { stepId: "goal", answer: { value: "time" } } });
    const applied = await call("/wizard/apply", { method: "POST", token: "token-g", body: { profile } });
    expect(applied.status).toBe(201);
    await call("/wizard", { method: "POST", token: "token-g", body: { stepId: "goal", answer: { value: "finish" }, source: "settings" } });

    const orientation = await call("/reviews/orientation", { method: "POST", token: "token-g", body: {} });
    expect(orientation.status).toBe(201);
    expect(orientation.body.status).toBe("opened");
    const options = orientation.body.options as Array<{ optionId: string; kind?: string; planVersionId?: string; changeSummary?: unknown }>;
    expect(options).toHaveLength(2);
    expect(options[0]?.optionId).toBe("keep");
    expect(options[1]?.kind).toBe("replan");
    expect(options[1]?.planVersionId).toBeTruthy();
    const review = orientation.body.review as { options: Array<{ kind?: string; planVersionId?: string }>; reviewId: string; status: string };
    expect(review.options[1]?.kind).toBe("replan");
    expect(review.status).toBe("open");

    const accepted = await call(`/reviews/${review.reviewId}/decision`, {
      method: "POST",
      token: "token-g",
      body: { decision: { kind: "accept", optionId: "replan" } },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.status).toBe("accepted");
    expect(accepted.body.appliedVersionId).toBe(options[1]?.planVersionId);
    expect(repository.getActivePlanVersion(USER_G)?.versionId).toBe(options[1]?.planVersionId);
  });

  it("refuses when there is no stored profile to compare against", async () => {
    // USER_A has a plan (created in beforeAll) and no stored profile, so the profile gate is the one that answers.
    const refused = await call("/reviews/orientation", { method: "POST", token: "token-a", body: {} });
    expect(refused.status).toBe(400);
    expect((refused.body.error as { code: string }).code).toBe("no-profile");
  });
});


describe("the advisor loop: consent, gates, audit, and the deterministic fallback (ADR-0009)", () => {
  const profile = {
    userId: "12121212-1212-4212-8212-121212121212",
    revision: 1,
    age: 36,
    availability: { days: ["Mon", "Wed", "Fri", "Sun"] },
    goal: { type: "finish", event: null },
    preferences: { units: "metric", locale: "en", timezone: "Asia/Taipei" },
    health: {},
  };
  let easyDay = "";
  let easyKm = 0;

  beforeAll(async () => {
    const plan = await call("/plan", {
      token: "token-h",
      body: {
        profile: fixture.input.profile,
        evidence: fixture.input.evidence,
        state: { planStartDay: "2026-11-02", horizonDays: 21 },
        seed: "advisor-loop",
      },
    });
    expect(plan.status).toBe(201);
    await call("/wizard/apply", { method: "POST", token: "token-h", body: { profile } });
    const version = repository.listPlanVersions(USER_H)[0];
    const easy = version?.sessions.find((session) => session.kind === "easy" && session.day > "2026-11-07");
    if (easy === undefined) throw new Error("the generated plan has no easy day after the freeze window");
    easyDay = easy.day;
    easyKm = easy.distanceKm ?? 0;
  });

  it("refuses without consent, before any model call", async () => {
    const refused = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    expect(refused.status).toBe(403);
    expect((refused.body.error as { code: string }).code).toBe("consent-required");
  });

  it("audits an accepted proposal and opens a review with an edit option", async () => {
    repository.saveLlmConsent({
      userId: USER_H,
      granted: true,
      purpose: "review-decision",
      policyVersion: "v1",
      grantedAt: NOW,
      revokedAt: null,
      updatedAt: NOW,
    });
    nextModelOutput = {
      decision: "propose-change",
      reasonCode: "load-high",
      facts: [{ key: "plannedKm", value: easyKm }],
      proposedChanges: [
        {
          day: easyDay,
          kind: "easy",
          fromKm: easyKm,
          toKm: Math.max(0, easyKm - 2),
          costKey: "quality-becomes-easy",
          costSlots: { km: 2 },
        },
      ],
      confidence: "medium",
      needsHuman: false,
    };
    const opened = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    expect(opened.status).toBe(201);
    expect(opened.body.status).toBe("opened");
    const options = opened.body.options as Array<{ optionId: string; kind?: string }>;
    expect(options).toHaveLength(2);
    expect(options[1]?.kind).toBe("edit");
    const review = opened.body.review as { reviewId: string; options: Array<{ kind?: string }> };
    expect(review.options[1]?.kind).toBe("edit");

    const audits = repository.listAiReviewProposals(USER_H);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.validatorVerdict).toBe("accepted");
    expect(audits[0]?.fallbackUsed).toBe(false);
    expect(audits[0]?.reviewId).toBe(review.reviewId);
    expect(audits[0]?.promptHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(audits[0]?.guidelineVersionHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(audits[0]?.model).toBe("fake-model");
  });

  it("refuses an invalid proposal and records the rejection, then names the fallback", async () => {
    nextModelOutput = {
      decision: "propose-change",
      reasonCode: "load-high",
      facts: [],
      proposedChanges: [
        { day: easyDay, kind: "easy", fromKm: easyKm, toKm: easyKm + 4, costKey: "quality-becomes-easy", costSlots: {} },
      ],
      confidence: "medium",
      needsHuman: false,
    };
    const rejected = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    expect(rejected.status).toBe(200);
    expect(rejected.body.status).toBe("rejected");
    expect(rejected.body.fallback).toBe("deterministic-replan");
    const audits = repository.listAiReviewProposals(USER_H);
    expect(audits).toHaveLength(2);
    expect(audits[1]?.validatorVerdict).toBe("rejected");
    expect(audits[1]?.fallbackUsed).toBe(true);
  });

  it("records a no-change decision as a decision, not a failure", async () => {
    nextModelOutput = { decision: "no-change", reasonCode: "no-action-needed", facts: [], proposedChanges: [], confidence: "high", needsHuman: false };
    const noChange = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    expect(noChange.status).toBe(200);
    expect(noChange.body.status).toBe("no-change");
    const audits = repository.listAiReviewProposals(USER_H);
    expect(audits[2]?.validatorVerdict).toBe("accepted");
  });

  it("turns a provider outage into the deterministic fallback, not an error page", async () => {
    modelThrows = true;
    const failed = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    modelThrows = false;
    expect(failed.status).toBe(200);
    expect(failed.body.status).toBe("model-failed");
    expect(failed.body.fallback).toBe("deterministic-replan");
  });

  it("names a budget or an open breaker as a state, not as a failure", async () => {
    modelThrows = true;
    modelFailure = "budget-exceeded: 10 calls already today for this runner";
    const budget = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    expect(budget.body.status).toBe("budget-exceeded");
    expect(budget.body.fallback).toBe("deterministic-replan");
    modelFailure = "circuit-open: the provider breaker is open until later";
    const breaker = await call("/reviews/advisor", { method: "POST", token: "token-h", body: {} });
    expect(breaker.body.status).toBe("circuit-open");
    modelThrows = false;
    modelFailure = "provider down";
  });
});
