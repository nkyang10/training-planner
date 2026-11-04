/**
 * The web client's tests are end-to-end on a real http.Server with real fetch calls, because the thing that can
 * break here is the fit: a form field name, a cookie, a redirect, the catalogue string on the page. A unit test
 * of `renderCalendar` would not notice that a form posts to the wrong URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { athleteProfileSchema } from "@training-planner/domain";
import { fixtureSchema } from "@training-planner/golden-fixtures";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlanVersion } from "@training-planner/domain";
import { generatePlan } from "@training-planner/planner-core";
import { loadKnowledge } from "@training-planner/knowledge";
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import { createWeb } from "../src/server";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER_A = "88888888-8888-4888-8888-888888888888";
const USER_B = "99999999-9999-4999-8999-999999999999";
const NOW = "2026-11-09T22:40:00.000Z";
const TODAY = "2026-11-09";

const repository: Repository = createMemoryRepository();
const sessions = createMemorySessions({ "token-a": USER_A, "token-b": USER_B });
let server: Server;
let base = "";

interface CallOptions {
  method?: string;
  cookie?: string;
  form?: Record<string, string>;
  locale?: string;
}

async function call(path: string, options: CallOptions = {}): Promise<{ status: number; html: string; headers: Headers }> {
  const headers: Record<string, string> = {};
  if (options.cookie !== undefined) headers["cookie"] = options.cookie;
  if (options.locale !== undefined) headers["accept-language"] = options.locale;
  let body: string | undefined;
  if (options.form !== undefined) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(options.form).toString();
  }
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? (options.form === undefined ? "GET" : "POST"),
    headers,
    redirect: "manual",
    ...(body === undefined ? {} : { body }),
  });
  return { status: response.status, html: await response.text(), headers: response.headers };
}

const fixture = fixtureSchema.parse(
  JSON.parse(readFileSync(join(process.cwd(), "eval", "golden-plans", "novice-5k.json"), "utf8")),
);

const planFor = (userId: string): PlanVersion =>
  generatePlan({
    // The fixture s profile is the canonical valid one; only the owner changes, so the page test and the
    // API test describe the same runner.
    profile: athleteProfileSchema.parse({ ...fixture.input.profile, userId }),
    evidence: { recentWeeklyKm: [8, 9, 8] },
    state: { planStartDay: TODAY, horizonDays: 21 },
    clock: { today: TODAY },
    seed: "web-fixture",
    knowledge,
  }).version;

beforeAll(async () => {
  repository.savePlanVersion(planFor(USER_A));
  server = createServer(createWeb({ repository, sessions, knowledge, now: () => NOW }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("sign in is a cookie and a redirect", () => {
  it("sends an unauthenticated visitor to the login page", async () => {
    const response = await call("/");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/login");
  });

  it("renders the login form", async () => {
    const response = await call("/login");
    expect(response.status).toBe(200);
    expect(response.html).toContain('action="/login"');
    expect(response.html).toContain('type="password"');
  });

  it("sets a session cookie for a known token and refuses an unknown one", async () => {
    const good = await call("/login", { form: { token: "token-a" } });
    expect(good.status).toBe(303);
    expect(good.headers.get("set-cookie")).toContain("session=token-a");
    expect(good.headers.get("set-cookie")).toContain("HttpOnly");

    const bad = await call("/login", { form: { token: "nope" } });
    expect(bad.status).toBe(200);
    expect(bad.html).toContain("unknown token");
  });

  it("clears the cookie on sign out", async () => {
    const response = await call("/sign-out", { method: "POST", cookie: "session=token-a" });
    expect(response.status).toBe(303);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("the week page is the plan, not a dashboard", () => {
  it("renders seven days with session kinds and links", async () => {
    const response = await call("/", { cookie: "session=token-a" });
    expect(response.status).toBe(200);
    expect(response.html).toContain("This week");
    for (const day of ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]) {
      expect(response.html).toContain(`/day/${day}`);
    }
    expect(response.html).toContain("tempo");
  });

  it("marks the day the page is about", async () => {
    const response = await call("/", { cookie: "session=token-a" });
    expect(response.html).toContain('class="row today"');
  });

  it("shows a generated explanation sentence above the week", async () => {
    const response = await call("/", { cookie: "session=token-a" });
    expect(response.html).toMatch(/sessions over \d+ weeks/);
  });

  it("speaks Traditional Chinese when the locale cookie says so", async () => {
    const response = await call("/", { cookie: "session=token-a; locale=zh-Hant" });
    expect(response.html).toContain("這一週");
    expect(response.html).toContain("尚未記錄");
  });
});

describe("the day drawer is a form that posts the same draft the API takes", () => {
  it("renders the five outcomes, effort, legs and a save button", async () => {
    const response = await call("/day/2026-11-10", { cookie: "session=token-a" });
    expect(response.status).toBe(200);
    for (const outcome of ["completed", "partial", "skipped", "rest", "missed"]) {
      expect(response.html).toContain(`value="${outcome}"`);
    }
    expect(response.html).toContain('name="rpe"');
    expect(response.html).toContain('name="legs"');
    expect(response.html).toContain('name="idempotencyKey"');
    expect(response.html).toContain("Save");
  });

  it("saves an entry, renders the comment and marks the day logged", async () => {
    const saved = await call("/day/2026-11-09", {
      cookie: "session=token-a",
      form: { outcome: "completed", rpe: "6", legs: "2", idempotencyKey: "form-key-0001" },
    });
    expect(saved.status).toBe(200);
    expect(saved.html).toContain("Saved.");
    expect(saved.html).toContain("Coach note");

    const day = await call("/entries-view", { cookie: "session=token-a" });
    expect(day.status).toBe(404);

    const calendar = await call("/", { cookie: "session=token-a" });
    expect(calendar.html).toContain("Logged");
  });

  it("does not write twice when the same form is submitted twice", async () => {
    const before = repository.listEntriesForDay(USER_A, "2026-11-08").length;
    const form = { outcome: "completed", rpe: "6", legs: "2", idempotencyKey: "form-key-0002" };
    const first = await call("/day/2026-11-08", { cookie: "session=token-a", form });
    const second = await call("/day/2026-11-08", { cookie: "session=token-a", form });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(repository.listEntriesForDay(USER_A, "2026-11-08").length).toBe(before + 1);
  });

  it("refuses a skipped day with no reason instead of inventing one", async () => {
    const response = await call("/day/2026-11-07", {
      cookie: "session=token-a",
      form: { outcome: "skipped", detail: "", rpe: "6", legs: "2", idempotencyKey: "form-key-0003" },
    });
    expect(response.status).toBe(400);
    expect(response.html).toContain("did not save");
    expect(response.html).toContain("outcomeDetail");
    expect(repository.listEntriesForDay(USER_A, "2026-11-07")).toHaveLength(0);
  });

  it("saves a skipped day that states its reason", async () => {
    const response = await call("/day/2026-11-06", {
      cookie: "session=token-a",
      form: { outcome: "skipped", detail: "illness", rpe: "6", legs: "2", idempotencyKey: "form-key-0005" },
    });
    expect(response.status).toBe(200);
    expect(response.html).toContain("Saved.");
    expect(repository.listEntriesForDay(USER_A, "2026-11-06")[0]?.outcomeDetail).toBe("illness");
  });

  it("opens a day outside the plan instead of erroring", async () => {
    const response = await call("/day/2026-12-24", { cookie: "session=token-a" });
    expect(response.status).toBe(200);
    expect(response.html).toContain('action="/day/2026-12-24"');
  });
});

describe("one runner's page never shows another runner's log", () => {
  it("renders an empty week for a user with no plan", async () => {
    const response = await call("/", { cookie: "session=token-b" });
    expect(response.status).toBe(200);
    expect(response.html).toContain("No plan yet");
    expect(response.html).not.toContain("Logged");
  });

  it("does not render user A's entry on user B's day page", async () => {
    const response = await call("/day/2026-11-10", { cookie: "session=token-b" });
    expect(response.status).toBe(200);
    expect(response.html).not.toContain("Coach note");
  });
});

describe("the offline queue is served and its wire is accepted", () => {
  it("serves the queue script as JavaScript and the page loads it", async () => {
    const script = await fetch(`${base}/static/queue.js`);
    expect(script.status).toBe(200);
    expect(script.headers.get("content-type")).toContain("application/javascript");
    const body = await script.text();
    expect(body).toContain("indexedDB");
    expect(body).toContain("offline-queue");

    const page = await call("/day/2026-11-09", { cookie: "session=token-a" });
    expect(page.html).toContain('src="/static/queue.js"');
  });

  it("marks the entry form for interception and carries the catalogue copy", async () => {
    const page = await call("/day/2026-11-09", { cookie: "session=token-a" });
    expect(page.html).toContain("data-offline-queue");
    expect(page.html).toContain("data-saved-locally=");
    expect(page.html).toContain("Saved on this device");
    expect(page.html).toContain("data-offline-status");
  });

  it("records a replayed entry with its true source", async () => {
    const response = await call("/day/2026-11-06", {
      cookie: "session=token-a",
      form: { outcome: "completed", rpe: "6", legs: "2", idempotencyKey: "offline-key-0001", source: "offline-queue" },
    });
    expect(response.status).toBe(200);
    // The day already has an earlier revision from another test; the replay is the newest one.
    const stored = repository.listEntriesForDay(USER_A, "2026-11-06").at(-1);
    expect(stored?.source).toBe("offline-queue");
  });

  it("refuses a source the contract does not have", async () => {
    const response = await call("/day/2026-11-05", {
      cookie: "session=token-a",
      form: { outcome: "completed", rpe: "6", legs: "2", idempotencyKey: "offline-key-0002", source: "telepathy" },
    });
    expect(response.status).toBe(400);
    expect(repository.listEntriesForDay(USER_A, "2026-11-05")).toHaveLength(0);
  });
});

describe("the stylesheet is served, and the pages are not injectable", () => {
  it("serves CSS with the right content type", async () => {
    const response = await fetch(`${base}/static/app.css`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
  });

  it("escapes a note instead of rendering it", async () => {
    const payload = '<script>alert("x")</script>';
    await call("/day/2026-11-07", {
      cookie: "session=token-a",
      form: { outcome: "completed", rpe: "6", legs: "2", note: payload, idempotencyKey: "form-key-0004" },
    });
    const page = await call("/day/2026-11-07", { cookie: "session=token-a" });
    expect(page.html).not.toContain("<script>alert");
    expect(page.html).toContain("&lt;script&gt;");
  });
});
