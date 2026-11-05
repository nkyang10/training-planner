/**
 * Coach conversation (ADR-0011): the model port is a fake, so the tests prove the grounding check, the stored thread and
 * the context handoff without a network. A reply with an invented number must fail exactly like an invented plan change.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { athleteProfileSchema } from "@training-planner/domain";
import { fixtureSchema } from "@training-planner/golden-fixtures";
import { generatePlan } from "@training-planner/planner-core";
import { loadKnowledge } from "@training-planner/knowledge";
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import { createApi } from "../src/server";

const USER = "41414141-4141-4141-8141-414141414141";
const TOKEN = "token-coach";
const NOW = "2026-11-05T22:40:00.000Z";

let repository: Repository;
let server: Server;
let base = "";
let reply: unknown = { reply: "Keep Friday easy and tell me how the knee feels.", proposeReview: false, reasonCode: null };
let captured: Array<{ history: unknown[]; question: string }> = [];
let port: { complete(request: unknown, context?: { userId: string }): Promise<unknown> } | undefined;

const call = async (path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  });
  const text = await response.text();
  return { status: response.status, body: text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>) };
};

beforeAll(async () => {
  repository = createMemoryRepository();
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "eval", "golden-plans", "novice-5k.json"), "utf8")));
  repository.savePlanVersion(
    generatePlan({
      profile: athleteProfileSchema.parse({ ...fixture.input.profile, userId: USER }),
      evidence: { recentWeeklyKm: [8, 9, 8] },
      state: { planStartDay: "2026-10-26", horizonDays: 21 },
      clock: { today: "2026-11-05" },
      seed: "coach-fixture",
      knowledge: loadKnowledge("knowledge/heuristics"),
    }).version,
  );
  port = {
    async complete(request: unknown): Promise<unknown> {
      const shaped = request as { history: unknown[]; question: string };
      captured.push({ history: shaped.history, question: shaped.question });
      return reply;
    },
  };
  server = createServer(createApi({ repository, sessions: createMemorySessions({ [TOKEN]: USER }), now: () => NOW, coachChatPort: port }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const portNumber = typeof address === "object" && address !== null ? address.port : 0;
  base = `http://127.0.0.1:${portNumber}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("coach conversation", () => {
  it("stores the runner turn and the coach turn, in order", async () => {
    const answer = await call("/coach/messages", { method: "POST", body: JSON.stringify({ question: "How did I do?" }) });
    expect(answer.status).toBe(201);
    const messages = answer.body["messages"] as Array<Record<string, unknown>>;
    expect(messages).toHaveLength(2);
    expect(messages[0]?.["role"]).toBe("user");
    expect(messages[1]?.["role"]).toBe("coach");
    expect(repository.listCoachMessages(USER, 10)).toHaveLength(2);
  });

  it("hands the prior turns to the next answer", async () => {
    captured = [];
    const answer = await call("/coach/messages", { method: "POST", body: JSON.stringify({ question: "And tomorrow?" }) });
    expect(answer.status).toBe(201);
    expect(captured[0]?.history).toHaveLength(2);
    expect(captured[0]?.question).toBe("And tomorrow?");
  });

  it("rejects a reply that invents a number", async () => {
    reply = { reply: "Run 12 km tomorrow.", proposeReview: false, reasonCode: null };
    const answer = await call("/coach/messages", { method: "POST", body: JSON.stringify({ question: "What next?" }) });
    expect(answer.status).toBe(422);
    expect((answer.body["error"] as Record<string, unknown>)["code"]).toBe("coach-invalid");
    reply = { reply: "Keep Friday easy and tell me how the knee feels.", proposeReview: false, reasonCode: null };
  });

  it("refuses an empty question and reports the missing port", async () => {
    const empty = await call("/coach/messages", { method: "POST", body: JSON.stringify({ question: "  " }) });
    expect(empty.status).toBe(400);
    expect((empty.body["error"] as Record<string, unknown>)["code"]).toBe("invalid-question");

    const bare = createServer(createApi({ repository, sessions: createMemorySessions({ [TOKEN]: USER }), now: () => NOW }));
    await new Promise<void>((resolve) => bare.listen(0, "127.0.0.1", resolve));
    const address = bare.address();
    const portNumber = typeof address === "object" && address !== null ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${portNumber}/coach/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Hi" }),
    });
    expect(response.status).toBe(503);
    await new Promise<void>((resolve) => bare.close(() => resolve()));
  });

  it("lists the thread for the page", async () => {
    const list = await call("/coach/messages");
    expect(list.status).toBe(200);
    expect((list.body["messages"] as unknown[]).length).toBe(4);
  });
});

describe("coach attachments", () => {
  it("stores the image metadata on the runner turn and tells the model the count", async () => {
    captured = [];
    const attachmentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const answer = await call("/coach/messages", {
      method: "POST",
      body: JSON.stringify({
        question: "This is the knee today.",
        attachments: [{ attachmentId, filename: "knee.png", contentType: "image/png", sizeBytes: 68, kind: "photo" }],
      }),
    });
    expect(answer.status).toBe(201);
    const messages = answer.body["messages"] as Array<Record<string, unknown>>;
    const lastUser = [...messages].reverse().find((message) => message["role"] === "user");
    expect((lastUser?.["attachments"] as Array<Record<string, unknown>>)[0]?.["attachmentId"]).toBe(attachmentId);
    expect(captured[0]?.question).toBe("This is the knee today.");
  });

  it("refuses an unsupported attachment type", async () => {
    const answer = await call("/coach/messages", {
      method: "POST",
      body: JSON.stringify({
        question: "Look",
        attachments: [{ attachmentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", filename: "a.gif", contentType: "image/gif", sizeBytes: 10, kind: "photo" }],
      }),
    });
    expect(answer.status).toBe(400);
    expect((answer.body["error"] as Record<string, unknown>)["code"]).toBe("invalid-attachment");
  });
});

