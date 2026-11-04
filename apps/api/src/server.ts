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
import { painReportsOf, painTrendOf, submitEntry } from "@training-planner/entries";
import type { EntryDraft } from "@training-planner/entries";
import { format, isLocale, messagesFor, weekdayName } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import { loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { renderAdjustment, renderComment } from "@training-planner/narrator";
import { addDays, daysBetween, generatePlan, uuidFrom } from "@training-planner/planner-core";
import type { Evidence, PlanState } from "@training-planner/planner-core";
import { evaluatePolicy } from "@training-planner/policy";
import {
  latestWizardAnswers,
  nextWizardRevision,
  originalWizardAnswers,
  profileFromWizard,
  validateWizardAnswer,
  wizardProgress,
  WIZARD_STEPS,
} from "@training-planner/domain";
import type { WizardStepId } from "@training-planner/domain";
import { guidelineSchema } from "@training-planner/domain";
import { computeSignals } from "@training-planner/signals";
import { evaluateTriggers } from "@training-planner/triggers";
import { decideReview, openReview } from "@training-planner/review";
import type { ProposedOption } from "@training-planner/review";
import { decideNudge } from "@training-planner/nudges";
import { seasonSummary } from "@training-planner/season";
import { proposePlanOptions } from "@training-planner/replan";
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
      if (result.status === "accepted" && result.resultDiffId !== null) {
        try {
          appliedVersionId = repository.activatePlanVersionForDiff(userId, result.resultDiffId).versionId;
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
