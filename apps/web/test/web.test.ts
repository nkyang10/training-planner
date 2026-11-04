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
import { openReview } from "@training-planner/review";
import type { ProposedOption } from "@training-planner/review";
import type { PlanDiff, Review } from "@training-planner/domain";
import { createMemoryRepository, createMemorySessions } from "@training-planner/storage";
import type { Repository } from "@training-planner/storage";
import { createWeb } from "../src/server";

const knowledge = loadKnowledge("knowledge/heuristics");
const USER_A = "88888888-8888-4888-8888-888888888888";
const USER_B = "99999999-9999-4999-8999-999999999999";
const USER_C = "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1";
const NOW = "2026-11-09T22:40:00.000Z";
const TODAY = "2026-11-09";

const repository: Repository = createMemoryRepository();
const sessions = createMemorySessions({ "token-a": USER_A, "token-b": USER_B, "token-c": USER_C });
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

/** The same runner, but with a recent field test: this plan can say how long a session takes. */
const planWithPace = (userId: string): PlanVersion =>
  generatePlan({
    profile: athleteProfileSchema.parse({ ...fixture.input.profile, userId }),
    evidence: { recentWeeklyKm: [8, 9, 8], baselinePaceSecPerKm: 330, baselineConfidence: "medium" },
    state: { planStartDay: TODAY, horizonDays: 21 },
    clock: { today: TODAY },
    seed: "web-fixture-pace",
    knowledge,
  }).version;

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
  repository.savePlanVersion(planWithPace(USER_C));
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
    // The block opens with the neuromuscular session (quality-sequencing.md); tempo arrives at the next
    // quality slot, which is in week 2 and therefore not on this page.
    expect(response.html).toContain("strides");
    // The daily prompt: packages/nudges said yes, and rendering it recorded the delivery.
    expect(response.html).toContain("Two taps is enough");
  });

  it("does not repeat a prompt it already delivered", async () => {
    // The page above recorded the impression, so the policy now refuses with `delivered`: a prompt that repeats on
    // every reload is not a reminder, it is the reason a runner turns notifications off.
    const again = await call("/", { cookie: "session=token-a" });
    expect(again.status).toBe(200);
    expect(again.html).not.toContain("Two taps is enough");
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
    expect(response.html).toContain('name="completedKm"');
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

  it("saves a partial day with its marker and its distance", async () => {
    // Before this slice the form offered "Partly done" and had no distance field, so the pipeline refused it with
    // "completedKm or durationMin is required when outcome is partial" - a dead end with a button on it.
    const saved = await call("/day/2026-11-07", {
      cookie: "session=token-a",
      form: { outcome: "partial", completedKm: "3.5", rpe: "5", legs: "2", idempotencyKey: "form-key-partial-0001" },
    });
    expect(saved.status).toBe(200);
    expect(saved.html).toContain("Saved.");

    const stored = repository.listEntriesForDay(USER_A, "2026-11-07").at(-1);
    expect(stored?.outcome).toBe("partial");
    expect(stored?.sessionTaken).toBe("partial");
    expect(stored?.completedKm).toBe(3.5);
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
    const before = repository.listEntriesForDay(USER_A, "2026-11-07").length;
    const response = await call("/day/2026-11-07", {
      cookie: "session=token-a",
      form: { outcome: "skipped", detail: "", rpe: "6", legs: "2", idempotencyKey: "form-key-0003" },
    });
    expect(response.status).toBe(400);
    expect(response.html).toContain("did not save");
    expect(response.html).toContain("outcomeDetail");
    expect(repository.listEntriesForDay(USER_A, "2026-11-07")).toHaveLength(before);
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

describe("a session with pace evidence says how long it takes", () => {
  it("shows the estimate on the week page, with the word that makes it an estimate", async () => {
    const response = await call("/", { cookie: "session=token-c" });
    expect(response.status).toBe(200);
    // The plan is prescribed by distance and the duration is an estimate from the prescribed band, so the label
    // says "about" - a promise of an exact time would be a number the engine did not produce.
    expect(response.html).toMatch(/about \d+ min/);
  });

  it("shows it on the day page too, from the same label", async () => {
    const response = await call("/day/2026-11-10", { cookie: "session=token-c" });
    expect(response.status).toBe(200);
    expect(response.html).toMatch(/about \d+ min/);
  });

  it("leaves a plan with no pace evidence as a distance, with no invented time", async () => {
    const response = await call("/", { cookie: "session=token-a" });
    expect(response.status).toBe(200);
    expect(response.html).not.toContain("about");
  });
});

describe("the season page and the export", () => {
  it("renders the plan s weeks and says what has happened so far", async () => {
    const response = await call("/season", { cookie: "session=token-a" });
    expect(response.status).toBe(200);
    // The plan starts on Monday 11-09, so the page is three calendar weeks and the first one is the current week.
    expect(response.html).toContain("Week of 2026-11-09");
    expect(response.html).toContain("Week of 2026-11-23");
    expect(response.html).toContain("this week");
    expect(response.html).toContain("still ahead");
    expect(response.html).toContain("Download my data (JSON)");
  });

  it("offers the week a way to reach the season", async () => {
    const response = await call("/", { cookie: "session=token-a" });
    expect(response.html).toContain('href="/season"');
  });

  it("downloads the runner s data as one JSON document", async () => {
    const response = await call("/export", { cookie: "session=token-a" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const exported = JSON.parse(response.html) as {
      userId: string;
      counts: Record<string, number>;
      planVersions: unknown[];
      entries: unknown[];
    };
    expect(exported.userId).toBe(USER_A);
    // The week tests above logged days, and the plan was saved in beforeAll: both are in the file.
    expect(exported.counts["planVersions"]).toBe(1);
    expect(exported.counts["entries"]).toBeGreaterThan(0);
    expect(exported.planVersions).toHaveLength(1);
    expect(exported.entries).toHaveLength(exported.counts["entries"] ?? -1);
  });

  it("shows the season empty state rather than an empty table when there is no plan", async () => {
    const response = await call("/season", { cookie: "session=token-b" });
    expect(response.status).toBe(200);
    expect(response.html).toContain("No plan yet");
  });
});

describe("the review sheet shows keep-the-plan first, with the cost, and records a decision", () => {
  const options: ProposedOption[] = [
    { optionId: "keep", labelKey: "Keep the plan", keepAsIs: true, diffId: null, costKey: "risk", costSlots: {} },
    {
      optionId: "reduce",
      labelKey: "Reduce hard days",
      keepAsIs: false,
      diffId: "33333333-3333-4333-8333-333333333333",
      costKey: "less intensity",
      costSlots: {},
      loadDeltaPct: -15,
    },
  ];

  const openOne = (): Review => {
    const opened = openReview({
      userId: USER_A,
      today: TODAY,
      candidate: {
        kind: "plan-too-big",
        ruleId: "plan-too-big",
        anchor: "review-triggers.yaml#plan-too-big",
        evidence: { signalIds: ["completion"], ruleIds: ["plan-too-big"], evidenceGradeMax: "B" },
        presentation: "offer-at-next-open",
      },
      knowledge,
      options,
      renderCost: (option) => option.costKey,
    });
    if (opened.status !== "opened") throw new Error("expected a review");
    // Stage the diff and the child version the sheet accept will activate.
    const base = planFor(USER_A);
    const childId = "cccccccc-3333-4333-8333-333333333333";
    const diff: PlanDiff = {
      schemaVersion: 1,
      diffId: "33333333-3333-4333-8333-333333333333",
      userId: USER_A,
      fromVersionId: base.versionId,
      toVersionId: childId,
      createdAtDay: TODAY,
      changes: [],
      changeCountWithinLimit: true,
      knowledgeHash: knowledge.hash,
    };
    repository.savePlanDiff(diff);
    // The child really changes something: the first hard session of this week becomes an easy one, so the
    // calendar can be checked for the change after acceptance rather than trusting a status field.
    const qualityDay = base.sessions.find((session) => session.day >= TODAY && (session.hardDay === true || session.kind === "strides"));
    const sessions = base.sessions.map((session) =>
      session.day === qualityDay?.day
        ? { ...session, kind: "easy" as const, hardDay: false, distanceKm: 1, summaryText: "easy 1 km", targetRpe: null }
        : session,
    );
    repository.saveProposedPlanVersion({
      ...base,
      sessions,
      versionId: childId,
      parentVersionId: base.versionId,
      generatedBy: "review-accepted",
      generatedAtDay: TODAY,
    });
    repository.saveReview(opened.review);
    return opened.review;
  };

  it("puts the banner on the week page while a review is open", async () => {
    const review = openOne();
    const page = await call("/", { cookie: "session=token-a" });
    expect(page.html).toContain("A review is waiting for you.");
    expect(page.html).toContain(`/review/${review.reviewId}`);
  });

  it("renders the options in the order the lifecycle decided, with their cost", async () => {
    const review = openOne();
    const page = await call(`/review/${review.reviewId}`, { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Keep the plan");
    expect(page.html).toContain("Reduce hard days");
    expect(page.html).toContain("Cost: less intensity");
    expect(page.html).toContain("Nothing changes before 2026-11-11.");
    const keepIndex = page.html.indexOf("Keep the plan");
    const reduceIndex = page.html.indexOf("Reduce hard days");
    expect(keepIndex).toBeGreaterThan(-1);
    expect(keepIndex).toBeLessThan(reduceIndex);
  });

  it("applies an accepted change to the week the runner sees", async () => {
    const review = openOne();
    const before = await call("/", { cookie: "session=token-a" });
    expect(before.html).toContain("strides");
    expect(before.html).not.toContain("easy, 1 km");

    const accepted = await call(`/review/${review.reviewId}`, {
      cookie: "session=token-a",
      form: { decision: "accept", optionId: "reduce" },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.html).toContain("Accepted. The change starts on 2026-11-11.");

    const after = await call("/", { cookie: "session=token-a" });
    // The page renders the session from the active plan, so the accepted change is what the runner now sees.
    expect(after.html).toContain("easy, 1 km");
  });
  it("accepts a change and says when it starts", async () => {
    const review = openOne();
    const page = await call(`/review/${review.reviewId}`, {
      cookie: "session=token-a",
      form: { decision: "accept", optionId: "reduce" },
    });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Accepted. The change starts on 2026-11-11.");
    expect(repository.getReview(USER_A, review.reviewId)?.status).toBe("accepted");
    expect(repository.getReview(USER_A, review.reviewId)?.resultDiffId).toBe("33333333-3333-4333-8333-333333333333");
  });


  it("records a decline as keeping the plan", async () => {
    const review = openOne();
    const page = await call(`/review/${review.reviewId}`, {
      cookie: "session=token-a",
      form: { decision: "decline", reason: "one more week" },
    });
    expect(page.html).toContain("Kept the plan. Nothing changed.");
    expect(repository.getReview(USER_A, review.reviewId)?.status).toBe("rejected");
  });

  it("defers to the dwell window and names the day", async () => {
    const review = openOne();
    const page = await call(`/review/${review.reviewId}`, {
      cookie: "session=token-a",
      form: { decision: "defer" },
    });
    expect(page.html).toContain("We will ask again on 2026-11-16.");
    expect(repository.getReview(USER_A, review.reviewId)?.status).toBe("deferred");
  });

  it("refuses a second decision on a decided review", async () => {
    const review = openOne();
    await call(`/review/${review.reviewId}`, { cookie: "session=token-a", form: { decision: "decline" } });
    const again = await call(`/review/${review.reviewId}`, { cookie: "session=token-a", form: { decision: "accept", optionId: "reduce" } });
    expect(again.status).toBe(409);
    expect(again.html).toContain("not-open");
    expect(repository.getReview(USER_A, review.reviewId)?.status).toBe("rejected");
  });

  it("says so when the review does not exist", async () => {
    const page = await call("/review/00000000-0000-4000-8000-000000000000", { cookie: "session=token-a" });
    expect(page.status).toBe(404);
    expect(page.html).toContain("No review is open.");
  });
});