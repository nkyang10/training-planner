/**
 * The web server: server-rendered pages over the same packages the API uses (ADR-0008).
 *
 * A form post is the whole interaction: the browser sends `application/x-www-form-urlencoded`, this server builds
 * the same `EntryDraft` a JSON client would, and the daily loop runs unchanged. That is the point of the
 * architecture - there is one entry pipeline, not one per client.
 */
import { createServer, type IncomingMessage, type RequestListener, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import type { DayEntry, Session } from "@training-planner/domain";
import { painReportsOf, submitEntry } from "@training-planner/entries";
import type { EntryDraft } from "@training-planner/entries";
import { format, messagesFor, weekdayName } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import { loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { renderComment, renderDailyCost, renderPlanExplanation } from "@training-planner/narrator";
import { decideNudge } from "@training-planner/nudges";
import { seasonSummary } from "@training-planner/season";
import { addDays, eachDay, uuidFrom, weekStart } from "@training-planner/planner-core";
import { dailyCostOf, evaluatePolicy } from "@training-planner/policy";
import { decideReview, firstEditableDay } from "@training-planner/review";
import { exportDocument } from "@training-planner/storage";
import type { CommentRecord, Repository, Sessions } from "@training-planner/storage";
import { escapeHtml } from "./html";
import { localClockOf } from "./local-clock";
import { renderCalendar, renderDay, renderLogin, renderPain, renderReview, renderSeason } from "./pages";
import { STYLES } from "./styles";

export interface WebOptions {
  repository: Repository;
  sessions: Sessions;
  knowledge?: KnowledgeBundle;
  now?: () => string;
  /** The dev default until the profile carries a timezone into the plan version. */
  timezone?: string;
}

const MAX_BODY_BYTES = 200_000;
/** The offline queue script, read once. It is plain JavaScript on purpose: no build step for a 5 KB file. */
const QUEUE_JS = readFileSync(new URL("../public/queue.js", import.meta.url), "utf8");
/** The sources the entry contract allows; the replay sends offline-queue and the form sends nothing (web). */
const ENTRY_SOURCES = ["web", "mobile", "offline-queue", "import-assistant", "voice"] as const;
/** day-entry.schema.json s OutcomeDetail enum. A free-text reason is a different field and is not invented here. */
const SKIP_REASONS = ["illness", "travel", "work", "family", "sleep", "motivation", "pain", "weather", "equipment", "social", "just-didnt", "other"] as const;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

interface RequestState {
  userId: string | null;
  token: string | null;
  locale: Locale;
  now: string;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (header === undefined) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name.length > 0) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

function sendJson(response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...headers,
  });
  response.end(payload);
}

function sendHtml(response: ServerResponse, status: number, html: string, headers: Record<string, string> = {}): void {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(html),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'self'; style-src 'self'; form-action 'self'",
    ...headers,
  });
  response.end(html);
}

