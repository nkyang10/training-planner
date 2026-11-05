/**
 * The web server: server-rendered pages over the same packages the API uses (ADR-0008).
 *
 * A form post is the whole interaction: the browser sends `application/x-www-form-urlencoded`, this server builds
 * the same `EntryDraft` a JSON client would, and the daily loop runs unchanged. That is the point of the
 * architecture - there is one entry pipeline, not one per client.
 */
import { createServer, type IncomingMessage, type RequestListener, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import type { Connection, DayEntry, Session, SyncPreference, WizardStepId } from "@training-planner/domain";
import { CONNECTION_PROVIDERS, guidelineSchema, isSyncSource } from "@training-planner/domain";
import {
  latestWizardAnswers,
  nextWizardRevision,
  originalWizardAnswers,
  validateWizardAnswer,
  wizardProgress,
  WIZARD_STEPS,
} from "@training-planner/domain";
import { PAIN_TREND_WINDOW_DAYS, painReportsOf, painTrendOf, submitEntry } from "@training-planner/entries";
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
import { renderAdminGuidelines, renderAdminLogin, renderCalendar, renderConnections, renderConsole, renderDay, renderLogin, renderMonth, renderPain, renderReview, renderSeason, renderWeek, renderWizard } from "./pages";
import { STYLES } from "./styles";

export interface WebOptions {
  repository: Repository;
  sessions: Sessions;
  knowledge?: KnowledgeBundle;
  now?: () => string;
  /** The dev default until the profile carries a timezone into the plan version. */
  timezone?: string;
  /**
   * The single operator's token (ADR-0009). Absent means the console is closed, not open: a deployment that forgot to
   * configure an operator must not hand guideline-writing to every runner.
   */
  operatorToken?: string;
  /** The API base URL for provider actions the web process does not own (Garmin token exchange, Strava start). */
  apiBaseUrl?: string;
  /** Injected for tests: the web process proxies provider actions to the API. */
  fetchImpl?: typeof fetch;
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

  // The plan's own shape, named: the week with the most planned kilometres is the peak; the last planned week is the
  // final surge. These are plan facts, not physiological claims, and the pages say "peak week" rather than "peak".
  const periodizationOf = (summary: ReturnType<typeof seasonSummary> | undefined): { peakWeek?: string; finalWeek?: string } => {
    const planned = summary?.weeks.filter((week) => week.plannedKm > 0) ?? [];
    if (planned.length === 0) return {};
    const peak = planned.reduce((best, week) => (week.plannedKm > best.plannedKm ? week : best));
    const last = planned[planned.length - 1];
    return last === undefined ? {} : { peakWeek: peak.weekStart, finalWeek: last.weekStart };
  };
  const monthOf = (day: string): string => day.slice(0, 7);
  const shiftMonth = (month: string, delta: number): string => {
    const [year, monthNumber] = month.split("-").map((part) => Number(part));
    const date = new Date(Date.UTC(year ?? 0, (monthNumber ?? 1) - 1 + delta, 1));
    return date.toISOString().slice(0, 7);
  };
  const weeksOfMonth = (
    summary: ReturnType<typeof seasonSummary> | undefined,
    month: string,
  ): ReturnType<typeof seasonSummary>["weeks"] => {
    if (summary === undefined) return [];
    const first = `${month}-01`;
    const [year, monthNumber] = month.split("-").map((part) => Number(part));
    const last = new Date(Date.UTC(year ?? 0, monthNumber ?? 1, 0)).toISOString().slice(0, 10);
    return summary.weeks.filter((week) => week.weekStart <= last && addDays(week.weekStart, 6) >= first);
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

    if (method === "GET" && url.pathname.startsWith("/static/assets/")) {
      const name = url.pathname.slice("/static/assets/".length);
      if (!/^[a-z0-9-]+\.png$/.test(name)) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
        return;
      }
      try {
        const bytes = readFileSync(new URL(`../public/assets/${name}`, import.meta.url));
        response.writeHead(200, { "content-type": "image/png", "cache-control": "public, max-age=3600" });
        response.end(bytes);
      } catch {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
      }
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

    // The operator console (ADR-0009). It sits before the runner's session on purpose: an operator is not a
    // runner, and a guideline write must not be reachable with a runner's cookie.
    const operatorExpected = options.operatorToken;
    const operatorCookie = (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("operator="));
    const presentedOperator = operatorCookie === undefined ? "" : decodeURIComponent(operatorCookie.slice("operator=".length));
    const isOperator = operatorExpected !== undefined && operatorExpected.length > 0 && presentedOperator === operatorExpected;

    if (url.pathname === "/admin/login") {
      if (method === "GET") {
        sendHtml(response, 200, renderAdminLogin(state.locale, undefined));
        return;
      }
      if (method === "POST") {
        const form = await readForm(request);
        if (operatorExpected !== undefined && form.get("token") === operatorExpected) {
          redirect(response, "/admin/guidelines", {
            "set-cookie": `operator=${encodeURIComponent(operatorExpected)}; Path=/admin; HttpOnly; SameSite=Lax`,
          });
          return;
        }
        sendHtml(response, 200, renderAdminLogin(state.locale, messagesFor(state.locale).web["web.admin-forbidden"]));
        return;
      }
    }

    if (url.pathname === "/admin/sign-out" && method === "POST") {
      redirect(response, "/admin/login", { "set-cookie": "operator=; Path=/admin; HttpOnly; SameSite=Lax; Max-Age=0" });
      return;
    }

    if (url.pathname === "/admin/guidelines") {
      if (!isOperator) {
        sendHtml(response, 200, renderAdminLogin(state.locale, messagesFor(state.locale).web["web.admin-forbidden"]));
        return;
      }
      if (method === "GET") {
        sendHtml(
          response,
          200,
          renderAdminGuidelines({
            locale: state.locale,
            guidelines: repository.listGuidelines(),
            saved: url.searchParams.get("saved") === "1",
            error: undefined,
          }),
        );
        return;
      }
      if (method === "POST") {
        const form = await readForm(request);
        const candidate = {
          guidelineId: form.get("guidelineId") ?? "",
          version: Number(form.get("version") ?? "0"),
          tier: form.get("tier") ?? "",
          scope: form.get("scope") ?? "",
          visibility: form.get("visibility") ?? "",
          text: form.get("text") ?? "",
          rationale: form.get("rationale") ?? "",
          effectiveFrom: form.get("effectiveFrom") ?? "",
          createdBy: "operator",
        };
        const parsed = guidelineSchema.safeParse(candidate);
        if (!parsed.success) {
          sendHtml(
            response,
            200,
            renderAdminGuidelines({
              locale: state.locale,
              guidelines: repository.listGuidelines(),
              saved: false,
              error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
            }),
          );
          return;
        }
        try {
          repository.saveGuideline(parsed.data);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          sendHtml(
            response,
            200,
            renderAdminGuidelines({
              locale: state.locale,
              guidelines: repository.listGuidelines(),
              saved: false,
              error: detail.includes("already exists") ? messagesFor(state.locale).web["web.admin-duplicate"] : detail,
            }),
          );
          return;
        }
        redirect(response, "/admin/guidelines?saved=1");
        return;
      }
      sendHtml(response, 405, renderAdminLogin(state.locale, "use GET or POST"));
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
      const requestedWeek = url.searchParams.get("week");
      const shownWeek = requestedWeek !== null && ISO_DAY.test(requestedWeek) ? requestedWeek : weekStart(today);
      const start = weekStart(shownWeek);
      const days = eachDay(start, addDays(start, 6));
      const plan = repository.latestPlanVersionFor(userId, today);
      const calendarSummary =
        plan === undefined ? undefined : seasonSummary({ plan, entries: repository.listEntries(userId), today });
      const calendarMarkers = periodizationOf(calendarSummary);
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
          weekStart: start,
          isCurrentWeek: start === weekStart(today),
          ...calendarMarkers,
        }),
      );
      return;
    }

    // Jump to a date: a calendar without a date picker makes the runner page backwards to find a day.
    if (method === "GET" && url.pathname === "/jump") {
      const requested = url.searchParams.get("date") ?? "";
      if (!ISO_DAY.test(requested)) {
        sendHtml(response, 400, renderLogin(state.locale, "date must be YYYY-MM-DD"));
        return;
      }
      redirect(response, `/?week=${weekStart(requested)}`);
      return;
    }

    // The month view: a runner plans in months; the seven-day week alone hid the shape of the block.
    if (method === "GET" && (url.pathname === "/month" || url.pathname.startsWith("/month/"))) {
      const today = state.now.slice(0, 10);
      const requested = url.pathname === "/month" ? monthOf(today) : url.pathname.slice("/month/".length);
      if (!/^\d{4}-\d{2}$/.test(requested)) {
        sendHtml(response, 404, renderLogin(state.locale, "month must be YYYY-MM"));
        return;
      }
      const plan = repository.latestPlanVersionFor(userId, `${requested}-01`);
      const summary =
        plan === undefined ? undefined : seasonSummary({ plan, entries: repository.listEntries(userId), today });
      const monthStart = `${requested}-01`;
      const [yearPart, monthPart] = requested.split("-").map((part) => Number(part));
      const monthEnd = new Date(Date.UTC(yearPart ?? 0, monthPart ?? 1, 0)).toISOString().slice(0, 10);
      const days = eachDay(weekStart(monthStart), addDays(weekStart(monthEnd), 6));
      const planForMonth = plan;
      sendHtml(
        response,
        200,
        renderMonth({
          locale: state.locale,
          month: requested,
          weeks: weeksOfMonth(summary, requested),
          prevMonth: shiftMonth(requested, -1),
          nextMonth: shiftMonth(requested, 1),
          days,
          today,
          sessionOf: (day) => {
            const session = planForMonth?.sessions.find((candidate) => candidate.day === day);
            return session === undefined ? "" : `${session.kind} ${session.distanceKm} km`;
          },
          statusOf: (day) => {
            const entries = repository.listEntriesForDay(userId, day);
            const latest = [...entries].sort((left, right) => right.revision - left.revision)[0];
            if (latest === undefined) return "none";
            if (latest.outcome === "missed" || latest.outcome === "skipped") return "missed";
            if (latest.outcome === "rest") return "rest";
            return "done";
          },
          ...periodizationOf(summary),
        }),
      );
      return;
    }

    // One week, past or future: looking back is a first-class action, not a footer link.
    if (method === "GET" && url.pathname.startsWith("/week/")) {
      const requested = url.pathname.slice("/week/".length);
      if (!ISO_DAY.test(requested)) {
        sendHtml(response, 404, renderLogin(state.locale, "week must be an ISO day"));
        return;
      }
      const week = weekStart(requested);
      sendHtml(
        response,
        200,
        renderWeek({
          locale: state.locale,
          weekStart: week,
          days: eachDay(week, addDays(week, 6)),
          plan: repository.latestPlanVersionFor(userId, week),
          currentOf: (day) => currentEntry(userId, day),
          commentOf: (day) => {
            const comment = repository.listComments(userId, day)[0];
            return comment === undefined ? undefined : { text: comment.text };
          },
          prevWeek: addDays(week, -7),
          nextWeek: addDays(week, 7),
          month: monthOf(week),
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
      sendHtml(response, 200, renderSeason({ locale: state.locale, summary, ...periodizationOf(summary) }));
      return;
    }

    // Connections (2026-11-05): link Strava/Garmin and choose which provider to sync from. The web process owns the
    // pages; the API owns the provider calls, so a provider action is proxied and its refusal is shown verbatim.
    if (url.pathname === "/connections" || url.pathname.startsWith("/connections/")) {
      const apiBase = options.apiBaseUrl ?? "http://127.0.0.1:8082";
      const doFetch = options.fetchImpl ?? fetch;
      const token = state.token ?? "";
      const proxy = async (route: string, init: RequestInit): Promise<{ ok: boolean; detail: string; authorizeUrl?: string }> => {
        try {
          const response = await doFetch(`${apiBase}${route}`, {
            ...init,
            headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          const body = (await response.json()) as Record<string, unknown>;
          if (response.ok) {
            return {
              ok: true,
              detail: typeof body["detail"] === "string" ? body["detail"] : "",
              authorizeUrl: typeof body["authorizeUrl"] === "string" ? body["authorizeUrl"] : undefined,
            };
          }
          const error = body["error"];
          const detail = typeof error === "object" && error !== null && typeof (error as Record<string, unknown>)["detail"] === "string" ? String((error as Record<string, unknown>)["detail"]) : `API answered ${response.status}`;
          return { ok: false, detail };
        } catch (error) {
          return { ok: false, detail: error instanceof Error ? error.message : String(error) };
        }
      };
      const defaultConnection = (provider: Connection["provider"]): Connection => ({
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
      });

      if (method === "GET" && url.pathname === "/connections") {
        const connections = CONNECTION_PROVIDERS.map((provider) => repository.getConnection(userId, provider) ?? defaultConnection(provider));
        const sync = repository.getSyncPreference(userId);
        const web = messagesFor(state.locale).web;
        const saved = url.searchParams.get("saved");
        const connected = url.searchParams.get("connected");
        const synced = url.searchParams.get("synced");
        const error = url.searchParams.get("error");
        const message =
          saved === null ? (connected === null ? (synced === null ? undefined : format(web["web.connections-synced-message"], { detail: synced })) : web["web.connections-connected-message"]) : web["web.connections-saved"];
        sendHtml(
          response,
          200,
          renderConnections({
            locale: state.locale,
            connections,
            sync,
            today: state.now.slice(0, 10),
            stravaStartUrl: `${apiBase}/connections/strava/start`,
            ...(message === undefined ? {} : { message }),
            ...(error === null ? {} : { error }),
          }),
        );
        return;
      }

      if (method === "POST" && url.pathname === "/connections/sync-preference") {
        const form = await readForm(request);
        const source = form.get("source") ?? "";
        if (!isSyncSource(source)) {
          redirect(response, `/connections?error=${encodeURIComponent("source must be manual, strava, garmin or both")}`);
          return;
        }
        const sync: SyncPreference = { userId, source, updatedAt: state.now };
        repository.saveSyncPreference(sync);
        redirect(response, "/connections?saved=1");
        return;
      }

      if (method === "POST" && url.pathname === "/connections/garmin/connect") {
        const form = await readForm(request);
        const apiKey = (form.get("apiKey") ?? "").trim();
        if (apiKey.length === 0) {
          redirect(response, "/connections?error=" + encodeURIComponent("paste a Garmin Personal API key first"));
          return;
        }
        const result = await proxy("/connections/garmin/token", { method: "POST", body: JSON.stringify({ apiKey }) });
        redirect(response, result.ok ? "/connections?connected=1" : `/connections?error=${encodeURIComponent(result.detail)}`);
        return;
      }

      if (method === "POST" && url.pathname === "/connections/garmin/sync") {
        const form = await readForm(request);
        const from = form.get("from") ?? state.now.slice(0, 10);
        const to = form.get("to") ?? state.now.slice(0, 10);
        const result = await proxy("/connections/garmin/sync", { method: "POST", body: JSON.stringify({ from, to }) });
        redirect(response, result.ok ? `/connections?synced=${encodeURIComponent(result.detail)}` : `/connections?error=${encodeURIComponent(result.detail)}`);
        return;
      }

      if (method === "GET" && url.pathname === "/connections/strava/start") {
        const result = await proxy("/connections/strava/start", { method: "GET" });
        if (result.ok && result.authorizeUrl !== undefined) {
          redirect(response, result.authorizeUrl);
        } else {
          redirect(response, `/connections?error=${encodeURIComponent(result.detail)}`);
        }
        return;
      }

      sendHtml(response, 404, renderLogin(state.locale, "no such connections route"));
      return;
    }

    // The onboarding wizard: one step at a time, and every answer is a row (ADR-0009).
    if (method === "GET" && url.pathname === "/wizard") {
      const answers = repository.listWizardAnswers(userId);
      const progress = wizardProgress(answers);
      const requested = url.searchParams.get("step");
      const step =
        (requested === null ? undefined : WIZARD_STEPS.find((candidate) => candidate.id === requested)) ??
        (progress.next === null ? undefined : WIZARD_STEPS.find((candidate) => candidate.id === progress.next));
      sendHtml(
        response,
        200,
        renderWizard({
          locale: state.locale,
          step,
          progress,
          current: latestWizardAnswers(answers),
          original: originalWizardAnswers(answers),
          error: url.searchParams.get("error") ?? undefined,
        }),
      );
      return;
    }

    if (method === "POST" && url.pathname === "/wizard") {
      const form = await readForm(request);
      const stepId = form.get("stepId") ?? "";
      const step = WIZARD_STEPS.find((candidate) => candidate.id === stepId);
      if (step === undefined) {
        redirect(response, "/wizard");
        return;
      }
      const raw =
        step.kind === "multi"
          ? { values: form.getAll("values") }
          : { value: step.kind === "number" ? Number(form.get("value")) : form.get("value") };
      const validation = validateWizardAnswer(stepId, raw);
      if (!validation.ok || validation.answer === undefined) {
        const answers = repository.listWizardAnswers(userId);
        sendHtml(
          response,
          200,
          renderWizard({
            locale: state.locale,
            step,
            progress: wizardProgress(answers),
            current: latestWizardAnswers(answers),
            original: originalWizardAnswers(answers),
            error: validation.detail ?? "invalid answer",
          }),
        );
        return;
      }
      const answers = repository.listWizardAnswers(userId);
      repository.saveWizardAnswer(userId, {
        stepId: stepId as WizardStepId,
        answer: validation.answer,
        revision: nextWizardRevision(answers, stepId as WizardStepId),
        source: "wizard",
      });
      redirect(response, "/wizard?saved=1");
      return;
    }

    // The personal console: the runner's own answers, original next to current, and the public guidelines only.
    if (method === "GET" && url.pathname === "/console") {
      const answers = repository.listWizardAnswers(userId);
      const guidelines = repository
        .listGuidelines()
        .filter((guideline) => guideline.visibility === "public")
        .sort((left, right) =>
          left.guidelineId < right.guidelineId ? -1 : left.guidelineId > right.guidelineId ? 1 : left.version - right.version,
        );
      sendHtml(
        response,
        200,
        renderConsole({
          locale: state.locale,
          steps: WIZARD_STEPS,
          current: latestWizardAnswers(answers),
          original: originalWizardAnswers(answers),
          guidelines,
        }),
      );
      return;
    }

    // The pain history: the rows the entry pipeline writes, in the order the repository keeps them.
    if (method === "GET" && url.pathname === "/pain") {
      const reports = repository.listPainReports(userId);
      const today = state.now.slice(0, 10);
      sendHtml(
        response,
        200,
        renderPain({ locale: state.locale, reports, trend: painTrendOf({ reports, today }), windowDays: PAIN_TREND_WINDOW_DAYS }),
      );
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
