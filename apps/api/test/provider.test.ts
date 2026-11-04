/**
 * The HTTP model port's tests, against a local stub provider (a real http.Server, no external network).
 *
 * What is being measured is not "fetch works": it is the behaviour a deployment depends on - the request shape the
 * provider receives, the parse, the timeout, the per-runner budget, and the breaker that stops an outage from becoming
 * a retry storm. Each of those is a way the product could lie to a runner, so each has a test.
 */
import { createServer, type IncomingMessage, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AdvisorCall } from "@training-planner/advisor";
import { chatCompletionsUrl, createHttpModelPort, modelPortFromEnv, ProviderError } from "../src/provider";

/** A minimal call: the port only serialises `request` and hashes nothing itself. */
const call = (): AdvisorCall =>
  ({
    request: {
      system: { guidelines: [{ guidelineId: "tone-warmth", version: 1, text: "warm" }], rules: ["never invent a number"] },
      runner: {},
      context: { today: "2026-11-05" },
      vocabulary: {},
    },
    hashes: {
      guidelineVersionHash: "sha256:" + "0".repeat(64),
      promptHash: "sha256:" + "1".repeat(64),
      knowledgeHash: "sha256:" + "2".repeat(64),
    },
  }) as unknown as AdvisorCall;

let server: Server;
let base = "";
let mode: "ok" | "error" | "delay" | "bad-json" = "ok";
let requests: Array<{ body: Record<string, unknown>; headers: IncomingMessage["headers"] }> = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({ body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>, headers: request.headers });
      if (mode === "error") {
        response.writeHead(500, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "provider down" }));
        return;
      }
      if (mode === "bad-json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ choices: [{ message: { content: "not json" } }] }));
        return;
      }
      const send = (): void => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ decision: "no-change", reasonCode: "no-action-needed" }) } }] }));
      };
      if (mode === "delay") setTimeout(send, 150);
      else send();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const port = (overrides: Partial<Parameters<typeof createHttpModelPort>[0]> = {}, now?: () => number) =>
  createHttpModelPort(
    { endpoint: `${base}/v1/chat/completions`, apiKey: "test-key", model: "test-model", ...overrides },
    now === undefined ? {} : { now },
  );

describe("the port posts the request the contract says, and parses the answer", () => {
  it("sends the model, the system rules and the bearer token, then returns the parsed JSON", async () => {
    mode = "ok";
    requests = [];
    const output = await port().complete(call(), { userId: "user-1" });
    expect(output).toEqual({ decision: "no-change", reasonCode: "no-action-needed" });
    expect(requests).toHaveLength(1);
    const sent = requests[0];
    expect(sent?.body["model"]).toBe("test-model");
    expect(sent?.headers["authorization"]).toBe("Bearer test-key");
    const messages = sent?.body["messages"] as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("never invent a number");
    expect(messages[0]?.content).toContain("proposedChanges");
    expect(messages[0]?.content).toContain("reasonCode");
    expect(messages[0]?.content).toContain("costSlots is always an OBJECT");
    expect(messages[1]?.content).toContain("guidelineVersionHash" in (JSON.parse(messages[1]?.content ?? "{}") as object) ? "x" : "guidelineId");
  });

  it("refuses to call without the runner id the budget needs", async () => {
    await expect(port().complete(call())).rejects.toMatchObject({ code: "missing-context" });
  });

  it("names an http failure instead of returning it as an answer", async () => {
    mode = "error";
    await expect(port().complete(call(), { userId: "user-1" })).rejects.toMatchObject({ code: "http-error" });
  });

  it("names a provider that answered prose where JSON was promised", async () => {
    mode = "bad-json";
    await expect(port().complete(call(), { userId: "user-1" })).rejects.toMatchObject({ code: "invalid-json" });
  });

  it("times out instead of hanging the request", async () => {
    mode = "delay";
    await expect(port({ timeoutMs: 30 }).complete(call(), { userId: "user-1" })).rejects.toMatchObject({ code: "timeout" });
    mode = "ok";
  });
});