function redirect(response: ServerResponse, location: string, headers: Record<string, string> = {}): void {
  response.writeHead(303, { location, ...headers });
  response.end();
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new Error(`form body exceeds ${MAX_BODY_BYTES} bytes`);
    chunks.push(buffer);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

const oneOf = <T extends string>(values: readonly T[], candidate: string | null, fallback: T): T =>
  values.find((value) => value === candidate) ?? fallback;

/** A number the runner typed, or undefined: the field is optional and "not said" stays absent. */
const numberInRange = (candidate: string | null, min: number, max: number): number | undefined => {
  if (candidate === null || candidate.trim().length === 0) return undefined;
  const parsed = Number.parseFloat(candidate);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? Math.round(parsed * 10) / 10 : undefined;
};

const intInRange = (candidate: string | null, min: number, max: number, fallback: number): number => {
  const parsed = candidate === null ? Number.NaN : Number.parseInt(candidate, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export function createWeb(options: WebOptions): RequestListener {
  const knowledge = options.knowledge ?? loadKnowledge("knowledge/heuristics");
  const now = options.now ?? (() => new Date().toISOString());
  const timezone = options.timezone ?? "Asia/Taipei";
  const repository = options.repository;

  const stateOf = (request: IncomingMessage): RequestState => {
    const cookies = parseCookies(request.headers.cookie);
    const token = cookies["session"] ?? null;
    const session = token === null ? null : options.sessions.resolve(`Bearer ${token}`);
    const headerLocale = (request.headers["accept-language"] ?? "").toString().toLowerCase();
    const locale: Locale =
      cookies["locale"] === "zh-Hant" || (cookies["locale"] === undefined && headerLocale.startsWith("zh")) ? "zh-Hant" : "en";
    return { userId: session?.userId ?? null, token, locale, now: now() };
  };

  const currentEntry = (userId: string, day: string): DayEntry | undefined => {
    const revisions = repository.listEntriesForDay(userId, day);
    return revisions[revisions.length - 1];
  };

  return (request, response) => {
    void handle(request, response).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      if (!response.headersSent) {
        const state = stateOf(request);
        sendHtml(response, 500, renderLogin(state.locale, detail));
      } else response.end();
    });
  };

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const method = request.method ?? "GET";
    const state = stateOf(request);

    if (method === "GET" && url.pathname === "/static/app.css") {
      response.writeHead(200, { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300" });
      response.end(STYLES);
      return;
    }

    if (method === "GET" && url.pathname === "/static/queue.js") {
      response.writeHead(200, { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=300" });
      response.end(QUEUE_JS);
      return;
    }

    if (method === "GET" && url.pathname === "/login") {
      sendHtml(response, 200, renderLogin(state.locale, undefined));
      return;
    }

    if (method === "POST" && url.pathname === "/login") {
      const form = await readForm(request);
      const token = form.get("token") ?? "";
      const session = options.sessions.resolve(`Bearer ${token}`);
      if (session === null) {
        sendHtml(response, 200, renderLogin(state.locale, "unknown token"));
        return;
      }
      redirect(response, "/", { "set-cookie": `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax` });
      return;
    }

    if (method === "POST" && url.pathname === "/sign-out") {
      redirect(response, "/login", { "set-cookie": "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" });
      return;
    }

    if (state.userId === null) {
      redirect(response, "/login");
      return;
    }
    const userId = state.userId;

    // What a substitute or a cut session gave up, as a sentence: the judgement is packages/policy's, the words are
    // packages/narrator's, and a day done as prescribed has nothing to say here.
    const costOf = (locale: Locale, session: Session | undefined, entry: DayEntry | undefined): string | undefined => {
      if (session === undefined || entry === undefined) return undefined;
      const cost = dailyCostOf({ session, entry, knowledge });
      return cost === null ? undefined : renderDailyCost(cost, { locale });
    };

    if (method === "GET" && url.pathname === "/") {
      const today = state.now.slice(0, 10);
      const start = weekStart(today);
      const days = eachDay(start, addDays(start, 6));
      const plan = repository.latestPlanVersionFor(userId, today);
      const explanation = plan === undefined ? undefined : renderPlanExplanation(plan, { locale: state.locale });
      const openReview = repository.listReviews(userId).find((review) => review.status === "open");
      // The daily prompt: packages/nudges decides whether one may arrive, and rendering it is the impression, so
      // the delivery is recorded here - a page that showed the prompt and did not record it would show it forever.
      const entries = repository.listEntries(userId);
      const clock = localClockOf(state.now, timezone);
      const nudge = decideNudge({
        userId,
        today,
        nowMinute: clock.hour * 60 + clock.minute,
        entries,
        plan: plan ?? null,
        delivered: repository.listPromptDeliveries(userId).map((delivery) => ({ kind: delivery.kind, day: delivery.day })),
        loggingHours: entries.map((entry) => localClockOf(entry.clientSubmittedAt ?? state.now, timezone).hour),
        knowledge,
      });
      let prompt: string | undefined;
      if (nudge.prompt !== null) {
        repository.savePromptDelivery({
          userId,
          kind: "nudge",
          day: today,
          forDay: nudge.prompt.forDay,
          atMinute: nudge.prompt.atMinute,
        });
        const template = nudge.prompt.forDay === today ? "prompt.log-day" : "prompt.log-gap";
        prompt = format(messagesFor(state.locale).prompt[template], {
          weekday: weekdayName(state.locale, nudge.prompt.forDay),
        });
      }
      sendHtml(
        response,
        200,
        renderCalendar({
          locale: state.locale,
          today,
          days,
          plan,
          currentOf: (day) => currentEntry(userId, day),
          commentOf: (day) => repository.listComments(userId, day)[0],
          intro: explanation?.sentences[0],
          openReview,
          prompt,
        }),
      );
      return;
    }

    // The season: the same summary the API returns, rendered as weeks. The page computes nothing itself.
    if (method === "GET" && url.pathname === "/season") {
      const plan = repository.latestPlanVersionFor(userId, state.now.slice(0, 10));
      const summary =
        plan === undefined
          ? undefined
          : seasonSummary({ plan, entries: repository.listEntries(userId), today: state.now.slice(0, 10) });
      sendHtml(response, 200, renderSeason({ locale: state.locale, summary }));
      return;
    }

    // The pain history: the rows the entry pipeline writes, in the order the repository keeps them.
    if (method === "GET" && url.pathname === "/pain") {
      sendHtml(response, 200, renderPain({ locale: state.locale, reports: repository.listPainReports(userId) }));
      return;
    }

    // The export: the same document the API returns, offered as a download. One definition, two doors.
    if (method === "GET" && url.pathname === "/export") {
      sendJson(response, 200, exportDocument(repository, userId, state.now), {
        "content-disposition": 'attachment; filename="training-planner-export.json"',
      });
      return;
    }

    // The review sheet: the ordering and the freeze window are packages/review s rules, and this page renders
    // what they decided. A review is never edited here; a decision is a state change.
    if (segments.length === 2 && segments[0] === "review") {
      const review = repository.getReview(userId, segments[1] ?? "");
      if (review === undefined) {
        const messages = messagesFor(state.locale);
        sendHtml(
          response,
          404,
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404</title></head><body><p>${escapeHtml(
            messages.web["web.review-none"],
          )}</p><p><a href="/">${escapeHtml(messages.web["web.title"])}</a></p></body></html>`,
        );
        return;
      }
      const today = state.now.slice(0, 10);
      const first = firstEditableDay(today, knowledge);
      const sheet = (input: Parameters<typeof renderReview>[0]): void => {
        sendHtml(response, input.error === undefined ? 200 : 409, renderReview(input));
      };

      if (method === "GET") {
        sheet({ locale: state.locale, review, firstEditableDay: first, message: undefined, error: undefined });
        return;
      }

      if (method === "POST") {
        const form = await readForm(request);
        const decision = oneOf(["accept", "decline", "defer"] as const, form.get("decision"), "accept");
        const recheckDay = addDays(today, knowledge.number("review-triggers.yaml#dwell_days"));
        const result =
          decision === "decline"
            ? decideReview(review, { kind: "decline", reason: form.get("reason") ?? undefined }, today, knowledge)
            : decision === "defer"
              ? decideReview(review, { kind: "defer", untilDay: recheckDay }, today, knowledge)
              : decideReview(review, { kind: "accept", optionId: form.get("optionId") ?? "" }, today, knowledge);

        if (result.status === "refused") {
          sheet({ locale: state.locale, review, firstEditableDay: first, message: undefined, error: `${result.code}: ${result.detail}` });
          return;
        }
        // Accepting a change activates the version the review offered; keeping the plan activates nothing.
        if (result.status === "accepted" && result.resultDiffId !== null) {
          try {
            repository.activatePlanVersionForDiff(userId, result.resultDiffId);
          } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            sheet({ locale: state.locale, review, firstEditableDay: first, message: undefined, error: detail });
            return;
          }
        }
        repository.saveReview(result.review);
        sheet({
          locale: state.locale,
          review: result.review,
          firstEditableDay: first,
          message:
            result.status === "accepted"
              ? { kind: "accepted", day: result.applyFromDay }
              : result.status === "deferred"
                ? { kind: "deferred", day: result.recheckDay }
                : { kind: "declined" },
          error: undefined,
        });
        return;
      }
    }

    if (segments.length === 2 && segments[0] === "day" && ISO_DAY.test(segments[1] ?? "")) {
      const day = segments[1] as string;
      const plan = repository.latestPlanVersionFor(userId, day);
      const session: Session | undefined = plan?.sessions.find((candidate) => candidate.day === day);
      const current = currentEntry(userId, day);
      const nextRevision = (current?.revision ?? 0) + 1;
      const idempotencyKey = uuidFrom({ userId, day, revision: String(nextRevision), form: "entry" });

      if (method === "GET") {
        const comment = repository.listComments(userId, day)[0];
        sendHtml(
          response,
          200,
          renderDay({
            locale: state.locale,
            day,
            session,
            current,
            comment: comment === undefined ? undefined : { text: comment.text },
            idempotencyKey,
            error: undefined,
            saved: false,
            adjustment: undefined,
            cost: costOf(state.locale, session, current),
          }),
        );
        return;
      }

      if (method === "POST") {
        const form = await readForm(request);
        const outcome = oneOf(["completed", "partial", "skipped", "rest", "missed"] as const, form.get("outcome"), "completed");
        const reason = (form.get("detail") ?? "").trim();
        const outcomeDetail = SKIP_REASONS.find((candidate) => candidate === reason);
        const note = (form.get("note") ?? "").trim();
        // The backfill window is a pipeline rule (missed-session-rules.yaml#unlogged_backfill_grace_hours); without a
        // field for the reason, an older day could never be logged from the page at all.
        const correctionReason = (form.get("correctionReason") ?? "").trim();
        const km = numberInRange(form.get("completedKm"), 0.1, 250);
        const draft: EntryDraft = {
          day,
          outcome,
          tzAtEvent: timezone,
          ...(outcome === "completed"
            ? {
                sessionTaken: oneOf(
                  ["as-prescribed", "alternate", "extra"] as const,
                  form.get("sessionTaken"),
                  "as-prescribed",
                ),
              }
            : {}),
          ...(outcome === "partial" ? { sessionTaken: "partial" as const } : {}),
          ...(outcome === "rest" || outcome === "missed" ? { sessionTaken: "none" as const } : {}),
          // A partial day without an amount is not a fact, so the form asks for one and the pipeline refuses it
          // otherwise. Completed days may carry the real distance too; the contract allows it.
          ...(km === undefined ? {} : { completedKm: km }),
          ...(outcome === "skipped" && outcomeDetail !== undefined ? { outcomeDetail } : {}),
          ...(correctionReason.length === 0 ? {} : { correctionReason }),
          rpe: intInRange(form.get("rpe"), 1, 10, 6),
          legs: intInRange(form.get("legs"), 1, 5, 2),
          ...(note.length === 0 ? {} : { note }),
          idempotencyKey: form.get("idempotencyKey") ?? idempotencyKey,
          // A replay says where it came from; the online form says nothing and is recorded as web.
          source: oneOf(ENTRY_SOURCES, form.get("source"), "web"),
        };

        const log = { entries: repository.listEntriesForDay(userId, day), events: repository.listEvents(userId) };
        const result = submitEntry(draft, log, { userId, today: state.now.slice(0, 10), occurredAt: state.now, knowledge });

        const rerender = (input: {
          error?: string;
          saved: boolean;
          comment?: { text: string; nudge?: string };
          adjustment?: { day: string; beforeKm: number; afterKm: number };
        }): void => {
          sendHtml(
            response,
            input.error === undefined ? 200 : 400,
            renderDay({
              locale: state.locale,
              day,
              session,
              current: currentEntry(userId, day) ?? current,
              comment: input.comment,
              idempotencyKey,
              error: input.error,
              saved: input.saved,
              adjustment: input.adjustment,
              cost: costOf(state.locale, session, currentEntry(userId, day) ?? current),
            }),
          );
        };

        if (result.status === "rejected") {
          rerender({ error: result.detail, saved: false });
          return;
        }
        if (result.status === "duplicate") {
          rerender({ saved: true, comment: repository.listComments(userId, day)[0] });
          return;
        }

        repository.appendEntryWithEventAndPointer({
          entry: result.entry,
          event: result.event,
          ...(result.superseded === undefined ? {} : { superseded: result.superseded }),
        });
        for (const report of painReportsOf({ userId, entry: result.entry })) repository.savePainReport(report);

        const planForDay = repository.latestPlanVersionFor(userId, result.entry.day);
        if (planForDay === undefined) {
          rerender({ saved: true });
          return;
        }

        const decision = evaluatePolicy({ entry: result.entry, plan: planForDay, today: state.now.slice(0, 10), knowledge });
        const rendered = renderComment(decision.commentFacts, { locale: state.locale });
        const record: CommentRecord = {
          commentId: uuidFrom({ userId, day: result.entry.day, revision: result.entry.revision, locale: state.locale }),
          userId,
          day: result.entry.day,
          locale: state.locale,
          sentences: rendered.sentences,
          text: rendered.text,
          knowledgeHash: knowledge.hash,
          createdAt: state.now,
        };
        repository.saveComment(record);

        rerender({
          saved: true,
          comment: { text: rendered.text, ...(rendered.nudge === undefined ? {} : { nudge: rendered.nudge }) },
          ...(decision.adjustTomorrow === undefined
            ? {}
            : {
                adjustment: {
                  day: decision.adjustTomorrow.day,
                  beforeKm: decision.adjustTomorrow.before.km,
                  afterKm: decision.adjustTomorrow.after.km,
                },
              }),
        });
        return;
      }
    }

    // A day outside the plan still opens: a gap is an invitation, not an error (screens.md).
    if (segments.length === 2 && segments[0] === "day") {
      const day = segments[1] as string;
      sendHtml(
        response,
        200,
        renderDay({
          locale: state.locale,
          day,
          session: undefined,
          current: currentEntry(userId, day),
          comment: undefined,
          idempotencyKey: uuidFrom({ userId, day, revision: "1", form: "entry" }),
          error: undefined,
          saved: false,
          adjustment: undefined,
          // A day outside the plan has no prescription, so there is nothing it could have given up.
          cost: undefined,
        }),
      );
      return;
    }

    const messages = messagesFor(state.locale);
    sendHtml(
      response,
      404,
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>404</title></head><body><p>${escapeHtml(
        format(messages.web["web.error"], { detail: `${method} ${url.pathname}` }),
      )}</p><p><a href="/">${escapeHtml(messages.web["web.title"])}</a></p></body></html>`,
    );
  }
}

export function startWeb(options: WebOptions & { port: number }): ReturnType<typeof createServer> {
  const server = createServer(createWeb(options));
  server.listen(options.port);
  return server;
}
