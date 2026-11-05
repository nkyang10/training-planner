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
import { athleteProfileSchema, CONNECTION_PROVIDERS, isSyncSource, planVersionSchema } from "@training-planner/domain";
import type { Connection, DayEntry, PlanDiff, PlanVersion, SyncPreference } from "@training-planner/domain";
import { painReportsOf, painTrendOf, submitEntry } from "@training-planner/entries";
import type { EntryDraft } from "@training-planner/entries";
import { format, isLocale, messagesFor, weekdayName } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import { canonicalJson, hashOf, loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { renderAdjustment, renderComment } from "@training-planner/narrator";
import { addDays, daysBetween, generatePlan, uuidFrom } from "@training-planner/planner-core";
import type { Evidence, PlanState } from "@training-planner/planner-core";
import { ADJUST_COST_KEYS, evaluatePolicy } from "@training-planner/policy";
import { ADVISOR_REASON_CODES, buildAdvisorRequest, validateProposal } from "@training-planner/advisor";
import { selectCoachReferences } from "@training-planner/coach";
import { buildCoachChatRequest, validateCoachReply } from "@training-planner/coach-chat";
import type { CoachChatRequest } from "@training-planner/coach-chat";
import type { ModelPort } from "@training-planner/advisor";
import { diffPlans } from "@training-planner/planner-core";
import { childPlanVersion } from "@training-planner/replan";
import {
  latestWizardAnswers,
  nextWizardRevision,
  originalWizardAnswers,
  profileDiffOf,
  profileFromWizard,
  validateWizardAnswer,
  wizardProgress,
  WIZARD_STEPS,
} from "@training-planner/domain";
import type { WizardStepId } from "@training-planner/domain";
import { guidelineSchema } from "@training-planner/domain";
import { computeSignals } from "@training-planner/signals";
import { createGarminClient, GarminError, mapGarminActivity } from "./garmin";
import type { GarminClient } from "./garmin";
import { evaluateTriggers } from "@training-planner/triggers";
import { decideReview, openReview } from "@training-planner/review";
import type { ProposedOption, ReviewCandidate } from "@training-planner/review";
import { decideNudge } from "@training-planner/nudges";
import { seasonSummary } from "@training-planner/season";
import { evidenceFromPlan, proposeOrientationReplan, proposePlanOptions } from "@training-planner/replan";
import type { Decision } from "@training-planner/review";
import { DuplicateIdempotencyError, exportDocument } from "@training-planner/storage";
import type { CommentRecord, Repository, Sessions } from "@training-planner/storage";
import { localClockOf } from "./local-clock";

export interface ApiOptions {
  repository: Repository;
  sessions: Sessions;
  knowledge?: KnowledgeBundle;
  /** The clock is injected: the API is the composition root, and a test must be able to freeze the day. */
  now?: () => string;
  /**
   * The zone a prompt's local hour is computed in. The deployment's default until profile sync owns it (M4);
   * never guessed per request, because a quiet-hours decision made in the wrong zone is a prompt at 03:00.
   */
  timezone?: string;
  /**
   * The single operator's token (ADR-0009). Absent means the admin routes are closed, not open: a deployment that
   * forgot to configure an operator must not hand guideline-writing to every runner.
   */
  operatorToken?: string;
  /**
   * The model port (ADR-0009). Absent means no model is wired: the advisor route answers 503 and the deterministic
   * path is the only path. P3a injects a fake in tests; P3b injects a provider client behind consent and a budget.
   */
  modelPort?: ModelPort;
  /** What the audit row calls the model. A deployment names the provider; tests name the fake. */
  modelId?: string;
  /** The Garmin Personal API client; tests inject a fake, a deployment uses the real fetch client. */
  garminClient?: GarminClient;
  /** The conversational coach port (ADR-0011); absent means the coach page explains it is not configured. */
  coachChatPort?: { complete(request: CoachChatRequest, context: { userId: string }): Promise<unknown> };
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

function localeOf(request: IncomingMessage, body: Record<string, unknown> = {}): Locale {
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
  const timezone = options.timezone ?? "Asia/Taipei";
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

    // The operator's guideline console (ADR-0009). Deliberately before the runner session: an operator is not a
    // runner, and a guideline write must not be reachable with a runner's token.
    if (segments[0] === "admin" && segments[1] === "guidelines") {
      const expected = options.operatorToken;
      const presented = request.headers.authorization ?? "";
      if (expected === undefined || expected.length === 0 || presented !== `Bearer ${expected}`) {
        return fail(response, 403, "forbidden", "the operator token is required");
      }
      if (segments.length !== 2) return fail(response, 404, "not-found", "no such admin route");
      if (method === "GET") {
        sendJson(response, 200, { status: "ok", guidelines: repository.listGuidelines() });
        return;
      }
      if (method === "POST") {
        const parsed = guidelineSchema.safeParse(await readBody(request));
        if (!parsed.success) {
          return fail(response, 400, "invalid-body", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
        }
        try {
          repository.saveGuideline(parsed.data);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          if (detail.includes("already exists")) return fail(response, 409, "duplicate-version", detail);
          throw error;
        }
        sendJson(response, 201, { status: "ok", guideline: parsed.data });
        return;
      }
      return fail(response, 405, "method-not-allowed", "use GET or POST /admin/guidelines");
    }

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
        // The pain the entry carries becomes rows of its own, with ids derived from the entry: a replay writes the
        // same rows, and the triage gets a trajectory instead of an array read out of one day (row 19).
        for (const report of painReportsOf({ userId, entry: result.entry })) repository.savePainReport(report);
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

    // GET /prompts/next - the daily prompt policy, with delivery recorded when it says yes.
    //
    // The policy is pure (packages/nudges); this route supplies the clock, the local logging hours and the delivery
    // log, and it records a delivery because a prompt the API handed out is a prompt the runner received.
    if (segments.length === 2 && segments[0] === "prompts" && segments[1] === "next") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /prompts/next");
      const plan = repository.latestPlanVersionFor(userId, today) ?? null;
      const entries = repository.listEntries(userId);
      const deliveries = repository.listPromptDeliveries(userId);
      const clock = localClockOf(at, timezone);
      const decision = decideNudge({
        userId,
        today,
        nowMinute: clock.hour * 60 + clock.minute,
        entries,
        plan,
        delivered: deliveries.map((delivery) => ({ kind: delivery.kind, day: delivery.day })),
        loggingHours: entries.map((entry) => localClockOf(entry.clientSubmittedAt ?? at, timezone).hour),
        knowledge,
      });

      if (decision.prompt === null) {
        sendJson(response, 200, { status: "none", reason: decision.reason, evidence: decision.evidence, budget: decision.budget });
        return;
      }

      repository.savePromptDelivery({
        userId,
        kind: "nudge",
        day: today,
        forDay: decision.prompt.forDay,
        atMinute: decision.prompt.atMinute,
      });
      const locale = localeOf(request);
      const messages = messagesFor(locale);
      const template = decision.prompt.forDay === today ? "prompt.log-day" : "prompt.log-gap";
      sendJson(response, 201, {
        status: "prompt",
        prompt: {
          kind: "nudge",
          text: format(messages.prompt[template], { weekday: weekdayName(locale, decision.prompt.forDay) }),
          forDay: decision.prompt.forDay,
          atMinute: decision.prompt.atMinute,
        },
        reason: decision.reason,
        evidence: decision.evidence,
        budget: decision.budget,
      });
      return;
    }

    // GET /pain - the runner's pain reports as rows, oldest day first.
    if (segments.length === 1 && segments[0] === "pain") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /pain");
      const reports = repository.listPainReports(userId);
      sendJson(response, 200, { status: "ok", reports, trend: painTrendOf({ reports, today }) });
      return;
    }

    // GET /season - the plan's weeks, planned against done, from packages/season.
    if (segments.length === 1 && segments[0] === "season") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /season");
      const plan = repository.latestPlanVersionFor(userId, today) ?? null;
      if (plan === null) {
        sendJson(response, 200, { status: "no-plan" });
        return;
      }
      sendJson(response, 200, {
        status: "ok",
        summary: seasonSummary({ plan, entries: repository.listEntries(userId), today }),
      });
      return;
    }

    // GET /export - the runner's data in one document. The assembly is packages/storage's exportDocument, so the
    // API and the web page cannot disagree about what "my data" means.
    if (segments.length === 1 && segments[0] === "export") {
      if (method !== "GET") return fail(response, 405, "method-not-allowed", "use GET /export");
      sendJson(response, 200, { status: "ok", export: exportDocument(repository, userId, at) });
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
    // Coach conversation (ADR-0011): context is rebuilt from facts, the reply is grounded and stored, and a change
    // still has to become a review the runner decides.
    if (segments[0] === "coach" && segments.length >= 2 && segments[1] === "messages") {
      if (method === "GET") {
        sendJson(response, 200, { messages: repository.listCoachMessages(userId, 30) });
        return;
      }
      if (method === "POST") {
        const body = await readBody(request);
        if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
        const question = typeof body["question"] === "string" ? body["question"].trim() : "";
        if (question.length === 0 || question.length > 500) {
          return fail(response, 400, "invalid-question", "question must be 1..500 characters");
        }
        const rawAttachments = Array.isArray(body["attachments"]) ? body["attachments"] : [];
        if (rawAttachments.length > 3) return fail(response, 400, "too-many-attachments", "at most 3 images per turn");
        const allowedTypes = ["image/png", "image/jpeg", "image/webp"] as const;
        const attachments = rawAttachments.map((candidate) => {
          if (typeof candidate !== "object" || candidate === null) return null;
          const item = candidate as Record<string, unknown>;
          const attachmentId = typeof item["attachmentId"] === "string" ? item["attachmentId"] : "";
          const filename = typeof item["filename"] === "string" ? item["filename"].slice(0, 120) : "photo";
          const contentType = typeof item["contentType"] === "string" ? item["contentType"] : "";
          const sizeBytes = typeof item["sizeBytes"] === "number" ? item["sizeBytes"] : 0;
          const kind = item["kind"] === "record" ? "record" : "photo";
          if (attachmentId.length === 0 || sizeBytes <= 0 || sizeBytes > 5_000_000) return null;
          if (!(allowedTypes as readonly string[]).includes(contentType)) return null;
          return { attachmentId, filename, contentType: contentType as (typeof allowedTypes)[number], sizeBytes, kind: kind as "photo" | "record" };
        });
        if (attachments.some((attachment) => attachment === null)) {
          return fail(response, 400, "invalid-attachment", "attachments must be png/jpeg/webp up to 5 MB");
        }
        const validAttachments = attachments.filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);
        const images =
          process.env.TRAINING_PLANNER_MODEL_VISION === "1"
            ? rawAttachments.flatMap((candidate) => {
                if (typeof candidate !== "object" || candidate === null) return [];
                const item = candidate as Record<string, unknown>;
                const dataBase64 = typeof item["dataBase64"] === "string" ? item["dataBase64"] : "";
                const contentType = typeof item["contentType"] === "string" ? item["contentType"] : "";
                if (dataBase64.length === 0 || dataBase64.length > 2_100_000) return [];
                return [{ contentType, dataBase64 }];
              })
            : [];
        const port = options.coachChatPort;
        if (port === undefined) return fail(response, 503, "coach-not-configured", "no model is wired for the coach conversation");
        const plan = repository.latestPlanVersionFor(userId, today);
        if (plan === undefined) return fail(response, 404, "no-plan", "no plan version covers this day yet");
        const entries = repository.listEntries(userId).filter((entry) => entry.day <= today).slice(-7);
        const pain = entries.some((entry) => (entry.pain ?? []).length > 0);
        const missed = entries.filter((entry) => entry.outcome === "missed").length;
        const highRpe = entries.some((entry) => (entry.rpe ?? 0) >= 8);
        const references = selectCoachReferences({ kind: "comment", pain, missedSessions: missed, highRpe, reviewOptionsCount: 0 });
        const plannedKm = plan.sessions.reduce((total, session) => total + (session.distanceKm ?? 0), 0);
        const facts = {
          today,
          planSummary: `${plan.sessions.length} sessions, ${Math.round(plannedKm * 10) / 10} km planned`,
          recentEntries: entries.map((entry) => `${entry.day} ${entry.outcome} ${entry.completedKm ?? 0} km${(entry.pain ?? []).length > 0 ? ", pain reported" : ""}`),
          comment: repository.listComments(userId, today)[0]?.text ?? null,
          references: references.map((reference) => ({ id: reference.id, text: reference.text, tier: reference.tier })),
          ...(validAttachments.length === 0 ? {} : { attachments: validAttachments.length }),
        };
        const history = repository.listCoachMessages(userId, 12).map((message) => ({ role: message.role, text: message.text }));
        const coachRequest = buildCoachChatRequest({ facts, history, question, ...(images.length === 0 ? {} : { images }) });
        let output: unknown;
        try {
          output = await port.complete(coachRequest, { userId });
        } catch (error) {
          return fail(response, 502, "coach-failed", error instanceof Error ? error.message : String(error));
        }
        const validated = validateCoachReply(output, facts, question);
        if (!validated.ok) {
          return fail(response, 422, "coach-invalid", `${validated.code}: ${validated.detail}`);
        }
        const contextHash = hashOf(canonicalJson(facts));
        const userMessage = {
          messageId: uuidFrom({ userId, day: today, role: "user", text: question, nonce: String(repository.listCoachMessages(userId, 1).length) }),
          userId,
          role: "user" as const,
          text: question,
          createdAt: at,
          contextHash,
          reviewId: null,
          ...(validAttachments.length === 0 ? {} : { attachments: validAttachments }),
        };
        const coachMessage = {
          messageId: uuidFrom({ userId, day: today, role: "coach", text: validated.reply.reply, nonce: `${history.length}:${question.length}` }),
          userId,
          role: "coach" as const,
          text: validated.reply.reply,
          createdAt: at,
          contextHash,
          reviewId: null,
        };
        repository.appendCoachMessage(userMessage);
        repository.appendCoachMessage(coachMessage);
        sendJson(response, 201, { reply: validated.reply, messages: repository.listCoachMessages(userId, 30) });
        return;
      }
    }

    // POST /reviews/open - the full chain: log -> signals -> triggers -> bounded options -> an open review.
    //
    // It stores the review and the diffs it offered, and it stores no plan version: a proposed version becomes real
    // only when the runner accepts, which is the next slice. Opening is still refused by packages/review's guards
    // (budget, dwell, cooldown), because that is the one place allowed to decide whether a review may exist.
    if (segments.length === 2 && segments[0] === "reviews" && segments[1] === "open") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /reviews/open");
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
      const triggers = evaluateTriggers({ userId, today, signals, knowledge });
      if (triggers.candidate === undefined) {
        sendJson(response, 200, { status: "none", fired: [], unevaluable: triggers.unevaluable });
        return;
      }

      const proposal = proposePlanOptions({ plan, today, candidate: triggers.candidate, knowledge });
      if (proposal.options.length < 2) {
        sendJson(response, 200, { status: "no-option", refusals: proposal.refusals });
        return;
      }

      const history = repository.listReviews(userId);
      const weekAgo = addDays(today, -7);
      const promptsThisWeek = history.filter((review) => review.openedAtDay > weekAgo).length;
      const accepted = history
        .filter((review) => review.status === "accepted" && review.decidedAtDay !== null && review.decidedAtDay !== undefined)
        .sort((a, b) => ((a.decidedAtDay ?? "") < (b.decidedAtDay ?? "") ? 1 : -1))[0];
      const sameKind = history
        .filter((review) => review.evidence.ruleIds.includes(triggers.candidate?.ruleId ?? ""))
        .sort((a, b) => (a.openedAtDay < b.openedAtDay ? 1 : -1))[0];

      const proposed: ProposedOption[] = proposal.options.map((option) => ({
        optionId: option.optionId,
        labelKey: option.labelKey,
        keepAsIs: option.keepAsIs,
        diffId: option.diffId,
        costKey: option.costKey,
        costSlots: option.costSlots,
        loadDeltaPct: option.loadDeltaPct,
        // ADR-0010: the kind travels with the option; absent means edit, which is every option this engine offers.
        ...(option.kind === undefined ? {} : { kind: option.kind }),
        ...(option.planVersionId === undefined ? {} : { planVersionId: option.planVersionId }),
        ...(option.changeSummary === undefined ? {} : { changeSummary: option.changeSummary }),
      }));

      const opened = openReview({
        userId,
        today,
        candidate: triggers.candidate,
        knowledge,
        options: proposed,
        // The narrator renders the cost for the wire; until it is wired here, the key and slots are the record.
        renderCost: (option) => `${option.costKey} ${JSON.stringify(option.costSlots)}`,
        promptsThisWeek,
        daysSinceAcceptedReview:
          accepted?.decidedAtDay === undefined || accepted?.decidedAtDay === null ? null : daysBetween(accepted.decidedAtDay, today),
        daysSinceTrigger: { [triggers.candidate.kind]: sameKind === undefined ? null : daysBetween(sameKind.openedAtDay, today) },
      });

      if (opened.status === "suppressed") {
        sendJson(response, 200, { status: "suppressed", reason: opened.reason, detail: opened.detail, ruleId: opened.ruleId });
        return;
      }
      if (opened.status === "refused") {
        return fail(response, 409, opened.code, opened.detail);
      }

      for (const option of proposal.options) {
        // The diff is the review s evidence; the version is staged until the runner accepts it. Neither is active.
        if (option.diff !== null) repository.savePlanDiff(option.diff);
        if (option.version !== null) repository.saveProposedPlanVersion(option.version);
      }
      repository.saveReview(opened.review);
      sendJson(response, 201, {
        status: "opened",
        review: opened.review,
        options: proposed,
        refusals: proposal.refusals,
        unevaluable: triggers.unevaluable,
      });
      return;
    }

    // POST /reviews/advisor - the AI reviewer's decision loop (ADR-0009). The model decides whether to propose;
    // every answer is validated, every answer is audited, and a rejected proposal falls back to the deterministic path.
    if (segments.length === 2 && segments[0] === "reviews" && segments[1] === "advisor") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /reviews/advisor");
      const plan = repository.latestPlanVersionFor(userId, today);
      if (plan === undefined) return fail(response, 404, "no-plan", "no plan version covers this day yet");
      const consent = repository.getLlmConsent(userId);
      if (consent === undefined || consent.granted !== true) {
        return fail(response, 403, "consent-required", "a hosted model may only be called when the runner has granted consent");
      }
      const port = options.modelPort;
      if (port === undefined) {
        return fail(response, 503, "no-model", "no model port is configured; the deterministic path is the only path");
      }

      const stored = repository.getAthleteProfile(userId);
      const folded = stored === undefined ? undefined : profileFromWizard(stored, repository.listWizardAnswers(userId));
      const profile = folded !== undefined && folded.ok && folded.profile !== undefined ? folded.profile : stored;
      const signals = computeSignals({
        userId,
        today,
        entries: repository.listEntries(userId),
        plan,
        knowledge,
        computedAt: at,
      }).signals;

      // The coach's memory: recent facts select curated passages, safety first. The passages are guidance for language,
      // never permission to change a number; the validator still owns every gate.
      const recentEntries = repository
        .listEntries(userId)
        .filter((entry) => entry.day <= today)
        .slice(-14);
      const references = selectCoachReferences({
        kind: "review",
        pain: recentEntries.some((entry) => (entry.pain ?? []).length > 0),
        missedSessions: recentEntries.filter((entry) => entry.outcome === "missed").length,
        highRpe: recentEntries.some((entry) => (entry.rpe ?? 0) >= 8),
        reviewOptionsCount: 0,
      });
      const call = buildAdvisorRequest({
        plan,
        entries: repository.listEntries(userId),
        signals,
        wizardAnswers: repository.listWizardAnswers(userId),
        settings: {
          riskAppetite: profile?.goal.riskAppetite ?? null,
          weeklyHours: null,
          dislikedKinds: [],
          preferredLongDay: profile?.availability.preferredLongRunDay ?? null,
        },
        ...(profile === undefined ? {} : { profile }),
        guidelines: repository.listGuidelines(),
        today,
        knowledge,
        allowedCostKeys: [...ADJUST_COST_KEYS],
        allowedReasonCodes: [...ADVISOR_REASON_CODES],
        references,
      });

      let output: unknown;
      try {
        output = await port.complete(call, { userId });
      } catch (error) {
        // A provider outage must be invisible to the runner: the deterministic path is the fallback, not an error page.
        // A budget or an open breaker is a state, not a failure, and it is named as such.
        const detail = error instanceof Error ? error.message : String(error);
        const code = detail.startsWith("budget-exceeded")
          ? "budget-exceeded"
          : detail.startsWith("circuit-open")
            ? "circuit-open"
            : "model-failed";
        sendJson(response, 200, { status: code, fallback: "deterministic-replan", detail });
        return;
      }

      const verdict = validateProposal({ output, request: call.request, plan, today, knowledge });
      const auditBase = {
        userId,
        day: today,
        guidelineVersionHash: call.hashes.guidelineVersionHash,
        model: options.modelId ?? "injected-port",
        promptHash: call.hashes.promptHash,
        output: output ?? null,
        validatorVerdict: verdict.accepted ? ("accepted" as const) : ("rejected" as const),
        fallbackUsed: !verdict.accepted,
        createdAt: at,
      };
      const auditId = uuidFrom({ type: "ai.review.proposal", userId, day: today, promptHash: call.hashes.promptHash });

      if (!verdict.accepted || verdict.proposal === undefined) {
        repository.saveAiReviewProposal({ ...auditBase, id: auditId, reviewId: null });
        sendJson(response, 200, { status: "rejected", violations: verdict.violations, fallback: verdict.fallback, audit: { id: auditId } });
        return;
      }

      const proposal = verdict.proposal;
      if (proposal.decision === "no-change") {
        repository.saveAiReviewProposal({ ...auditBase, id: auditId, reviewId: null });
        sendJson(response, 200, { status: "no-change", proposal, audit: { id: auditId } });
        return;
      }

      // Each proposed change becomes one edit option: one change, one child version, one diff. A change that does not
      // produce exactly one diff is not offerable - the review would be claiming a change it cannot show.
      const proposedOptions: ProposedOption[] = [
        { optionId: "keep", labelKey: "keep-the-plan", keepAsIs: true, diffId: null, costKey: "risk-noted", costSlots: {}, loadDeltaPct: 0 },
      ];
      const stagedVersions: PlanVersion[] = [];
      const stagedDiffs: PlanDiff[] = [];
      const HARD = ["tempo", "vo2max", "hills", "mp", "test", "race"];
      for (const [index, change] of proposal.proposedChanges.entries()) {
        const sessions = plan.sessions.map((session) =>
          session.day === change.day
            ? {
                ...session,
                kind: change.kind as PlanVersion["sessions"][number]["kind"],
                hardDay: HARD.includes(change.kind),
                targetRpe: null,
                distanceKm: change.toKm,
                summaryText: `${change.kind} ${change.toKm} km`,
              }
            : session,
        );
        const child = childPlanVersion(plan, sessions, today, `advisor-${index}`);
        const diff = diffPlans(plan, child, {
          createdAtDay: today,
          knowledgeHash: knowledge.hash,
          maxChanges: 2,
          reason: "advisor-proposal",
          signalIds: [],
          expectedCost: change.costKey,
          knobsUsed: [],
        });
        if (diff.changes.length !== 1) continue;
        const loadDeltaPct =
          change.fromKm === 0 ? 0 : Math.round(((change.toKm - change.fromKm) / change.fromKm) * 1000) / 10;
        proposedOptions.push({
          optionId: `advisor-${index}`,
          labelKey: "advisor-proposal",
          keepAsIs: false,
          kind: "edit",
          diffId: diff.diffId,
          costKey: change.costKey,
          costSlots: change.costSlots,
          loadDeltaPct,
        });
        stagedVersions.push(child);
        stagedDiffs.push(diff);
      }

      if (proposedOptions.length < 2) {
        repository.saveAiReviewProposal({ ...auditBase, id: auditId, reviewId: null });
        sendJson(response, 200, { status: "no-offerable-option", fallback: "deterministic-replan", audit: { id: auditId } });
        return;
      }

      const history = repository.listReviews(userId);
      const weekAgo = addDays(today, -7);
      const promptsThisWeek = history.filter((review) => review.openedAtDay > weekAgo).length;
      const accepted = history
        .filter((review) => review.status === "accepted" && review.decidedAtDay !== null && review.decidedAtDay !== undefined)
        .sort((a, b) => ((a.decidedAtDay ?? "") < (b.decidedAtDay ?? "") ? 1 : -1))[0];

      const opened = openReview({
        userId,
        today,
        candidate: {
          kind: "manual",
          ruleId: null,
          anchor: null,
          evidence: { signalIds: [], ruleIds: [], evidenceGradeMax: "C" },
          presentation: "recorded",
        },
        knowledge,
        options: proposedOptions,
        renderCost: (option) => `${option.costKey} ${JSON.stringify(option.costSlots)}`,
        promptsThisWeek,
        daysSinceAcceptedReview:
          accepted?.decidedAtDay === undefined || accepted?.decidedAtDay === null ? null : daysBetween(accepted.decidedAtDay, today),
        daysSinceTrigger: { manual: null },
      });

      if (opened.status === "suppressed") {
        repository.saveAiReviewProposal({ ...auditBase, id: auditId, reviewId: null });
        sendJson(response, 200, { status: "suppressed", reason: opened.reason, detail: opened.detail, audit: { id: auditId } });
        return;
      }
      if (opened.status === "refused") {
        repository.saveAiReviewProposal({ ...auditBase, id: auditId, reviewId: null });
        return fail(response, 409, opened.code, opened.detail);
      }

      repository.saveAiReviewProposal({ ...auditBase, id: auditId, reviewId: opened.review.reviewId });
      for (const version of stagedVersions) repository.saveProposedPlanVersion(version);
      for (const diff of stagedDiffs) repository.savePlanDiff(diff);
      repository.saveReview(opened.review);
      sendJson(response, 201, {
        status: "opened",
        review: opened.review,
        options: proposedOptions,
        proposal: { reasonCode: proposal.reasonCode, confidence: proposal.confidence, needsHuman: proposal.needsHuman },
        audit: { id: auditId, validatorVerdict: "accepted" },
        note: "the model proposed; the deterministic gates accepted; the runner decides",
      });
      return;
    }

    // Connections (2026-11-05): the runner links an external account and chooses which provider to sync from. A record
    // never holds a secret - it says where the secret lives - and a flow that cannot work says so.
    if (segments[0] === "connections") {
      const garmin = options.garminClient ?? createGarminClient();
      const connectionOr = (provider: Connection["provider"]): Connection =>
        repository.getConnection(userId, provider) ?? {
          userId,
          provider,
          status: "not-connected",
          externalAthleteId: null,
          displayName: null,
          scope: null,
          connectedAt: null,
          lastSyncAt: null,
          lastSyncStatus: null,
          lastSyncDetail: null,
          credentialRef: null,
          hasCredential: false,
        };
      const syncOr = (): SyncPreference =>
        repository.getSyncPreference(userId) ?? { userId, source: "manual", updatedAt: "" };

      if (segments.length === 1 && method === "GET") {
        sendJson(response, 200, { connections: CONNECTION_PROVIDERS.map((provider) => connectionOr(provider)), sync: syncOr() });
        return;
      }

      if (segments.length === 3 && segments[1] === "strava" && segments[2] === "start" && method === "GET") {
        const clientId = process.env.STRAVA_CLIENT_ID;
        const secret = process.env.STRAVA_CLIENT_SECRET;
        const redirectUri = process.env.STRAVA_REDIRECT_URI;
        if (clientId === undefined || clientId.length === 0 || secret === undefined || secret.length === 0 || redirectUri === undefined || redirectUri.length === 0) {
          return fail(response, 503, "strava-not-configured", "set STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and STRAVA_REDIRECT_URI (a registered Strava app and a public callback)");
        }
        const authorizeUrl = `https://www.strava.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&approval_prompt=auto&scope=activity%3Aread&state=${encodeURIComponent(uuidFrom({ userId, type: "strava.oauth.state", day: today }))}`;
        sendJson(response, 200, { authorizeUrl });
        return;
      }

      if (segments.length === 3 && segments[1] === "strava" && segments[2] === "callback" && method === "GET") {
        return fail(response, 501, "strava-callback-not-implemented", "a callback needs a CSRF state store and a secret store; neither exists in this build, so no code is exchanged");
      }

      if (segments.length === 3 && segments[1] === "strava" && segments[2] === "sync" && method === "POST") {
        return fail(response, 503, "strava-not-configured", "no Strava application is configured; nothing was fetched");
      }

      if (segments.length === 3 && segments[1] === "garmin" && segments[2] === "token" && method === "POST") {
        const body = await readBody(request);
        if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
        const fromBody = typeof body["apiKey"] === "string" && body["apiKey"].trim().length > 0 ? body["apiKey"].trim() : undefined;
        const apiKey = fromBody ?? process.env.GARMIN_PERSONAL_API_KEY;
        if (apiKey === undefined || apiKey.length === 0) {
          return fail(response, 503, "garmin-not-configured", "set GARMIN_PERSONAL_API_KEY or paste a Garmin Personal API key");
        }
        try {
          const token = await garmin.obtainToken(apiKey);
          const profile = await garmin.profile(token);
          const connection: Connection = {
            userId,
            provider: "garmin",
            status: "connected",
            externalAthleteId: null,
            displayName: profile.displayName,
            scope: null,
            connectedAt: at,
            lastSyncAt: null,
            lastSyncStatus: null,
            lastSyncDetail: null,
            credentialRef: "env:GARMIN_PERSONAL_API_KEY",
            hasCredential: true,
          };
          repository.saveConnection(connection);
          sendJson(response, 200, { connection });
        } catch (error) {
          const detail = error instanceof GarminError ? error.message : error instanceof Error ? error.message : String(error);
          return fail(response, 502, "garmin-token-failed", detail);
        }
        return;
      }

      if (segments.length === 3 && segments[1] === "garmin" && segments[2] === "sync" && method === "POST") {
        const connection = repository.getConnection(userId, "garmin");
        if (connection === undefined || connection.status !== "connected") {
          return fail(response, 409, "not-connected", "link Garmin first");
        }
        const body = await readBody(request);
        if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
        const from = typeof body["from"] === "string" ? body["from"] : "";
        const to = typeof body["to"] === "string" ? body["to"] : "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) {
          return fail(response, 400, "invalid-range", "from/to must be ISO days with from <= to");
        }
        const apiKey = process.env.GARMIN_PERSONAL_API_KEY;
        if (apiKey === undefined || apiKey.length === 0) {
          return fail(response, 503, "garmin-not-configured", "set GARMIN_PERSONAL_API_KEY; nothing was fetched");
        }
        let imported = 0;
        let skipped = 0;
        try {
          const token = await garmin.obtainToken(apiKey);
          const activities = await garmin.activities(token, from, to);
          for (const activity of activities) {
            const day = typeof activity.startTimeLocal === "string" ? activity.startTimeLocal.slice(0, 10) : "";
            const metres = typeof activity.distance === "number" ? activity.distance : 0;
            if (day.length === 0 || day < from || day > to || !(metres > 0)) {
              skipped += 1;
              continue;
            }
            const draft = mapGarminActivity(activity, timezone);
            if (draft === undefined) {
              skipped += 1;
              continue;
            }
            const result = submitEntry(
              draft,
              { entries: repository.listEntriesForDay(userId, day), events: repository.listEvents(userId) },
              { userId, today, occurredAt: at, knowledge },
            );
            if (result.status === "accepted") {
              repository.appendEntryWithEventAndPointer({
                entry: result.entry,
                event: result.event,
                ...(result.superseded === undefined ? {} : { superseded: result.superseded }),
              });
              for (const report of painReportsOf({ userId, entry: result.entry })) repository.savePainReport(report);
              imported += 1;
            } else {
              skipped += 1;
            }
          }
        } catch (error) {
          const detail = error instanceof GarminError ? error.message : error instanceof Error ? error.message : String(error);
          repository.saveConnection({ ...connection, lastSyncAt: at, lastSyncStatus: "failed", lastSyncDetail: detail });
          return fail(response, 502, "garmin-sync-failed", detail);
        }
        const detail = `${imported} imported, ${skipped} skipped`;
        repository.saveConnection({ ...connection, lastSyncAt: at, lastSyncStatus: "ok", lastSyncDetail: detail });
        sendJson(response, 200, { imported, skipped, detail });
        return;
      }

      if (segments.length === 2 && segments[1] === "sync-preference" && method === "POST") {
        const body = await readBody(request);
        if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
        const source = typeof body["source"] === "string" ? body["source"] : "";
        if (!isSyncSource(source)) {
          return fail(response, 400, "invalid-source", "source must be manual, strava, garmin or both");
        }
        const sync: SyncPreference = { userId, source, updatedAt: at };
        repository.saveSyncPreference(sync);
        sendJson(response, 200, { sync });
        return;
      }

      return fail(response, 404, "not-found", "no such connections route");
    }
    // POST /reviews/orientation - offer the ADR-0010 re-plan option: a changed orientation, taken to a new block,
    // with the past and the freeze window kept. The option is staged; accepting it is the runner's decision.
    if (segments.length === 2 && segments[0] === "reviews" && segments[1] === "orientation") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /reviews/orientation");
      const plan = repository.latestPlanVersionFor(userId, today);
      if (plan === undefined) return fail(response, 404, "no-plan", "no plan version covers this day yet");
      const stored = repository.getAthleteProfile(userId);
      if (stored === undefined) return fail(response, 400, "no-profile", "save a profile first (POST /wizard/apply)");
      const folded = profileFromWizard(stored, repository.listWizardAnswers(userId));
      if (!folded.ok || folded.profile === undefined) {
        return fail(response, 400, "invalid-profile", folded.detail ?? "the folded profile is not valid");
      }
      const orientationDiff = profileDiffOf(stored, folded.profile);
      if (orientationDiff.length === 0) {
        return fail(response, 409, "no-change", "the answers already match the stored profile; there is nothing to re-plan for");
      }
      const evidence = evidenceFromPlan(plan, today);
      if (evidence === null) return fail(response, 400, "no-history", "the plan has no days up to today to derive evidence from");

      const proposal = proposeOrientationReplan({
        plan,
        profile: folded.profile,
        evidence,
        today,
        seed: `orientation-${today}-${stored.revision}`,
        knowledge,
      });
      if (proposal.invariantViolations.length > 0) {
        sendJson(response, 200, {
          status: "not-offerable",
          violations: proposal.invariantViolations,
          note: "the re-plan would violate the planner's own invariants; it is not offered, and the deterministic path stays",
        });
        return;
      }

      const summary = proposal.summary;
      const loadDeltaPct =
        summary.kmBefore === 0 ? 0 : Math.round(((summary.kmAfter - summary.kmBefore) / summary.kmBefore) * 1000) / 10;
      const proposed: ProposedOption[] = [
        { optionId: "keep", labelKey: "keep-the-plan", keepAsIs: true, diffId: null, costKey: "risk-noted", costSlots: {}, loadDeltaPct: 0 },
        {
          optionId: "replan",
          labelKey: "replan-for-orientation",
          keepAsIs: false,
          kind: "replan",
          planVersionId: proposal.version.versionId,
          changeSummary: summary,
          diffId: null,
          costKey: "the-block-is-recut",
          costSlots: { changes: summary.changes, kmBefore: summary.kmBefore, kmAfter: summary.kmAfter },
          loadDeltaPct,
        },
      ];

      const history = repository.listReviews(userId);
      const weekAgo = addDays(today, -7);
      const promptsThisWeek = history.filter((review) => review.openedAtDay > weekAgo).length;
      const accepted = history
        .filter((review) => review.status === "accepted" && review.decidedAtDay !== null && review.decidedAtDay !== undefined)
        .sort((a, b) => ((a.decidedAtDay ?? "") < (b.decidedAtDay ?? "") ? 1 : -1))[0];

      const opened = openReview({
        userId,
        today,
        candidate: {
          kind: "manual",
          ruleId: null,
          anchor: null,
          evidence: { signalIds: [], ruleIds: [], evidenceGradeMax: "C" },
          presentation: "recorded",
        },
        knowledge,
        options: proposed,
        renderCost: (option) =>
          option.kind === "replan"
            ? `the block is re-cut: ${summary.changes} days change, ${summary.kmBefore} km to ${summary.kmAfter} km`
            : "nothing changes",
        promptsThisWeek,
        daysSinceAcceptedReview:
          accepted?.decidedAtDay === undefined || accepted?.decidedAtDay === null ? null : daysBetween(accepted.decidedAtDay, today),
        daysSinceTrigger: { manual: null },
      });

      if (opened.status === "suppressed") {
        sendJson(response, 200, { status: "suppressed", reason: opened.reason, detail: opened.detail, ruleId: opened.ruleId });
        return;
      }
      if (opened.status === "refused") return fail(response, 409, opened.code, opened.detail);

      // Staged, never active: the version exists for the review to point at, and only an accept activates it.
      repository.saveProposedPlanVersion(proposal.version);
      repository.saveReview(opened.review);
      sendJson(response, 201, {
        status: "opened",
        review: opened.review,
        options: proposed,
        orientation: { changed: true, diff: orientationDiff },
        replan: { summary, exceedsReviewChangeLimit: proposal.exceedsReviewChangeLimit },
        note: "the re-plan is staged; accepting it activates the plan version, declining leaves the current plan",
      });
      return;
    }

    // POST /reviews/manual - a review the runner asked for (review-trigger-policy.md 1.1: "just check me",
    // "I changed my goal"). The candidate is manual, so packages/review records openedBy "user-request"; the options
    // are the same bounded set the engine may offer, and the runner still decides. Nothing here applies a change.
    if (segments.length === 2 && segments[0] === "reviews" && segments[1] === "manual") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /reviews/manual");
      const plan = repository.latestPlanVersionFor(userId, today);
      if (plan === undefined) return fail(response, 404, "no-plan", "no plan version covers this day yet");

      const candidate: ReviewCandidate = {
        kind: "manual",
        ruleId: null,
        anchor: null,
        evidence: { signalIds: [], ruleIds: [], evidenceGradeMax: "C" },
        presentation: "recorded",
      };
      const proposal = proposePlanOptions({ plan, today, candidate, knowledge });
      if (proposal.options.length < 2) {
        sendJson(response, 200, { status: "no-option", refusals: proposal.refusals });
        return;
      }

      // What the runner's answers would change in their stored profile, if anything. This is evidence for the
      // review, not a change: the plan is not regenerated here.
      const stored = repository.getAthleteProfile(userId);
      const folded = stored === undefined ? undefined : profileFromWizard(stored, repository.listWizardAnswers(userId));
      const orientationDiff =
        stored !== undefined && folded !== undefined && folded.ok && folded.profile !== undefined
          ? profileDiffOf(stored, folded.profile)
          : [];

      const history = repository.listReviews(userId);
      const weekAgo = addDays(today, -7);
      const promptsThisWeek = history.filter((review) => review.openedAtDay > weekAgo).length;
      const accepted = history
        .filter((review) => review.status === "accepted" && review.decidedAtDay !== null && review.decidedAtDay !== undefined)
        .sort((a, b) => ((a.decidedAtDay ?? "") < (b.decidedAtDay ?? "") ? 1 : -1))[0];

      const proposed: ProposedOption[] = proposal.options.map((option) => ({
        optionId: option.optionId,
        labelKey: option.labelKey,
        keepAsIs: option.keepAsIs,
        diffId: option.diffId,
        costKey: option.costKey,
        costSlots: option.costSlots,
        loadDeltaPct: option.loadDeltaPct,
        // ADR-0010: the kind travels with the option; absent means edit, which is every option this engine offers.
        ...(option.kind === undefined ? {} : { kind: option.kind }),
        ...(option.planVersionId === undefined ? {} : { planVersionId: option.planVersionId }),
        ...(option.changeSummary === undefined ? {} : { changeSummary: option.changeSummary }),
      }));

      const opened = openReview({
        userId,
        today,
        candidate,
        knowledge,
        options: proposed,
        renderCost: (option) => `${option.costKey} ${JSON.stringify(option.costSlots)}`,
        promptsThisWeek,
        daysSinceAcceptedReview:
          accepted?.decidedAtDay === undefined || accepted?.decidedAtDay === null ? null : daysBetween(accepted.decidedAtDay, today),
        daysSinceTrigger: { manual: null },
      });

      if (opened.status === "suppressed") {
        sendJson(response, 200, { status: "suppressed", reason: opened.reason, detail: opened.detail, ruleId: opened.ruleId });
        return;
      }
      if (opened.status === "refused") {
        return fail(response, 409, opened.code, opened.detail);
      }

      for (const option of proposal.options) {
        if (option.diff !== null) repository.savePlanDiff(option.diff);
        if (option.version !== null) repository.saveProposedPlanVersion(option.version);
      }
      repository.saveReview(opened.review);
      sendJson(response, 201, {
        status: "opened",
        review: opened.review,
        options: proposed,
        refusals: proposal.refusals,
        orientation: { changed: orientationDiff.length > 0, diff: orientationDiff },
        note: "the review proposes; the plan changes only when the runner accepts an option",
      });
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

      // An accepted change must become the plan the runner actually runs. Keep-the-plan has no diff, so there is
      // nothing to apply - and the active version stays exactly where it was.
      let appliedVersionId: string | null = null;
      if (result.status === "accepted") {
        // ADR-0010: an accepted replan activates the plan version it carried; an accepted edit activates the version
        // its diff predicts. Two kinds, one decision, and neither may invent a plan.
        try {
          if (result.option.kind === "replan" && result.option.planVersionId !== undefined && result.option.planVersionId !== null) {
            repository.activatePlanVersion(userId, result.option.planVersionId);
            appliedVersionId = result.option.planVersionId;
          } else if (result.resultDiffId !== null) {
            appliedVersionId = repository.activatePlanVersionForDiff(userId, result.resultDiffId).versionId;
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          return fail(response, 409, "missing-proposed-version", detail);
        }
      }

      repository.saveReview(result.review);
      sendJson(response, 200, {
        status: result.status,
        review: result.review,
        ...(result.status === "accepted" ? { applyFromDay: result.applyFromDay, resultDiffId: result.resultDiffId, appliedVersionId } : {}),
        ...(result.status === "rejected" ? { reason: result.reason } : {}),
        ...(result.status === "deferred" ? { recheckDay: result.recheckDay } : {}),
      });
      return;
    }

    // GET /wizard - the onboarding steps and what the runner has answered (ADR-0009).
    if (segments.length === 1 && segments[0] === "wizard") {
      if (method === "GET") {
        const answers = repository.listWizardAnswers(userId);
        sendJson(response, 200, {
          status: "ok",
          steps: WIZARD_STEPS,
          answers,
          current: latestWizardAnswers(answers),
          original: originalWizardAnswers(answers),
          progress: wizardProgress(answers),
        });
        return;
      }
      if (method === "POST") {
        const body = await readBody(request);
        if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
        const stepId = typeof body["stepId"] === "string" ? body["stepId"] : "";
        const validation = validateWizardAnswer(stepId, body["answer"]);
        if (!validation.ok || validation.answer === undefined) {
          return fail(response, 400, "invalid-answer", validation.detail ?? "invalid answer");
        }
        const answers = repository.listWizardAnswers(userId);
        const typedStep = stepId as WizardStepId;
        const record = {
          stepId: typedStep,
          answer: validation.answer,
          revision: nextWizardRevision(answers, typedStep),
          source: body["source"] === "settings" ? ("settings" as const) : ("wizard" as const),
        };
        repository.saveWizardAnswer(userId, record);
        const updated = repository.listWizardAnswers(userId);
        sendJson(response, 201, {
          status: "ok",
          answer: record,
          current: latestWizardAnswers(updated),
          original: originalWizardAnswers(updated),
          progress: wizardProgress(updated),
        });
        return;
      }
      return fail(response, 405, "method-not-allowed", "use GET or POST /wizard");
    }

    // POST /wizard/apply - store the folded profile and its revision row. The PLAN is not touched: a changed
    // orientation becomes a plan through a review the runner decides (ADR-0009), not through this write.
    if (segments.length === 2 && segments[0] === "wizard" && segments[1] === "apply") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /wizard/apply");
      const body = await readBody(request);
      if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
      const stored = repository.getAthleteProfile(userId);
      let base = stored;
      if (base === undefined && body["profile"] !== undefined) {
        const parsed = athleteProfileSchema.safeParse(body["profile"]);
        if (!parsed.success) {
          return fail(response, 400, "invalid-profile", parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
        }
        base = parsed.data;
      }
      if (base === undefined) {
        return fail(response, 400, "no-profile", "save a profile first, or send one in the body");
      }
      const folded = profileFromWizard(base, repository.listWizardAnswers(userId));
      if (!folded.ok || folded.profile === undefined) {
        return fail(response, 400, "invalid-profile", folded.detail ?? "the folded profile is not valid");
      }
      const diff = profileDiffOf(base, folded.profile);
      if (diff.length === 0) {
        sendJson(response, 200, {
          status: "unchanged",
          profile: base,
          applied: folded.applied,
          unapplied: folded.unapplied,
          note: "the answers already match the stored profile",
        });
        return;
      }
      const revision = repository.saveAthleteProfile(folded.profile, {
        changedBy: "runner",
        source: "user",
        diff,
        occurredAt: at,
      });
      sendJson(response, 201, {
        status: "saved",
        profile: folded.profile,
        revision,
        applied: folded.applied,
        unapplied: folded.unapplied,
        note: "the profile is saved; the plan itself changes only through a review the runner decides",
      });
      return;
    }

    // GET /profile - the stored profile and its revision history.
    if (segments.length === 1 && segments[0] === "profile" && method === "GET") {
      const profile = repository.getAthleteProfile(userId);
      if (profile === undefined) {
        sendJson(response, 200, { status: "no-profile", profile: null, revisions: [] });
        return;
      }
      sendJson(response, 200, { status: "ok", profile, revisions: repository.listProfileRevisions(userId) });
      return;
    }

    // POST /wizard/profile - fold the recorded answers into the profile the planner would take. A preview: the
    // profile is returned, never stored, because a changed orientation becomes a plan through a review (ADR-0009).
    if (segments.length === 2 && segments[0] === "wizard" && segments[1] === "profile") {
      if (method !== "POST") return fail(response, 405, "method-not-allowed", "use POST /wizard/profile");
      const body = await readBody(request);
      if (!isObject(body)) return fail(response, 400, "invalid-body", "expected a JSON object");
      const base = athleteProfileSchema.safeParse(body["profile"]);
      if (!base.success) {
        return fail(response, 400, "invalid-profile", base.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
      }
      const folded = profileFromWizard(base.data, repository.listWizardAnswers(userId));
      if (!folded.ok) return fail(response, 400, "invalid-profile", folded.detail ?? "the folded profile is not valid");
      sendJson(response, 200, {
        status: "ok",
        profile: folded.profile,
        applied: folded.applied,
        unapplied: folded.unapplied,
        note: "preview only: nothing is stored, and the plan changes only through a review the runner decides",
      });
      return;
    }

    // GET /console - the runner's own choices, original next to current, and the public guidelines only.
    if (segments.length === 1 && segments[0] === "console" && method === "GET") {
      const answers = repository.listWizardAnswers(userId);
      const guidelines = repository
        .listGuidelines()
        .filter((guideline) => guideline.visibility === "public")
        .sort((left, right) =>
          left.guidelineId < right.guidelineId ? -1 : left.guidelineId > right.guidelineId ? 1 : left.version - right.version,
        );
      sendJson(response, 200, {
        status: "ok",
        current: latestWizardAnswers(answers),
        original: originalWizardAnswers(answers),
        guidelines,
        progress: wizardProgress(answers),
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
