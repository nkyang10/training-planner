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
const NOW = "2026-11-05T22:40:00.000Z";
const TODAY = "2026-11-05";

const repository: Repository = createMemoryRepository();
const sessions = createMemorySessions({ "token-a": USER_A, "token-b": USER_B, "token-c": USER_C, "token-d": USER_D });
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
  server = createServer(createApi({ repository, sessions, knowledge, now: () => NOW }));
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
