/**
 * The HTTP API (ADR-0008): node:http, the generated zod contracts, and the packages' pure functions.
 *
 * This is the composition root, and the only place in the product allowed to read a clock or a socket. Every
 * decision below it is a pure function that was tested without either.
 *
 * The daily loop closes here: an entry goes in, the entry pipeline writes it, the policy evaluator decides, and
 * the narrator renders the comment in the runner's language. The response returns all three, so a client never
 * re-derives a number.
 */
import { createServer, type IncomingMessage, type RequestListener, type ServerResponse } from "node:http";
import { z } from "zod";
import { athleteProfileSchema, planVersionSchema } from "@training-planner/domain";
import type { DayEntry } from "@training-planner/domain";
import { submitEntry } from "@training-planner/entries";
import type { EntryDraft } from "@training-planner/entries";
import { isLocale } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import { loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { renderAdjustment, renderComment } from "@training-planner/narrator";
import { generatePlan, uuidFrom } from "@training-planner/planner-core";
import type { Evidence, PlanState } from "@training-planner/planner-core";
import { evaluatePolicy } from "@training-planner/policy";
import { computeSignals } from "@training-planner/signals";
import { evaluateTriggers } from "@training-planner/triggers";
import { decideReview } from "@training-planner/review";
import type { Decision } from "@training-planner/review";
import { DuplicateIdempotencyError } from "@training-planner/storage";
import type { CommentRecord, Repository, Sessions } from "@training-planner/storage";

export interface ApiOptions {
  repository: Repository;
  sessions: Sessions;
  knowledge?: KnowledgeBundle;
  /** The clock is injected: the API is the composition root, and a test must be able to freeze the day. */
  now?: () => string;
}

interface ApiError {
  code: string;
  detail: string;
}

const MAX_BODY_BYTES = 1_000_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The planner input the API accepts. The canonical shapes are the frozen `Evidence` and `PlanState` types, and
 * the `z.ZodType<...>` annotations make a drift between these schemas and those types a compile error.
 */
const evidenceSchema: z.ZodType<Evidence> = z.object({
  recentWeeklyKm: z.array(z.number().nonnegative()).min(1),
  layoffDays: z.number().int().min(0).optional(),
  baselinePaceSecPerKm: z.number().positive().nullable().optional(),
  baselineConfidence: z.enum(["low", "medium", "high"]).optional(),
});

const stateSchema: z.ZodType<PlanState> = z.object({
  planStartDay: z.string().regex(ISO_DAY, "expected YYYY-MM-DD"),
  horizonDays: z.number().int().min(1).max(740),
  completedDays: z.array(z.string().regex(ISO_DAY)).optional(),
});

const planRequestSchema = z.object({
  profile: athleteProfileSchema,
  evidence: evidenceSchema,
  state: stateSchema,
  seed: z.string().min(1),
});

const entryRequestSchema = z
  .object({
    locale: z.string().optional(),
  })
  .passthrough();

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
}

