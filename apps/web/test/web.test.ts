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
import { renderMonth } from "../src/pages";
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
    state: { planStartDay: "2026-10-26", horizonDays: 21 },
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
  server = createServer(createWeb({ repository, sessions, knowledge, now: () => NOW, operatorToken: "operator-token" }));
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
    expect(response.html).toContain('class="day-card today"');
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

describe("the pain history page", () => {
  it("shows the rows the entry pipeline wrote, and links from the week", async () => {
    const hardDay = planWithPace(USER_C).sessions.find((session) => session.hardDay === true)?.day;
    expect(hardDay).toBeDefined();
    const posted = await call(`/day/${hardDay}`, {
      cookie: "session=token-c",
      form: {
        outcome: "completed",
        completedKm: "6",
        rpe: "6",
        legs: "2",
        note: "",
        correctionReason: "logged after the run",
        idempotencyKey: `pain-${hardDay}`,
      },
    });
    expect(posted.status).toBe(200);
    const page = await call("/pain", { cookie: "session=token-c" });
    expect(page.status).toBe(200);
    // The page shows what happened, not what it means: the triage still reads one entry's array (row 35).
    expect(page.html).toContain("Pain history");
    expect(page.html).toContain("Back to the week");
    const week = await call("/", { cookie: "session=token-c" });
    expect(week.html).toContain('href="/pain"');
  });

  it("says no pain has been reported rather than showing an empty table", async () => {
    const page = await call("/pain", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("No pain has been reported yet");
    // The window is a fact too: no reports is not the same as no pain.
    expect(page.html).toContain("No pain reported in the last 7 days");
  });
});

describe("a substitute says what it gave up", () => {
  it("shows the trade-off line on the day it happened", async () => {
    const hardDay = planWithPace(USER_C).sessions.find((session) => session.hardDay === true)?.day;
    expect(hardDay, "the fixture plan has no hard day").toBeDefined();
    const response = await call(`/day/${hardDay}`, {
      cookie: "session=token-c",
      form: {
        outcome: "completed",
        sessionTaken: "alternate",
        completedKm: "4",
        correctionReason: "logged the evening after",
        rpe: "6",
        legs: "2",
        note: "",
        idempotencyKey: `alt-${hardDay}`,
      },
    });
    expect(response.status).toBe(200);
    // The judgement is packages/policy's and the number is the corpus knob; the page only places the sentence.
    expect(response.html).toContain("trade-off:");
    expect(response.html).toContain("35");
  });

  it("says nothing after a day done as prescribed", async () => {
    const response = await call("/day/2026-11-05", {
      cookie: "session=token-c",
      form: {
        outcome: "completed",
        completedKm: "2",
        rpe: "4",
        legs: "2",
        note: "",
        correctionReason: "logged the next week",
        idempotencyKey: "prescribed-11-05",
      },
    });
    expect(response.status).toBe(200);
    expect(response.html).not.toContain("trade-off:");
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

describe("the wizard and the personal console (ADR-0009)", () => {
  it("walks the runner through the steps and shows the question in their language", async () => {
    const first = await call("/wizard", { cookie: "session=token-c", locale: "en" });
    expect(first.status).toBe(200);
    expect(first.html).toContain("Set your orientation");
    expect(first.html).toContain("What is your goal right now?");
    expect(first.html).toContain('name="stepId" value="goal"');
  });

  it("records a step, redirects, and keeps the original visible after a change", async () => {
    const saved = await call("/wizard", { cookie: "session=token-c", form: { stepId: "goal", value: "finish" } });
    expect(saved.status).toBe(303);
    expect(saved.headers.get("location")).toBe("/wizard?saved=1");

    const changed = await call("/wizard", { cookie: "session=token-c", form: { stepId: "goal", value: "time" } });
    expect(changed.status).toBe(303);

    const consolePage = await call("/console", { cookie: "session=token-c", locale: "en" });
    expect(consolePage.status).toBe(200);
    expect(consolePage.html).toContain("Run a time");
    expect(consolePage.html).toContain("Originally chosen");
    expect(consolePage.html).toContain("Finish a race");
  });

  it("shows public guidelines and never an internal one", async () => {
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
    const response = await call("/console", { cookie: "session=token-c", locale: "en" });
    expect(response.html).toContain("Public guidelines");
    expect(response.html).toContain("Weekly volume rises by at most 10 percent.");
    expect(response.html).not.toContain("Night pain stops training.");
  });
});


describe("the operator console (ADR-0009)", () => {
  it("asks for the operator token and refuses a runner cookie", async () => {
    const page = await call("/admin/guidelines", { cookie: "session=token-a", locale: "en" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Operator console");
    expect(page.html).toContain("The operator token is required.");
    expect(page.html).not.toContain("Add a version");
  });

  it("signs the operator in and appends a version from the form", async () => {
    const login = await call("/admin/login", { form: { token: "operator-token" } });
    expect(login.status).toBe(303);
    expect(login.headers.get("set-cookie")).toContain("operator=");

    const created = await call("/admin/guidelines", {
      cookie: "operator=operator-token",
      form: {
        guidelineId: "progression-ceiling",
        version: "3",
        tier: "constraint",
        scope: "progression",
        visibility: "public",
        text: "Weekly volume rises by at most 10 percent.",
        rationale: "Stated once, kept once.",
        effectiveFrom: "2026-11-01",
      },
    });
    expect(created.status).toBe(303);
    expect(created.headers.get("location")).toBe("/admin/guidelines?saved=1");

    const listed = await call("/admin/guidelines", { cookie: "operator=operator-token", locale: "en" });
    expect(listed.html).toContain("progression-ceiling@3");
    expect(listed.html).toContain("Weekly volume rises by at most 10 percent.");
  });

  it("shows the duplicate-version sentence instead of overwriting", async () => {
    const duplicate = await call("/admin/guidelines", {
      cookie: "operator=operator-token",
      locale: "en",
      form: {
        guidelineId: "progression-ceiling",
        version: "3",
        tier: "constraint",
        scope: "progression",
        visibility: "public",
        text: "Different text, same version.",
        rationale: "Attempted overwrite.",
        effectiveFrom: "2026-11-01",
      },
    });
    expect(duplicate.status).toBe(200);
    expect(duplicate.html).toContain("That version already exists.");
  });
});


describe("the review sheet tells a re-plan's honest size (ADR-0010)", () => {
  it("renders the change count and the kilometres before and after", async () => {
    const opened = openReview({
      userId: USER_A,
      today: TODAY,
      candidate: {
        kind: "manual",
        ruleId: null,
        anchor: null,
        evidence: { signalIds: [], ruleIds: [], evidenceGradeMax: "C" },
        presentation: "recorded",
      },
      knowledge,
      options: [
        { optionId: "keep", labelKey: "keep-the-plan", keepAsIs: true, diffId: null, costKey: "risk-noted", costSlots: {}, loadDeltaPct: 0 },
        {
          optionId: "replan",
          labelKey: "replan-for-orientation",
          keepAsIs: false,
          kind: "replan",
          planVersionId: "12345678-1234-4234-8234-123456789012",
          changeSummary: { changes: 11, sessionsMoved: 8, kmBefore: 27.2, kmAfter: 48.5, firstChangedDay: "2026-11-16" },
          diffId: null,
          costKey: "the-block-is-recut",
          costSlots: {},
          loadDeltaPct: 78.3,
        },
      ],
      renderCost: (option) => option.costKey,
    });
    if (opened.status !== "opened") throw new Error(`expected opened, got ${JSON.stringify(opened)}`);
    repository.saveReview(opened.review);

    const page = await call(`/review/${opened.review.reviewId}`, { cookie: "session=token-a", locale: "en" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("This re-cuts the block: 11 days change, 27.2 km to 48.5 km.");
    expect(page.html).toContain('name="optionId" value="replan"');
  });
});


describe("the local usage pass fixed these UI/UX gaps", () => {
  const USER_C_ID = "c1c1c1c1-c1c1-41c1-81c1-c1c1c1c1c1c1";

  beforeAll(() => {
    repository.saveWizardAnswer(USER_C_ID, { stepId: "goal", answer: { value: "finish" }, revision: 1, source: "wizard" });
    repository.saveWizardAnswer(USER_C_ID, { stepId: "availability", answer: { values: ["Mon", "Wed", "Fri"] }, revision: 1, source: "wizard" });
    repository.saveWizardAnswer(USER_C_ID, { stepId: "risk-appetite", answer: { value: "conservative" }, revision: 1, source: "wizard" });
    repository.appendEntryWithEventAndPointer({
      entry: { day: "2026-11-04", outcome: "missed", revision: 1, tzAtEvent: "Asia/Taipei", sessionTaken: "none", completedKm: 0, note: "Knee felt odd", idempotencyKey: "ux-missed" },
      event: {
        eventId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        userId: USER_C_ID,
        type: "entry.submitted",
        occurredAt: "2026-11-04T21:30:00.000Z",
        actor: "runner",
        payloadVersion: 1,
        payload: {},
        trainingDay: "2026-11-04",
        timezone: "Asia/Taipei",
        idempotencyKey: "ux-missed",
      },
    });
    repository.savePainReport({
      userId: USER_C_ID,
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      day: "2026-11-04",
      site: "knee",
      side: "right",
      intensity: 3,
      duringRun: true,
      nextMorning: false,
      trendGaitChange: true,
      nightPain: true,
      duration: "few-days",
      knownInjury: false,
      note: null,
    });
  });

  it("renders availability answers as day names instead of crashing on a day name", async () => {
    const page = await call("/console", { cookie: "session=token-c", locale: "en" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Monday, Wednesday, Friday");
  });

  it("a finished wizard lists every answer with a link that changes it", async () => {
    const page = await call("/wizard", { cookie: "session=token-c", locale: "en" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Which days can you run?");
    expect(page.html).toContain("/wizard?step=availability");
    expect(page.html).toContain("Change");
  });

  it("a day page checks the logged outcome, not always completed", async () => {
    const page = await call("/day/2026-11-04", { cookie: "session=token-c", locale: "en" });
    expect(page.status).toBe(200);
    expect(page.html).toContain('value="missed" checked');
    expect(page.html).not.toContain('value="completed" checked');
  });

  it("the pain page shows the report's own flags", async () => {
    const page = await call("/pain", { cookie: "session=token-c", locale: "en" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("night pain");
    expect(page.html).toContain("gait change");
  });
});


describe("mobile navigation and the month/week lookback", () => {
  it("puts the sections in the shell, not only in a footer", async () => {
    const page = await call("/", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain('class="tabs"');
    expect(page.html).toContain('href="/month"');
    expect(page.html).toContain('href="/season"');
    expect(page.html).toContain('href="/console"');
  });

  it("shows a month of weeks, each linking into its own week page", async () => {
    const page = await call("/month/2026-11", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Month of 2026-11");
    expect(page.html).toContain('href="/month/2026-10"');
    expect(page.html).toContain('href="/month/2026-12"');
  });

  it("renders the peak and final-surge markers from the plan's own weeks", () => {
    const weeks = [
      { weekStart: "2026-11-02", status: "current", plannedKm: 10, completedKm: 4, plannedSessions: 3, completedSessions: 1, hardDays: 1, loggedDays: 2, plannedDays: 7 },
      { weekStart: "2026-11-09", status: "future", plannedKm: 14, completedKm: 0, plannedSessions: 4, completedSessions: 0, hardDays: 2, loggedDays: 0, plannedDays: 7 },
    ] as unknown as Parameters<typeof renderMonth>[0]["weeks"];
    const html = renderMonth({
      locale: "en",
      month: "2026-11",
      weeks,
      peakWeek: "2026-11-09",
      finalWeek: "2026-11-09",
      prevMonth: "2026-10",
      nextMonth: "2026-12",
    });
    expect(html).toContain("peak week");
    expect(html).toContain("final surge");
    expect(html).toContain('href="/week/2026-11-09"');
  });

  it("looks back a week from the calendar and forward again", async () => {
    const page = await call("/?week=2026-10-19", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Week of 2026-10-19");
    expect(page.html).toContain("Previous week");
    expect(page.html).toContain("Next week");
  });

  it("renders one week as its own page with its own navigation", async () => {
    const page = await call("/week/2026-10-19", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Week of 2026-10-19");
    expect(page.html).toContain('href="/week/2026-10-12"');
    expect(page.html).toContain('href="/month/2026-10"');
  });

  it("shows the runner's own note on the week view", async () => {
    const page = await call("/week/2026-11-02", { cookie: "session=token-c" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Note: Knee felt odd");
  });
});


describe("connections page", () => {
  it("lists both providers and says Strava is not configured", async () => {
    const page = await call("/connections", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain("Connected apps");
    expect(page.html).toContain("Strava");
    expect(page.html).toContain("Garmin");
    expect(page.html).toContain("not connected");
    expect(page.html).toContain("registered app");
  });

  it("saves the runner's sync choice from the form", async () => {
    const response = await fetch(`${base}/connections/sync-preference`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: "session=token-a" },
      body: "source=garmin",
      redirect: "manual",
    });
    expect(response.status).toBe(303);
    expect(repository.getSyncPreference(USER_A)?.source).toBe("garmin");
  });

  it("puts Connections in the shell navigation", async () => {
    const page = await call("/", { cookie: "session=token-a" });
    expect(page.html).toContain('href="/connections"');
  });
});

describe("grid calendar", () => {
  it("renders the week as seven day cards, not a list", async () => {
    const page = await call("/", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain('class="week-grid"');
    expect((page.html.match(/class="day-card/g) ?? []).length).toBe(7);
    expect(page.html).toContain("planned");
  });

  it("renders the month as a real month grid with weekday headers", async () => {
    const page = await call("/month/2026-11", { cookie: "session=token-a" });
    expect(page.status).toBe(200);
    expect(page.html).toContain('class="month-grid"');
    expect(page.html).toContain('class="dow"');
    expect((page.html.match(/class="month-day/g) ?? []).length).toBeGreaterThanOrEqual(28);
  });

  it("jumps to the week of a chosen date", async () => {
    const response = await fetch(`${base}/jump?date=2026-11-11`, { headers: { cookie: "session=token-a" }, redirect: "manual" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?week=2026-11-09");
  });
});

