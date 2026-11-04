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
import { submitEntry } from "@training-planner/entries";
import type { EntryDraft } from "@training-planner/entries";
import { format, messagesFor } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import { loadKnowledge } from "@training-planner/knowledge";
import type { KnowledgeBundle } from "@training-planner/knowledge";
import { renderComment, renderPlanExplanation } from "@training-planner/narrator";
import { addDays, eachDay, uuidFrom, weekStart } from "@training-planner/planner-core";
import { evaluatePolicy } from "@training-planner/policy";
import type { CommentRecord, Repository, Sessions } from "@training-planner/storage";
import { escapeHtml } from "./html";
import { renderCalendar, renderDay, renderLogin } from "./pages";
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

    if (method === "GET" && url.pathname === "/") {
      const today = state.now.slice(0, 10);
      const start = weekStart(today);
      const days = eachDay(start, addDays(start, 6));
      const plan = repository.latestPlanVersionFor(userId, today);
      const explanation = plan === undefined ? undefined : renderPlanExplanation(plan, { locale: state.locale });
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
        }),
      );
      return;
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
        const draft: EntryDraft = {
          day,
          outcome,
          tzAtEvent: timezone,
          ...(outcome === "completed" ? { sessionTaken: "as-prescribed" as const } : {}),
          ...(outcome === "rest" || outcome === "missed" ? { sessionTaken: "none" as const } : {}),
          ...(outcome === "skipped" && outcomeDetail !== undefined ? { outcomeDetail } : {}),
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