function fail(response: ServerResponse, status: number, code: string, detail: string): void {
  const error: ApiError = { code, detail };
  sendJson(response, status, { error });
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`);
    chunks.push(buffer);
  }
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

/** The runner's local training day comes from the client, because the 04:00 boundary is local (calendar-and-time.md). */
function trainingDayOf(request: IncomingMessage, now: string): string {
  const header = request.headers["x-training-day"];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (typeof candidate === "string" && ISO_DAY.test(candidate)) return candidate;
  return now.slice(0, 10);
}

function localeOf(request: IncomingMessage, body: Record<string, unknown>): Locale {
  if (typeof body.locale === "string" && isLocale(body.locale)) return body.locale;
  const header = request.headers["accept-language"];
  const value = (Array.isArray(header) ? header[0] : header) ?? "en";
  return value.toLowerCase().startsWith("zh") ? "zh-Hant" : "en";
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function createApi(options: ApiOptions): RequestListener {
  const knowledge = options.knowledge ?? loadKnowledge("knowledge/heuristics");
  const now = options.now ?? (() => new Date().toISOString());
  const repository = options.repository;

  return (request, response) => {
    void handle(request, response).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) fail(response, 500, "internal-error", detail);
      else response.end();
    });
  };

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const method = request.method ?? "GET";

    if (segments.length === 1 && segments[0] === "health" && method === "GET") {
      sendJson(response, 200, { ok: true, knowledge: knowledge.hash });
      return;
    }

    const session = options.sessions.resolve(request.headers.authorization);
    if (session === null) {
      fail(response, 401, "unauthenticated", "a bearer token is required");
      return;
    }
    const { userId } = session;
    const at = now();
    const today = trainingDayOf(request, at);

    // POST /plan - generate and store a plan version for this runner.
    if (segments.length === 1 && segments[0] === "plan") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /plan");
      const parsed = planRequestSchema.safeParse(await readBody(request));
      if (!parsed.success) {
        return fail(response, 400, "invalid-body", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
      }
      // The session owns the row: a profile in the body cannot make a plan for somebody else (ADR-0002).
      const profile = { ...parsed.data.profile, userId };
      const output = generatePlan({ ...parsed.data, profile, clock: { today }, knowledge });
      const version = planVersionSchema.safeParse({ ...output.version, userId });
      if (!version.success) {
        return fail(response, 500, "plan-contract-violation", version.error.issues.map((issue) => issue.message).join("; "));
      }
      repository.savePlanVersion(version.data);
      sendJson(response, 201, { version: version.data });
      return;
    }

    // GET /plan/:versionId
    if (segments.length === 2 && segments[0] === "plan") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /plan/:versionId");
      const version = repository.getPlanVersion(userId, segments[1] ?? "");
      if (version === undefined) return fail(response, 404, "not-found", "no such plan version for this user");
      sendJson(response, 200, { version });
      return;
    }

    // POST /entries - the daily loop.
    if (segments.length === 1 && segments[0] === "entries") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /entries");
      const body = await readBody(request);
      if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
      const draft = body as unknown as EntryDraft;
      const locale = localeOf(request, body);

      // A retry is answered before anything is written, and the answer is the row the first write stored.
      const existing =
        typeof draft.idempotencyKey === "string" ? repository.findEntryByIdempotencyKey(userId, draft.idempotencyKey) : undefined;
      if (existing !== undefined) {
        sendJson(response, 200, { status: "duplicate", entry: existing });
        return;
      }

      const log = {
        entries: repository.listEntriesForDay(userId, draft.day ?? ""),
        events: repository.listEvents(userId),
      };
      const result = submitEntry(draft, log, { userId, today, occurredAt: at, knowledge });
      if (result.status === "rejected") return fail(response, 400, result.code, result.detail);
      if (result.status === "duplicate") {
        sendJson(response, 200, { status: "duplicate", entry: result.entry });
        return;
      }

      try {
        repository.appendEntryWithEventAndPointer({
          entry: result.entry,
          event: result.event,
          ...(result.superseded === undefined ? {} : { superseded: result.superseded }),
        });
      } catch (error) {
        // Two requests with the same key racing: the unique constraint wins and the retry reads the winner.
        if (error instanceof DuplicateIdempotencyError) {
          const stored = repository.findEntryByIdempotencyKey(userId, error.idempotencyKey);
          if (stored !== undefined) {
            sendJson(response, 200, { status: "duplicate", entry: stored });
            return;
          }
        }
        throw error;
      }

      const plan = repository.latestPlanVersionFor(userId, result.entry.day);
      if (plan === undefined) {
        // The entry is stored; a comment about a plan the runner does not have would be a fiction.
        sendJson(response, 201, {
          entry: result.entry,
          comment: null,
          note: "no plan version covers this day yet; the entry is stored and the comment waits for a plan",
        });
        return;
      }

      const decision = evaluatePolicy({ entry: result.entry, plan, today, knowledge });
      const rendered = renderComment(decision.commentFacts, { locale });
      const record: CommentRecord = {
        commentId: uuidFrom({ userId, day: result.entry.day, revision: result.entry.revision, locale }),
        userId,
        day: result.entry.day,
        locale,
        sentences: rendered.sentences,
        text: rendered.text,
        knowledgeHash: knowledge.hash,
        createdAt: at,
      };
      repository.saveComment(record);

      sendJson(response, 201, {
        entry: result.entry,
        comment: { text: rendered.text, sentences: rendered.sentences, ...(rendered.nudge === undefined ? {} : { nudge: rendered.nudge }) },
        ...(decision.adjustTomorrow === undefined
          ? {}
          : { adjustment: decision.adjustTomorrow, chip: renderAdjustment(decision.adjustTomorrow, { locale }) }),
        ...(decision.flagReview === undefined ? {} : { review: decision.flagReview }),
        ...(decision.hardStop === undefined ? {} : { hardStop: decision.hardStop }),
        appliedRules: decision.appliedRules,
      });
      return;
    }

    // GET /signals - what the system currently believes about this runner, and what it cannot see.
    if (segments.length === 1 && segments[0] === "signals") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /signals");
      const plan = repository.latestPlanVersionFor(userId, today);
      if (plan === undefined) return fail(response, 404, "no-plan", "no plan version covers this day yet");
      const output = computeSignals({
        userId,
        today,
        entries: repository.listEntries(userId),
        plan,
        knowledge,
        computedAt: at,
      });
      sendJson(response, 200, { asOfDay: today, signals: output.signals, unavailable: output.unavailable });
      return;
    }
    // GET /reviews/candidates - what the corpus rules would say, without opening anything.
    //
    // Opening needs candidate options with diffs and costs, and the engine that produces those is M3's re-planning
    // engine. This route stops exactly where the evidence ends: it reports the candidate and the rules it could not
    // evaluate, and it never invents an option to make a review look ready.
    if (segments.length === 2 && segments[0] === "reviews" && segments[1] === "candidates") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /reviews/candidates");
      const plan = repository.latestPlanVersionFor(userId, today);
      if (plan === undefined) return fail(response, 404, "no-plan", "no plan version covers this day yet");
      const signals = computeSignals({
        userId,
        today,
        entries: repository.listEntries(userId),
        plan,
        knowledge,
        computedAt: at,
      });
      const output = evaluateTriggers({ userId, today, signals, knowledge });
      sendJson(response, 200, {
        asOfDay: today,
        candidate: output.candidate ?? null,
        fired: output.fired,
        unevaluable: output.unevaluable,
      });
      return;
    }

    // GET /entries/:day
    if (segments.length === 2 && segments[0] === "entries") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /entries/:day");
      const day = segments[1] ?? "";
      const revisions = repository.listEntriesForDay(userId, day);
      const current: DayEntry | undefined = revisions[revisions.length - 1];
      sendJson(response, 200, {
        revisions,
        ...(current === undefined ? {} : { current }),
        comments: repository.listComments(userId, day),
      });
      return;
    }

    // POST /reviews/:reviewId/decision
    if (segments.length === 3 && segments[0] === "reviews" && segments[2] === "decision") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /reviews/:reviewId/decision");
      const review = repository.getReview(userId, segments[1] ?? "");
      if (review === undefined) return fail(response, 404, "not-found", "no such review for this user");
      const body = await readBody(request);
      if (!isObject(body) || !isObject(body.decision)) return fail(response, 400, "invalid-body", "expected { decision: { kind } }");
      const result = decideReview(review, body.decision as unknown as Decision, today, knowledge);
      if (result.status === "refused") return fail(response, 409, result.code, result.detail);
      repository.saveReview(result.review);
      sendJson(response, 200, {
        status: result.status,
        review: result.review,
        ...(result.status === "accepted" ? { applyFromDay: result.applyFromDay, resultDiffId: result.resultDiffId } : {}),
        ...(result.status === "rejected" ? { reason: result.reason } : {}),
        ...(result.status === "deferred" ? { recheckDay: result.recheckDay } : {}),
      });
      return;
    }

    fail(response, 404, "not-found", `no route for ${method} ${url.pathname}`);
  }
}

/** Start the API on a port. Separated from createApi so tests can listen on port 0. */
export function startApi(options: ApiOptions & { port: number }): ReturnType<typeof createServer> {
  const server = createServer(createApi(options));
  server.listen(options.port);
  return server;
}