describe("the budget is per runner per day, and it is a state, not a crash", () => {
  it("allows the configured number of calls and refuses the next one", async () => {
    mode = "ok";
    let nowMs = Date.parse("2026-11-05T10:00:00.000Z");
    const budgeted = port({ maxCallsPerDayPerUser: 2 }, () => nowMs);
    await budgeted.complete(call(), { userId: "budget-user" });
    await budgeted.complete(call(), { userId: "budget-user" });
    expect(budgeted.budgetRemaining("budget-user", nowMs)).toBe(0);
    await expect(budgeted.complete(call(), { userId: "budget-user" })).rejects.toMatchObject({ code: "budget-exceeded" });
    // The next day is a new budget, not a permanent lock.
    nowMs += 24 * 60 * 60 * 1000;
    expect(budgeted.budgetRemaining("budget-user", nowMs)).toBe(2);
    await budgeted.complete(call(), { userId: "budget-user" });
  });

  it("keeps one runner's spending away from another's", async () => {
    mode = "ok";
    const nowMs = Date.parse("2026-11-05T10:00:00.000Z");
    const budgeted = port({ maxCallsPerDayPerUser: 1 }, () => nowMs);
    await budgeted.complete(call(), { userId: "a" });
    await budgeted.complete(call(), { userId: "b" });
    expect(budgeted.budgetRemaining("a", nowMs)).toBe(0);
    expect(budgeted.budgetRemaining("b", nowMs)).toBe(0);
  });
});

describe("the breaker opens on repeated failure and closes after the cooldown", () => {
  it("stops calling the provider once the threshold is reached, then recovers", async () => {
    mode = "error";
    requests = [];
    let nowMs = Date.parse("2026-11-05T10:00:00.000Z");
    const guarded = port({ failureThreshold: 2, cooldownMs: 1_000 }, () => nowMs);

    await expect(guarded.complete(call(), { userId: "breaker" })).rejects.toMatchObject({ code: "http-error" });
    await expect(guarded.complete(call(), { userId: "breaker" })).rejects.toMatchObject({ code: "http-error" });
    const hitsBeforeOpen = requests.length;
    expect(hitsBeforeOpen).toBe(2);

    await expect(guarded.complete(call(), { userId: "breaker" })).rejects.toMatchObject({ code: "circuit-open" });
    expect(requests.length).toBe(hitsBeforeOpen); // the open breaker did not touch the provider

    nowMs += 1_001;
    mode = "ok";
    const output = await guarded.complete(call(), { userId: "breaker" });
    expect(output).toMatchObject({ decision: "no-change" });
  });
});

describe("the deployment's port comes from the environment, and absent variables mean no port", () => {
  it("returns undefined when any of the three variables is missing", () => {
    expect(modelPortFromEnv({})).toBeUndefined();
    expect(modelPortFromEnv({ TRAINING_PLANNER_MODEL_ENDPOINT: "http://x", TRAINING_PLANNER_MODEL_API_KEY: "k" })).toBeUndefined();
    expect(modelPortFromEnv({ TRAINING_PLANNER_MODEL_ENDPOINT: "http://x", TRAINING_PLANNER_MODEL_NAME: "m" })).toBeUndefined();
  });

  it("accepts a base URL as an alternative to a full endpoint", () => {
    expect(modelPortFromEnv({ TRAINING_PLANNER_MODEL_BASE_URL: "http://x/v1", TRAINING_PLANNER_MODEL_API_KEY: "k" })).toBeUndefined();
    const built = modelPortFromEnv({
      TRAINING_PLANNER_MODEL_BASE_URL: "http://x/v1",
      TRAINING_PLANNER_MODEL_API_KEY: "k",
      TRAINING_PLANNER_MODEL_NAME: "m",
    });
    expect(built).toBeDefined();
  });

  it("builds a port when the endpoint, key and model are all present", () => {
    const built = modelPortFromEnv({
      TRAINING_PLANNER_MODEL_ENDPOINT: "http://127.0.0.1:1/v1/chat/completions",
      TRAINING_PLANNER_MODEL_API_KEY: "k",
      TRAINING_PLANNER_MODEL_NAME: "m",
    });
    expect(built).toBeDefined();
    expect(typeof built?.complete).toBe("function");
  });
});

describe("the port's errors are the port's, not the product's", () => {
  it("every failure is a ProviderError with a code the route can name", async () => {
    mode = "error";
    try {
      await port().complete(call(), { userId: "err" });
      throw new Error("expected a rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).code).toBe("http-error");
    }
    mode = "ok";
  });
});


describe("a base URL becomes the chat-completions URL without being doubled", () => {
  it("appends the path once", () => {
    expect(chatCompletionsUrl("http://host:8102/v1")).toBe("http://host:8102/v1/chat/completions");
    expect(chatCompletionsUrl("http://host:8102/v1/")).toBe("http://host:8102/v1/chat/completions");
    expect(chatCompletionsUrl("http://host:8102/v1/chat/completions")).toBe("http://host:8102/v1/chat/completions");
  });

  it("a port built from a base URL posts to the appended path", async () => {
    mode = "ok";
    requests = [];
    const fromBase = createHttpModelPort({ baseUrl: `${base}/v1`, apiKey: "k", model: "m" });
    const output = await fromBase.complete(call(), { userId: "base-url-user" });
    expect(output).toMatchObject({ decision: "no-change" });
    expect(requests).toHaveLength(1);
  });
});
