/**
 * The three pages: sign in, the week, the day drawer.
 *
 * Everything the runner reads is a catalogue string or a number the engine produced; the pages never compose a
 * sentence about training. The comment on the day page is the narrator's output, inserted verbatim (escaped),
 * because a page that re-words the coach note would be a second narrator.
 */
import type {
  DayEntry,
  DayName,
  GuidelineContract,
  PainReport,
  PlanVersion,
  Review,
  Session,
  WizardProgress,
  WizardStep,
  WizardStepId,
} from "@training-planner/domain";
import { WIZARD_STEPS } from "@training-planner/domain";
import type { PainTrend } from "@training-planner/entries";
import type { SeasonSummary, SeasonWeek } from "@training-planner/season";
import type { Connection, SyncPreference } from "@training-planner/domain";
import type { CoachMessage } from "@training-planner/domain";
import { format, formatNumber, messagesFor, weekdayName } from "@training-planner/i18n";
import { addDays, weekStart } from "@training-planner/planner-core";
import type { Locale } from "@training-planner/i18n";
import { escapeHtml, layout } from "./html";
import { renderCoachPanel } from "./coach-panel";
import { renderSparkline } from "./sparkline";

export interface CalendarPageInput {
  locale: Locale;
  today: string;
  days: string[];
  plan: PlanVersion | undefined;
  currentOf: (day: string) => DayEntry | undefined;
  commentOf: (day: string) => { text: string } | undefined;
  /** One sentence from `packages/narrator`'s explanation, already rendered and already grounded. */
  intro: string | undefined;
  /** An open review, if there is one: the banner links to the sheet rather than asking for a decision here. */
  openReview: Review | undefined;
  /** The daily prompt's sentence, when packages/nudges said one may arrive. */
  prompt: string | undefined;
  /** Monday of the week being shown; absent means "the week that contains today". */
  weekStart?: string;
  /** Whether the shown week is the current one (the title changes when looking back). */
  isCurrentWeek?: boolean;
  /** The week with the most planned kilometres, and the plan's last planned week. */
  peakWeek?: string;
  finalWeek?: string;
}

export interface DayPageInput {
  locale: Locale;
  day: string;
  session: Session | undefined;
  current: DayEntry | undefined;
  comment: { text: string; nudge?: string } | undefined;
  /** The next revision's idempotency key: stable for a double submit of the same form, new on a fresh page. */
  idempotencyKey: string;
  /** The coach answer already localised by the server, when the runner just asked. */
  coachStatus?: string;
  coachError?: string;
  error: string | undefined;
  saved: boolean;
  adjustment: { day: string; beforeKm: number; afterKm: number } | undefined;
  /** The daily trade-off sentence, when packages/policy found one to state. */
  cost: string | undefined;
}

const sessionLabel = (locale: Locale, session: Session): string => {
  const messages = messagesFor(locale);
  if (session.kind === "rest") return messages.web["web.rest-day"];
  const slots = {
    kind: messages.kind[session.kind],
    km: formatNumber(session.distanceKm ?? 0),
  };
  // Elapsed time is an estimate (pace-bands.yaml#elapsed_estimate); the word "about" is the estimate's own honesty,
  // not a decoration. A plan with no pace evidence has null here and the label stays a distance.
  const minutes = session.durationMin;
  if (typeof minutes === "number" && minutes > 0) {
    return format(messages.web["web.session-duration"], { ...slots, minutes: formatNumber(minutes) });
  }
  return format(messages.web["web.session"], slots);
};

export function renderLogin(locale: Locale, error: string | undefined): string {
  const messages = messagesFor(locale);
  const errorBlock =
    error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(messages.web["web.error"], { detail: error }))}</p>`;
  const body = `
    <section class="card narrow">
      <h2>${escapeHtml(messages.web["web.login-title"])}</h2>
      <p class="muted">${escapeHtml(messages.web["web.login-hint"])}</p>
      ${errorBlock}
      <form method="post" action="/login" class="stack">
        <label for="token">${escapeHtml(messages.web["web.login-title"])}</label>
        <input id="token" name="token" type="password" autocomplete="current-password" required>
        <button type="submit">${escapeHtml(messages.web["web.login-button"])}</button>
      </form>
    </section>`;
  return layout({ locale, title: messages.web["web.login-title"], body, signedIn: false });
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const statusOfDay = (current: DayEntry | undefined, day: string, today: string): "done" | "missed" | "rest" | "none" => {
  if (current === undefined) return "none";
  if (current.outcome === "missed" || current.outcome === "skipped") return "missed";
  if (current.outcome === "rest") return "rest";
  return day <= today ? "done" : "none";
};

const noteOf = (current: DayEntry | undefined): string => {
  if (current?.note === undefined || current.note === null || current.note.length === 0) return "";
  return current.note.length > 48 ? `${current.note.slice(0, 47)}…` : current.note;
};

/**
 * The week as a grid: seven day cards, today ringed, the week's totals above it. A list answers "what is next"; a grid
 * answers "what does this week look like", which is the question a runner actually asks before a training week.
 */
export function renderCalendar(input: CalendarPageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  if (input.plan === undefined) {
    return layout({
      locale: input.locale,
      title: web["web.title"],
      body: `<section class="card"><p>${escapeHtml(web["web.no-plan"])}</p></section>`,
      active: "/", signedIn: true,
    });
  }
  const start = input.weekStart ?? input.days[0] ?? input.today;
  const sessions = input.days.map((day) => input.plan?.sessions.find((candidate) => candidate.day === day));
  const plannedKm = sessions.reduce((total, session) => total + (session?.distanceKm ?? 0), 0);
  const plannedSessions = sessions.filter((session) => session !== undefined).length;
  const entries = input.days.map((day) => input.currentOf(day));
  const doneKm = entries.reduce((total, entry) => total + (entry?.completedKm ?? 0), 0);
  const doneSessions = entries.filter((entry) => entry !== undefined && entry.outcome === "completed").length;
  const cards = input.days
    .map((day, index) => {
      const session = sessions[index];
      const current = entries[index];
      const comment = input.commentOf(day);
      const status = statusOfDay(current, day, input.today);
      const sessionText = session === undefined ? web["web.rest-day"] : sessionLabel(input.locale, session);
      const note = noteOf(current);
      const commentText = comment === undefined || comment.text.length === 0 ? "" : comment.text;
      return `<a class="day-card${day === input.today ? " today" : ""}${status === "done" ? " logged" : ""}" href="/day/${escapeHtml(day)}">
        <span class="date"><b>${escapeHtml(day.slice(8, 10))}</b> ${escapeHtml(weekdayName(input.locale, day))}</span>
        <span class="session">${escapeHtml(sessionText)}</span>
        <span class="chip ${status === "done" ? "done" : "quiet"}">${escapeHtml(status === "done" ? web["web.logged"] : web["web.not-logged"])}</span>
        ${note.length === 0 ? "" : `<span class="note">${escapeHtml(format(web["web.calendar-note"], { note }))}</span>`}
        ${commentText.length === 0 ? "" : `<span class="note">${escapeHtml(commentText)}</span>`}
      </a>`;
    })
    .join("\n");
  const title = input.isCurrentWeek === true ? web["web.calendar-title"] : format(web["web.week-title"], { day: start });
  const markers = [
    start === input.peakWeek ? web["web.calendar-peak"] : "",
    start === input.finalWeek ? web["web.calendar-final"] : "",
  ].filter((marker) => marker.length > 0);
  const totals = format(web["web.grid-totals"], {
    planned: formatNumber(plannedKm),
    done: formatNumber(doneKm),
    doneSessions,
    plannedSessions,
  });
  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(web["web.nav-week"])}</p>
      <h1 class="page-title">${escapeHtml(title)}</h1>
    </header>`;
  const readiness =
    input.plan === undefined
      ? ""
      : input.plan.lastDay >= addDays(input.today, 6)
        ? `<span class="chip done">${escapeHtml(web["web.readiness-7"])}</span>`
        : `<span class="chip quiet">${escapeHtml(format(web["web.readiness-short"], { day: input.plan.lastDay }))}</span>`;
  const hero = `<section class="hero hero-week">
      <span class="hero-art" style="background-image:url('/static/assets/hero-week.png')" aria-hidden="true"></span>
      <div class="hero-copy">
        <p>${escapeHtml(totals)} ${readiness}</p>
        <p><a class="btn btn-primary" href="/day/${escapeHtml(input.today)}">${escapeHtml(web["web.grid-today"])}</a>
          <a class="btn btn-ghost" href="/season">${escapeHtml(web["web.nav-season"])}</a></p>
      </div>
    </section>`;
  const body = `${pageHead}
    ${hero}
    <section class="card">
      <p class="period-nav">
        <a href="/?week=${escapeHtml(addDays(start, -7))}">${escapeHtml(web["web.calendar-prev"])}</a>
        <a class="chip ${input.isCurrentWeek === true ? "done" : "quiet"}" href="/?week=${escapeHtml(weekStart(input.today))}">${escapeHtml(web["web.grid-today"])}</a>
        <a href="/?week=${escapeHtml(addDays(start, 7))}">${escapeHtml(web["web.calendar-next"])}</a>
        <a href="/month/${escapeHtml(start.slice(0, 7))}">${escapeHtml(web["web.nav-month"])}</a>
        <a href="/season">${escapeHtml(web["web.nav-season"])}</a>
      </p>
      ${markers.length === 0 ? "" : `<p class="muted"><span class="chip quiet">${escapeHtml(markers.join(" · "))}</span></p>`}
      <form method="post" action="/program/request" class="period-nav">
        <label for="days">${escapeHtml(web["web.program-days"])}</label>
        <select id="days" name="days"><option value="7">7</option><option value="14" selected>14</option><option value="21">21</option><option value="28">28</option></select>
        <button type="submit" class="btn btn-primary">${escapeHtml(web["web.program-request"])}</button>
      </form>
      <div class="week-grid">${cards}</div>
      ${input.intro === undefined ? "" : `<p class="note">${escapeHtml(input.intro)}</p>`}
      ${input.prompt === undefined ? "" : `<p class="muted">${escapeHtml(input.prompt)}</p>`}
      ${input.openReview === undefined ? "" : `<p><a class="chip" href="/review/${escapeHtml(input.openReview.reviewId)}">${escapeHtml(web["web.review-banner"])}</a></p>`}
      <form class="period-nav" method="get" action="/jump">
        <label for="jump">${escapeHtml(web["web.grid-jump"])}</label>
        <input id="jump" name="date" type="date" value="${escapeHtml(input.today)}">
        <button type="submit">${escapeHtml(web["web.grid-go"])}</button>
      </form>
    </section>`;
  return layout({ locale: input.locale, title, body, signedIn: true });
}

const OUTCOMES = ["completed", "partial", "skipped", "rest", "missed"] as const;

const outcomeLabel = (locale: Locale, outcome: (typeof OUTCOMES)[number]): string => {
  const web = messagesFor(locale).web;
  switch (outcome) {
    case "completed":
      return web["web.outcome-completed"];
    case "partial":
      return web["web.outcome-partial"];
    case "skipped":
      return web["web.outcome-skipped"];
    case "rest":
      return web["web.outcome-rest"];
    case "missed":
      return web["web.outcome-missed"];
  }
};

export interface SeasonPageInput {
  locale: Locale;
  /** Undefined when there is no plan: a season with no plan is not an empty season, it is a missing one. */
  summary: SeasonSummary | undefined;
  /** The week with the most planned kilometres. */
  peakWeek?: string;
  /** The plan's last planned week: the final surge before the event, when there is one. */
  finalWeek?: string;
}

/**
 * The season view: the plan's weeks with planned and done kilometres. Every number here comes from
 * packages/season; this page chooses words and nothing else.
 */
export function renderSeason(input: SeasonPageInput): string {
  const messages = messagesFor(input.locale);
  const summary = input.summary;
  if (summary === undefined) {
    return layout({
      locale: input.locale,
      title: messages.web["web.season-title"],
      body: `<section class="card"><p>${escapeHtml(messages.web["web.season-empty"])}</p></section>`,
      active: "/season", signedIn: true,
    });
  }

  const statusLabel = (status: SeasonSummary["weeks"][number]["status"]): string =>
    status === "past"
      ? messages.web["web.season-past"]
      : status === "current"
        ? messages.web["web.season-current"]
        : messages.web["web.season-future"];

  const rows = summary.weeks.map((week) => {
    const facts = [
      format(messages.web["web.season-planned"], { km: formatNumber(week.plannedKm) }),
      format(messages.web["web.season-done"], { km: formatNumber(week.completedKm) }),
      format(messages.web["web.season-sessions"], { done: week.completedSessions, planned: week.plannedSessions }),
      format(messages.web["web.season-hard"], { count: week.hardDays }),
      format(messages.web["web.season-logged"], { count: week.loggedDays }),
    ];
    const markers = [
      week.weekStart === input.peakWeek ? messages.web["web.season-peak"] : "",
      week.weekStart === input.finalWeek ? messages.web["web.season-final"] : "",
    ].filter((marker) => marker.length > 0);
    const markerChips = markers
      .map((marker) => `<span class="chip quiet">${escapeHtml(marker)}</span>`)
      .join(" ");
    return `<li class="row${week.status === "current" ? " today" : ""}">
      <a class="row-link" href="/week/${escapeHtml(week.weekStart)}">
        <span class="day">${escapeHtml(format(messages.web["web.season-week"], { day: week.weekStart }))}</span>
        <span class="chip quiet">${escapeHtml(statusLabel(week.status))}</span>
        <span class="session">${escapeHtml(facts.join(" · "))}</span>
      </a>
      ${markerChips}
    </li>`;
  });

  const adherence =
    summary.adherencePct === null
      ? messages.web["web.season-adherence-none"]
      : format(messages.web["web.season-adherence"], { pct: formatNumber(summary.adherencePct) });

  const totals = summary.weeks.reduce(
    (running, week) => ({
      plannedKm: running.plannedKm + week.plannedKm,
      completedKm: running.completedKm + week.completedKm,
      plannedSessions: running.plannedSessions + week.plannedSessions,
      completedSessions: running.completedSessions + week.completedSessions,
    }),
    { plannedKm: 0, completedKm: 0, plannedSessions: 0, completedSessions: 0 },
  );

  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.nav-season"])}</p>
      <h1 class="page-title">${escapeHtml(messages.web["web.season-title"])}</h1>
      <p class="page-sub">${escapeHtml(adherence)}</p>
    </header>`;
  const stats = `<div class="stat-grid">
      <div class="stat"><span class="stat-value">${escapeHtml(formatNumber(totals.plannedKm))}</span><span class="stat-label">${escapeHtml(messages.web["web.stat-planned-km"])}</span></div>
      <div class="stat"><span class="stat-value">${escapeHtml(formatNumber(totals.completedKm))}</span><span class="stat-label">${escapeHtml(messages.web["web.stat-done-km"])}</span></div>
      <div class="stat"><span class="stat-value">${escapeHtml(`${formatNumber(totals.completedSessions)} / ${formatNumber(totals.plannedSessions)}`)}</span><span class="stat-label">${escapeHtml(messages.web["web.stat-sessions"])}</span></div>
    </div>`;

  const body = `${pageHead}
    ${stats}
    <section class="card">
      <ul class="week">${rows.join("\n")}</ul>
      <p class="muted">
        <a href="/">${escapeHtml(messages.web["web.season-back"])}</a> ·
        <a href="/export">${escapeHtml(messages.web["web.export-link"])}</a>
      </p>
    </section>`;
  return layout({ locale: input.locale, title: messages.web["web.season-title"], body, signedIn: true });
}

export interface PainPageInput {
  locale: Locale;
  /** Rows from packages/entries' projection, already ordered by day by the repository. */
  reports: readonly PainReport[];
  /** The trajectory, from packages/entries' painTrendOf - the page places the sentence, it does not compose it. */
  trend: PainTrend;
  /** The window the trend used, so the sentence can say "the last N days" without a second number. */
  windowDays: number;
}

/**
 * The pain history: the rows row 19 created, on a page. The triage still reads one entry's array (row 35), so this
 * page says what happened rather than what it means - a page that interpreted pain would be a second triage.
 */
export interface MonthPageInput {
  locale: Locale;
  /** `YYYY-MM`. */
  month: string;
  weeks: readonly SeasonWeek[];
  peakWeek?: string;
  finalWeek?: string;
  prevMonth: string;
  nextMonth: string;
  /** The padded month grid (Monday first); absent keeps the week-list fallback for direct callers. */
  days?: readonly string[];
  today?: string;
  sessionOf?: (day: string) => string;
  statusOf?: (day: string) => "done" | "missed" | "rest" | "none";
}

/**
 * The month view: the weeks that touch the month, each with planned/done kilometres, the peak and final-surge markers,
 * and a link into the week. It exists because a runner plans in months, not only in the seven days in front of them.
 */
export function renderMonth(input: MonthPageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const title = format(web["web.month-title"], { month: input.month });
  const todayMonth = (input.today ?? `${input.month}-01`).slice(0, 7);
  const markers = [
    input.peakWeek === undefined || !input.weeks.some((week) => week.weekStart === input.peakWeek) ? "" : web["web.month-peak"],
    input.finalWeek === undefined || !input.weeks.some((week) => week.weekStart === input.finalWeek) ? "" : web["web.month-final"],
  ].filter((marker) => marker.length > 0);
  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(title)}</p>
      <h1 class="page-title">${escapeHtml(input.month)}</h1>
      ${markers.length === 0 ? "" : `<p class="page-sub">${escapeHtml(markers.join(" · "))}</p>`}
    </header>`;
  const hero = `<section class="hero hero-season">
      <span class="hero-art" style="background-image:url('/static/assets/hero-season.png')" aria-hidden="true"></span>
      <div class="hero-copy">
        <p>${escapeHtml(title)}</p>
        <p><a class="btn btn-primary" href="/month/${escapeHtml(todayMonth)}">${escapeHtml(web["web.month-this"])}</a>
          <a class="btn btn-ghost" href="/">${escapeHtml(web["web.nav-week"])}</a></p>
      </div>
    </section>`;
  const periodNav = `<p class="period-nav">
        <a href="/month/${escapeHtml(input.prevMonth)}">${escapeHtml(web["web.month-prev"])}</a>
        <a class="chip quiet" href="/month/${escapeHtml(todayMonth)}">${escapeHtml(web["web.month-this"])}</a>
        <a href="/month/${escapeHtml(input.nextMonth)}">${escapeHtml(web["web.month-next"])}</a>
        <a href="/">${escapeHtml(web["web.nav-week"])}</a>
        <a href="/season">${escapeHtml(web["web.nav-season"])}</a>
      </p>`;
  if (input.days === undefined) {
    const rows =
      input.weeks.length === 0
        ? `<p>${escapeHtml(web["web.month-empty"])}</p>`
        : input.weeks
            .map((week) => {
              const facts = [
                format(web["web.season-planned"], { km: formatNumber(week.plannedKm) }),
                format(web["web.season-done"], { km: formatNumber(week.completedKm) }),
                format(web["web.season-sessions"], { done: week.completedSessions, planned: week.plannedSessions }),
              ];
              const weekMarkers = [
                week.weekStart === input.peakWeek ? web["web.month-peak"] : "",
                week.weekStart === input.finalWeek ? web["web.month-final"] : "",
              ].filter((marker) => marker.length > 0);
              return `<li class="row"><a class="row-link" href="/week/${escapeHtml(week.weekStart)}">
        <span class="day">${escapeHtml(format(web["web.month-week"], { day: week.weekStart }))}</span>
        <span class="session">${escapeHtml(facts.join(" · "))}</span>
      </a>${weekMarkers.length === 0 ? "" : ` <span class="chip quiet">${escapeHtml(weekMarkers.join(" · "))}</span>`}</li>`;
            })
            .join("\n");
    return layout({ locale: input.locale, title, body: `${pageHead}${hero}<section class="card">${periodNav}<ul class="week">${rows}</ul></section>`, active: "/month", signedIn: true });
  }
  const head = WEEKDAYS.map((day) => `<span class="dow">${escapeHtml(messages.weekday[day])}</span>`).join("");
  const cells = input.days
    .map((day) => {
      const inMonth = day.slice(0, 7) === input.month;
      const status = input.statusOf?.(day) ?? "none";
      const session = input.sessionOf?.(day) ?? "";
      return `<a class="month-day${day === input.today ? " today" : ""}${inMonth ? "" : " pad"}" href="/day/${escapeHtml(day)}" aria-label="${escapeHtml(`${day} ${session}`.trim())}">
        <span class="num">${escapeHtml(day.slice(8, 10))}</span>
        <span class="session">${escapeHtml(session)}</span>
        <span class="dot ${status}" aria-hidden="true"></span>
      </a>`;
    })
    .join("\n");
  const body = `${pageHead}
    ${hero}
    <section class="card">
      ${periodNav}
      ${markers.length === 0 ? "" : `<p class="muted"><span class="chip quiet">${escapeHtml(markers.join(" · "))}</span></p>`}
      <div class="month-grid">${head}${cells}</div>
    </section>`;
  return layout({ locale: input.locale, title, body, signedIn: true });
}

export interface WeekPageInput {
  locale: Locale;
  weekStart: string;
  days: readonly string[];
  plan: PlanVersion | undefined;
  currentOf: (day: string) => DayEntry | undefined;
  commentOf: (day: string) => { text: string } | undefined;
  prevWeek: string;
  nextWeek: string;
  month: string;
  today?: string;
  /** A sync result already localised by the server, shown after the redirect back to the week. */
  synced?: string;
  syncError?: string;
}

/** One past or future week, with the same rows as the calendar, so looking back is a first-class action. */
export function renderWeek(input: WeekPageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const today = input.today ?? input.days[0] ?? input.weekStart;
  const title = format(web["web.week-title"], { day: input.weekStart });
  const cards = input.days
    .map((day) => {
      const session = input.plan?.sessions.find((candidate) => candidate.day === day);
      const current = input.currentOf(day);
      const comment = input.commentOf(day);
      const status = statusOfDay(current, day, today);
      const sessionText = session === undefined ? web["web.rest-day"] : sessionLabel(input.locale, session);
      return `<a class="day-card${day === today ? " today" : ""}${status === "done" ? " logged" : ""}" href="/day/${escapeHtml(day)}">
        <span class="date"><b>${escapeHtml(day.slice(8, 10))}</b> ${escapeHtml(weekdayName(input.locale, day))}</span>
        <span class="session">${escapeHtml(sessionText)}</span>
        <span class="chip ${status === "done" ? "done" : "quiet"}">${escapeHtml(status === "done" ? web["web.logged"] : web["web.not-logged"])}</span>
        ${current?.note === undefined || current.note === null || current.note.length === 0 ? "" : `<span class="note">${escapeHtml(format(web["web.calendar-note"], { note: current.note }))}</span>`}
        ${comment === undefined || comment.text.length === 0 ? "" : `<span class="note">${escapeHtml(comment.text)}</span>`}
      </a>`;
    })
    .join("\n");
  const body = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.nav-week"])}</p>
      <h1 class="page-title">${escapeHtml(title)}</h1>
    </header><section class="card">
      <h2>${escapeHtml(title)}</h2>
      <p class="period-nav">
        <a href="/week/${escapeHtml(input.prevWeek)}">${escapeHtml(web["web.week-prev"])}</a>
        <a class="chip quiet" href="/week/${escapeHtml(weekStart(today))}">${escapeHtml(web["web.grid-today"])}</a>
        <a href="/week/${escapeHtml(input.nextWeek)}">${escapeHtml(web["web.week-next"])}</a>
        <a href="/month/${escapeHtml(input.month)}">${escapeHtml(web["web.nav-month"])}</a>
        <a href="/">${escapeHtml(web["web.nav-week"])}</a>
      </p>
      <div class="period-nav">
        <form method="post" action="/program/request" class="inline">
          <label for="days">${escapeHtml(web["web.program-days"])}</label>
          <select id="days" name="days"><option value="7">7</option><option value="14" selected>14</option><option value="21">21</option><option value="28">28</option></select>
          <button type="submit" class="btn btn-primary">${escapeHtml(web["web.program-cta"])}</button>
        </form>
        <form method="post" action="/week/${escapeHtml(input.weekStart)}/sync" class="inline">
          <button type="submit" class="btn btn-ghost">${escapeHtml(web["web.sync-garmin"])}</button>
        </form>
        <a class="btn btn-ghost" href="/day/${escapeHtml(today)}">${escapeHtml(web["web.coach-ask-title"])}</a>
      </div>
      ${input.synced === undefined ? "" : `<p class="chip done" role="status">${escapeHtml(format(web["web.sync-done"], { detail: input.synced }))}</p>`}
      ${input.syncError === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(web["web.sync-failed"], { detail: input.syncError }))}</p>`}
      <div class="week-grid">${cards}</div>
    </section>`;
  return layout({ locale: input.locale, title, body, active: "/", signedIn: true });
}

export interface StatsPageInput {
  locale: Locale;
  summary: SeasonSummary | undefined;
  plannedSessions: number;
  completedSessions: number;
  plannedKm: number;
  completedKm: number;
  adherencePercent: number;
  loggedDays: number;
  comments: readonly { day: string; text: string }[];
  trend: readonly number[];
  weeks: number;
  painByWeek: readonly number[];
}

/** Completeness against the plan, plus the coach's comments in one place (2026-11-05). */
export function renderStats(input: StatsPageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const head = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(web["web.nav-stats"])}</p>
      <h1 class="page-title">${escapeHtml(web["web.stats-title"])}</h1>
      <p class="page-sub">${escapeHtml(web["web.stats-sub"])}</p>
    </header>`;
  if (input.summary === undefined) {
    return layout({ locale: input.locale, title: web["web.stats-title"], body: `${head}<section class="card"><p>${escapeHtml(web["web.stats-empty"])}</p></section>`, signedIn: true, active: "/stats" });
  }
  const tiles = [
    { value: `${formatNumber(input.completedSessions)} / ${formatNumber(input.plannedSessions)}`, label: web["web.stats-done-sessions"] },
    { value: `${formatNumber(input.completedKm)} / ${formatNumber(input.plannedKm)}`, label: web["web.stat-planned-km"] },
    { value: `${formatNumber(input.adherencePercent)}%`, label: web["web.stats-adherence"] },
    { value: formatNumber(input.loggedDays), label: web["web.stats-logged"] },
  ];
  const stats = `<div class="stat-grid">${tiles
    .map((tile) => `<div class="stat"><span class="stat-value">${escapeHtml(tile.value)}</span><span class="stat-label">${escapeHtml(tile.label)}</span></div>`)
    .join("\n")}</div>`;
  const rows = input.summary.weeks
    .map((week) => `<tr><td>${escapeHtml(week.weekStart)}</td><td>${escapeHtml(`${formatNumber(week.completedSessions)} / ${formatNumber(week.plannedSessions)}`)}</td><td>${escapeHtml(`${formatNumber(week.completedKm)} / ${formatNumber(week.plannedKm)}`)}</td><td>${escapeHtml(String(week.loggedDays))}</td></tr>`)
    .join("\n");
  const table = `<section class="card"><h2>${escapeHtml(web["web.stats-week"])}</h2><table class="table"><thead><tr><th>${escapeHtml(web["web.stats-week"])}</th><th>${escapeHtml(web["web.stats-done-sessions"])}</th><th>${escapeHtml(web["web.stat-done-km"])}</th><th>${escapeHtml(web["web.stats-logged"])}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  const trend = input.trend.length < 2
    ? ""
    : `<section class="card"><h2>${escapeHtml(web["web.stats-trend"])}</h2>
        <p class="period-nav"><a href="/stats?weeks=8"${input.weeks === 8 ? ' class="chip done"' : ""}>8</a><a href="/stats?weeks=12"${input.weeks === 12 ? ' class="chip done"' : ""}>12</a></p>
        ${renderSparkline({ values: input.trend })}
        <p class="period-nav">${input.painByWeek.map((count, index) => `<span class="chip quiet">W${index + 1}: ${escapeHtml(String(count))}</span>`).join("")}</p>
      </section>`;
  const comments = input.comments.length === 0
    ? `<p class="muted">${escapeHtml(web["web.stats-no-comments"])}</p>`
    : `<ul class="week">${input.comments.map((comment) => `<li class="row"><p class="note"><a href="/day/${escapeHtml(comment.day)}">${escapeHtml(comment.day)}</a> · ${escapeHtml(comment.text)}</p></li>`).join("\n")}</ul>`;
  const body = `${head}${stats}${table}${trend}<section class="card"><h2>${escapeHtml(web["web.stats-comments"])}</h2>${comments}</section>`;
  return layout({ locale: input.locale, title: web["web.stats-title"], body, signedIn: true, active: "/stats" });
}

export interface CoachPageInput {
  locale: Locale;
  messages: readonly CoachMessage[];
  factsSummary: string;
  references?: readonly { id: string; title: string; tier: string }[];
  reviewId?: string;
  error?: string;
}

/** The conversation: the coach keeps context, but a change is still a review the runner decides (ADR-0011). */
export function renderCoachPage(input: CoachPageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const head = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(web["web.nav-coach"])}</p>
      <h1 class="page-title">${escapeHtml(web["web.coach-title"])}</h1>
      <p class="page-sub">${escapeHtml(web["web.coach-sub"])}</p>
    </header>`;
  const thread = input.messages.length === 0
    ? `<p class="muted">${escapeHtml(web["web.coach-empty"])}</p>`
    : `<ul class="week coach-thread">${input.messages
        .map(
          (message) => `<li class="row coach-message ${message.role}"><p class="eyebrow">${escapeHtml(
            message.role === "user" ? web["web.coach-you"] : web["web.coach-coach"],
          )}</p><p class="note">${escapeHtml(message.text)}</p>${
            (message.attachments ?? [])
              .map((attachment) => `<img class="coach-photo" src="/coach/photo/${escapeHtml(attachment.attachmentId)}" alt="${escapeHtml(attachment.filename)}" loading="lazy">`)
              .join("")
          }${
            message.reviewId === null ? "" : `<p><a class="chip" href="/review/${escapeHtml(message.reviewId)}">${escapeHtml(web["web.coach-review-opened"])}</a></p>`
          }</li>`,
        )
        .join("\n")}</ul>`;
  const composer = `<form method="post" action="/coach" enctype="multipart/form-data" class="card stack">
      <label for="question">${escapeHtml(web["web.coach-placeholder"])}</label>
      <textarea id="question" name="question" required maxlength="500" rows="3"></textarea>
      <label for="photo">${escapeHtml(web["web.coach-photo"])}</label>
      <input id="photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp">
      <label class="choice"><input type="checkbox" name="autoReview" value="1"><span>${escapeHtml(web["web.coach-auto-review"])}</span></label>
      <button type="submit" class="btn btn-primary">${escapeHtml(web["web.coach-send"])}</button>
    </form>`;
  const context = `<p class="muted">${escapeHtml(web["web.coach-context"])}: ${escapeHtml(input.factsSummary)}</p>${
    input.references === undefined || input.references.length === 0
      ? ""
      : `<p class="period-nav">${input.references.map((reference) => `<span class="chip quiet" title="${escapeHtml(reference.id)}">${escapeHtml(reference.title)}</span>`).join("")}</p>`
  }`;
  const review = input.reviewId === undefined ? "" : `<p><a class="chip done" href="/review/${escapeHtml(input.reviewId)}">${escapeHtml(web["web.coach-review-opened"])}</a></p>`;
  const error = input.error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(web["web.coach-error"], { detail: input.error }))}</p>`;
  const body = `${head}${error}${review}${context}<section class="card">${thread}</section>${composer}`;
  return layout({ locale: input.locale, title: web["web.coach-title"], body, signedIn: true, active: "/coach" });
}

export interface ConnectionsPageInput {
  locale: Locale;
  connections: readonly Connection[];
  sync: SyncPreference | undefined;
  today: string;
  /** Absolute URL of the API's Strava start route, when the API is reachable. */
  stravaStartUrl?: string;
  message?: string;
  error?: string;
}

/** Link Strava/Garmin and choose which provider to sync from (2026-11-05). */
export function renderConnections(input: ConnectionsPageInput): string {
  const web = messagesFor(input.locale).web;
  const statusOf = (connection: Connection): string =>
    connection.status === "connected" ? web["web.connections-connected"] : web["web.connections-not-connected"];
  const card = (provider: Connection["provider"]): string => {
    const connection = input.connections.find((candidate) => candidate.provider === provider);
    const title = provider === "strava" ? web["web.connections-strava"] : web["web.connections-garmin"];
    const account =
      connection?.displayName === undefined || connection.displayName === null || connection.displayName.length === 0
        ? ""
        : `<p class="muted">${escapeHtml(web["web.connections-display-name"])}: ${escapeHtml(connection.displayName)}</p>`;
    const lastSync =
      connection?.lastSyncAt === undefined || connection.lastSyncAt === null
        ? web["web.connections-never"]
        : `${escapeHtml(connection.lastSyncAt)}${connection.lastSyncDetail === null ? "" : ` · ${escapeHtml(connection.lastSyncDetail)}`}`;
    const credential =
      connection?.hasCredential === true ? "" : `<p class="note">${escapeHtml(web["web.connections-no-credential"])}</p>`;
    const body =
      provider === "garmin"
        ? `<form method="post" action="/connections/garmin/connect" class="stack">
            <label for="garminKey">${escapeHtml(web["web.connections-garmin-key"])}</label>
            <input id="garminKey" name="apiKey" type="password" autocomplete="off" required>
            <p class="note">${escapeHtml(web["web.connections-garmin-key-hint"])}</p>
            <button type="submit">${escapeHtml(web["web.connections-connect"])}</button>
          </form>
          <form method="post" action="/connections/garmin/sync" class="stack">
            <p class="note">${escapeHtml(web["web.connections-sync-hint"])}</p>
            <label for="from">${escapeHtml(web["web.connections-sync-from"])} (from)</label>
            <input id="from" name="from" type="date" value="${escapeHtml(input.today)}" required>
            <label for="to">${escapeHtml(web["web.connections-sync-from"])} (to)</label>
            <input id="to" name="to" type="date" value="${escapeHtml(input.today)}" required>
            <button type="submit">${escapeHtml(web["web.connections-sync-now"])}</button>
          </form>`
        : `<p class="note">${escapeHtml(web["web.connections-strava-hint"])}</p>
          ${
            input.stravaStartUrl === undefined
              ? `<button type="button" disabled>${escapeHtml(web["web.connections-link-strava"])}</button>`
              : `<p><a class="chip" href="${escapeHtml(input.stravaStartUrl)}">${escapeHtml(web["web.connections-link-strava"])}</a></p>`
          }`;
    return `<section class="card">
      <h2>${escapeHtml(title)}</h2>
      <p><span class="chip ${connection?.status === "connected" ? "done" : "quiet"}">${escapeHtml(statusOf(connection ?? { ...emptyConnection(input, provider) }))}</span></p>
      ${account}
      <p class="muted">${escapeHtml(web["web.connections-last-sync"])}: ${lastSync}</p>
      ${credential}
      ${body}
    </section>`;
  };
  const sources: Array<{ value: SyncPreference["source"]; label: string }> = [
    { value: "manual", label: web["web.connections-manual"] },
    { value: "strava", label: web["web.connections-strava"] },
    { value: "garmin", label: web["web.connections-garmin"] },
    { value: "both", label: web["web.connections-both"] },
  ];
  const current = input.sync?.source ?? "manual";
  const radios = sources
    .map(
      (source) => `<label class="choice"><input type="radio" name="source" value="${source.value}"${source.value === current ? " checked" : ""}><span>${escapeHtml(source.label)}</span></label>`,
    )
    .join("\n");
  const message = input.message === undefined ? "" : `<p class="chip done" role="status">${escapeHtml(input.message)}</p>`;
  const error = input.error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(input.error)}</p>`;
  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(web["web.nav-connections"])}</p>
      <h1 class="page-title">${escapeHtml(web["web.connections-title"])}</h1>
      <p class="page-sub">${escapeHtml(web["web.connections-intro"])}</p>
    </header>`;
  const notice = `${message}${error}`;
  const body = `${pageHead}
    ${notice.length === 0 ? "" : `<section class="card">${notice}</section>`}
    ${card("strava")}
    ${card("garmin")}
    <section class="card">
      <h2>${escapeHtml(web["web.connections-sync-from"])}</h2>
      <form method="post" action="/connections/sync-preference" class="stack">
        ${radios}
        <button type="submit">${escapeHtml(web["web.connections-save-sync"])}</button>
      </form>
    </section>`;
  return layout({ locale: input.locale, title: web["web.connections-title"], body, active: "/connections", signedIn: true });
}

const emptyConnection = (input: ConnectionsPageInput, provider: Connection["provider"]): Connection => ({
  userId: "",
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

export function renderPain(input: PainPageInput): string {
  const messages = messagesFor(input.locale);
  const trendSentence = (trend: PainTrend): string => {
    const days = formatNumber(input.windowDays);
    if (trend.note === "no-reports") return format(messages.web["web.pain-trend-none"], { days });
    if (trend.note === "one-report") return messages.web["web.pain-trend-unknown"];
    const peak = formatNumber(trend.peak ?? 0);
    const template =
      trend.direction === "rising"
        ? messages.web["web.pain-trend-rising"]
        : trend.direction === "falling"
          ? messages.web["web.pain-trend-falling"]
          : messages.web["web.pain-trend-stable"];
    return format(template, { days, peak });
  };

  const body =
    input.reports.length === 0
      ? `<section class="card"><p>${escapeHtml(trendSentence(input.trend))}</p><p>${escapeHtml(messages.web["web.pain-empty"])}</p>
        <p class="muted"><a href="/">${escapeHtml(messages.web["web.season-back"])}</a></p></section>`
      : `<section class="card">
      <h2>${escapeHtml(messages.web["web.pain-title"])}</h2>
      <p class="muted">${escapeHtml(trendSentence(input.trend))}</p>
      <ul class="week">${input.reports
        .map((report) => {
          const flags: string[] = [];
          if (report.nightPain) flags.push(messages.web["web.pain-flag-night"]);
          if (report.trendGaitChange) flags.push(messages.web["web.pain-flag-gait"]);
          if (report.knownInjury) flags.push(messages.web["web.pain-flag-known"]);
          const flagText = flags.length === 0 ? "" : `<p class="note">${escapeHtml(flags.join(" · "))}</p>`;
          return `<li class="row">
        <span class="day">${escapeHtml(report.day)}</span>
        <span class="session">${escapeHtml(
          format(messages.web["web.pain-row"], { site: report.site, intensity: formatNumber(report.intensity) }),
        )}</span>
        ${flagText}
      </li>`;
        })
        .join("\n")}</ul>
      <p class="muted"><a href="/">${escapeHtml(messages.web["web.season-back"])}</a></p>
    </section>`;
  return layout({ locale: input.locale, title: messages.web["web.pain-title"], body, active: "/pain", signedIn: true });
}

export function renderDay(input: DayPageInput): string {
  const messages = messagesFor(input.locale);
  const sessionText = input.session === undefined ? "" : sessionLabel(input.locale, input.session);
  const errorBlock =
    input.error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(messages.web["web.error"], { detail: input.error }))}</p>`;
  const coachPanel = renderCoachPanel({
    locale: input.locale,
    day: input.day,
    ...(input.coachStatus === undefined ? {} : { status: input.coachStatus }),
    ...(input.coachError === undefined ? {} : { error: input.coachError }),
  });

  const adjustment =
    input.adjustment === undefined
      ? ""
      : `<p class="chip adjusted">${escapeHtml(
          format(messages.web["web.adjusted"], {
            before: formatNumber(input.adjustment.beforeKm),
            after: formatNumber(input.adjustment.afterKm),
          }),
        )}</p>`;

  const comment =
    input.comment === undefined
      ? ""
      : `<section class="card" aria-live="polite">
          <h3>${escapeHtml(messages.web["web.comment-title"])}</h3>
          ${input.comment.text.length === 0 ? "" : `<p class="note">${escapeHtml(input.comment.text)}</p>`}
          ${input.comment.nudge === undefined ? "" : `<p class="note">${escapeHtml(input.comment.nudge)}</p>`}
          ${adjustment}
          ${
            input.cost === undefined
              ? ""
              : `<p class="chip quiet">${escapeHtml(`${messages.label.gaveUp} ${input.cost}`)}</p>`
          }
        </section>`;

  const saved = input.saved ? `<p class="chip done" role="status">${escapeHtml(messages.web["web.saved"])}</p>` : "";

  const radios = OUTCOMES.map(
    (outcome) => `<label class="choice">
        <input type="radio" name="outcome" value="${outcome}"${outcome === (input.current?.outcome ?? "completed") ? " checked" : ""}>
        <span>${escapeHtml(outcomeLabel(input.locale, outcome))}</span>
      </label>`,
  ).join("\n");

  // The contract s OutcomeDetail is a closed union, so the row offers exactly those values plus an honest
  // "not said" default. The server refuses a skipped day with no reason rather than inventing one.
  const reasons = ["illness", "travel", "work", "family", "sleep", "motivation", "pain", "weather", "just-didnt", "other"].map(
    (reason) => `<option value="${reason}">${escapeHtml(reason)}</option>`,
  );
  const reasonRow = `<label for="detail">${escapeHtml(messages.web["web.skip-reason"])}</label>
        <select id="detail" name="detail">
          <option value="">${escapeHtml(messages.web["web.skip-reason-none"])}</option>
          ${reasons.join("")}
        </select>`;

  // The form can say "I did something else": an alternate is a legal fact in the contract, and without a control
  // for it the only path to one is the API - which would make the daily trade-off invisible on the surface that
  // shows the trade-off. Partial and rest/missed are derived from the outcome, so the select is not shown for them.
  const takenRow = `<label for="sessionTaken">${escapeHtml(messages.web["web.session-taken"])}</label>
        <select id="sessionTaken" name="sessionTaken">
          <option value="as-prescribed">${escapeHtml(messages.web["web.taken-as-prescribed"])}</option>
          <option value="alternate">${escapeHtml(messages.web["web.taken-alternate"])}</option>
          <option value="extra">${escapeHtml(messages.web["web.taken-extra"])}</option>
        </select>`;

  const dayTitle = format(messages.web["web.day-title"], { weekday: weekdayName(input.locale, input.day), day: input.day });
  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.nav-week"])}</p>
      <h1 class="page-title">${escapeHtml(dayTitle)}</h1>
      <p class="page-sub">${escapeHtml(sessionText)}</p>
    </header>`;
  const notice = `${saved}${errorBlock}`;
  const body = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.nav-pain"])}</p>
      <h1 class="page-title">${escapeHtml(messages.web["web.pain-title"])}</h1>
    </header>${pageHead}
    ${notice.length === 0 ? "" : `<section class="card">${notice}</section>`}
    <form method="post" action="/day/${escapeHtml(input.day)}" class="card stack" data-offline-queue data-day="${escapeHtml(input.day)}" data-saved-locally="${escapeHtml(messages.web["web.saved-locally"])}">
      <fieldset>
        <legend>${escapeHtml(messages.web["web.form-legend"])}</legend>
        ${radios}
        ${reasonRow}
      </fieldset>
      ${takenRow}
      <label for="completedKm">${escapeHtml(messages.web["web.completed-km"])}</label>
      <input id="completedKm" name="completedKm" type="number" min="0" max="250" step="0.1" inputmode="decimal" value="${input.current?.completedKm ?? ""}">
      <label for="rpe">${escapeHtml(messages.web["web.rpe"])}</label>
      <input id="rpe" name="rpe" type="range" min="1" max="10" step="1" value="${input.current?.rpe ?? 6}">
      <label for="legs">${escapeHtml(messages.web["web.legs"])}</label>
      <input id="legs" name="legs" type="range" min="1" max="5" step="1" value="${input.current?.legs ?? 2}">
      ${input.current === undefined
        ? ""
        : `<label for="correctionReason">${escapeHtml(messages.web["web.correction-reason"])}</label>
      <input id="correctionReason" name="correctionReason" type="text" maxlength="280" value="">`}
      <label for="note">${escapeHtml(messages.web["web.note"])}</label>
      <textarea id="note" name="note" rows="2">${escapeHtml(input.current?.note ?? "")}</textarea>
      <input type="hidden" name="idempotencyKey" value="${escapeHtml(input.idempotencyKey)}">
      <button type="submit">${escapeHtml(messages.web["web.save"])}</button>
      <p class="note" data-offline-status role="status"></p>
    </form>
    ${comment}
    ${coachPanel}`;
  return layout({ locale: input.locale, title: input.day, body, active: "/", signedIn: true });
}

export { OUTCOMES };

export interface ReviewSheetInput {
  locale: Locale;
  review: Review;
  /** The first day a change may land: today + freeze_window_days, never today or tomorrow. */
  firstEditableDay: string;
  message: { kind: "accepted"; day: string } | { kind: "declined" } | { kind: "deferred"; day: string } | undefined;
  error: string | undefined;
}

/**
 * The review sheet. The ordering is not a layout choice: `packages/review` refuses an option set whose first
 * option is not "keep the plan", and this page renders the options in the order it was given. The visible cost
 * of every option is the narrator's rendered cost, stored on the option.
 */
/** A review option's wire labelKey is not a sentence; map the ones we ship and fall back to the key. */
function optionLabel(locale: Locale, labelKey: string): string {
  const web = messagesFor(locale).web;
  const known: Record<string, string> = {
    "keep-the-plan": web["web.option-keep-the-plan"],
    "ease-the-easy-day": web["web.option-ease-the-easy-day"],
    "replan-for-orientation": web["web.option-replan-for-orientation"],
    "advisor-proposal": web["web.option-advisor-proposal"],
  };
  return known[labelKey] ?? labelKey;
}

export function renderReview(input: ReviewSheetInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const errorBlock = input.error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(input.error)}</p>`;
  const message =
    input.message === undefined
      ? ""
      : input.message.kind === "accepted"
        ? `<p class="chip done" role="status">${escapeHtml(format(web["web.review-accepted"], { day: input.message.day }))}</p>`
        : input.message.kind === "declined"
          ? `<p class="chip done" role="status">${escapeHtml(web["web.review-declined"])}</p>`
          : `<p class="chip done" role="status">${escapeHtml(format(web["web.review-deferred"], { day: input.message.day }))}</p>`;

  if (input.review.status !== "open") {
    return layout({
      locale: input.locale,
      title: web["web.review-title"],
      // A refused decision on a decided review still has to say why: the page is the only place the runner sees it.
      body: `<section class="card"><p>${escapeHtml(web["web.review-none"])}</p>${errorBlock}${message}</section>`,
      signedIn: true,
    });
  }

  const options = input.review.options
    .map(
      (option, index) => `<label class="choice">
        <input type="radio" name="optionId" value="${escapeHtml(option.optionId)}"${index === 0 ? " checked" : ""}>
        <span>${escapeHtml(optionLabel(input.locale, option.labelKey))}<br><small class="muted">${escapeHtml(
          format(web["web.review-cost"], { cost: option.costSummary }),
        )}</small>${
          option.kind === "replan" && option.changeSummary !== undefined && option.changeSummary !== null
            ? `<br><small class="muted">${escapeHtml(
                format(web["web.review-replan-summary"], {
                  changes: formatNumber(option.changeSummary.changes),
                  kmBefore: formatNumber(option.changeSummary.kmBefore),
                  kmAfter: formatNumber(option.changeSummary.kmAfter),
                }),
              )}</small>`
            : ""
        }</span>
      </label>`,
    )
    .join("\n");

  const body = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.review-title"])}</p>
    </header>
    <section class="card">
      <h2>${escapeHtml(web["web.review-title"])}</h2>
      <p class="muted">${escapeHtml(format(web["web.review-freeze"], { day: input.firstEditableDay }))}</p>
      ${errorBlock}
      ${message}
    </section>
    <form method="post" action="/review/${escapeHtml(input.review.reviewId)}" class="card stack">
      <fieldset>
        <legend>${escapeHtml(web["web.review-options-legend"])}</legend>
        ${options}
      </fieldset>
      <button type="submit" name="decision" value="accept">${escapeHtml(web["web.review-accept"])}</button>
      <button type="submit" name="decision" value="decline" class="quiet">${escapeHtml(web["web.review-decline"])}</button>
      <button type="submit" name="decision" value="defer" class="quiet">${escapeHtml(web["web.review-defer"])}</button>
    </form>`;
  return layout({ locale: input.locale, title: web["web.review-title"], body, signedIn: true });
}

const wizardQuestion = (locale: Locale, step: WizardStep): string => {
  const wizard = messagesFor(locale).wizard;
  return wizard[`wizard.${step.id}.question` as keyof typeof wizard] ?? step.id;
};

const wizardOptionLabel = (locale: Locale, stepId: WizardStepId, value: string): string => {
  const wizard = messagesFor(locale).wizard;
  // Availability answers are day names ("Mon"), not civil dates; weekdayName() parses a date and would throw.
  if (stepId === "availability") return messagesFor(locale).weekday[value as DayName] ?? value;
  return wizard[`wizard.${stepId}.${value}` as keyof typeof wizard] ?? value;
};

/** How one recorded answer reads, in the runner's language. Used by both the wizard and the console. */
export const answerLabel = (locale: Locale, stepId: WizardStepId, answer: Record<string, unknown> | undefined): string => {
  const messages = messagesFor(locale);
  if (answer === undefined) return messages.web["web.console-empty"];
  if (stepId === "availability") {
    const values = Array.isArray(answer["values"]) ? (answer["values"] as string[]) : [];
    return values.map((value) => wizardOptionLabel(locale, stepId, value)).join(", ");
  }
  if (stepId === "weekly-hours") {
    const hours = answer["value"];
    return typeof hours === "number" ? `${formatNumber(hours)} ${messages.wizard["wizard.weekly-hours.unit"]}` : String(hours ?? "");
  }
  const value = answer["value"];
  return typeof value === "string" ? wizardOptionLabel(locale, stepId, value) : String(value ?? "");
};

const wizardField = (locale: Locale, step: WizardStep, current: Record<string, unknown> | undefined): string => {
  const messages = messagesFor(locale);
  if (step.kind === "choice") {
    return (step.options ?? [])
      .map((option) => {
        const checked = current?.["value"] === option ? " checked" : "";
        return `<label class="choice"><input type="radio" name="value" value="${escapeHtml(option)}"${checked}> ${escapeHtml(wizardOptionLabel(locale, step.id, option))}</label>`;
      })
      .join("\n      ");
  }
  if (step.kind === "multi") {
    const chosen = new Set(Array.isArray(current?.["values"]) ? (current["values"] as string[]) : []);
    return (step.options ?? [])
      .map((option) => {
        const checked = chosen.has(option) ? " checked" : "";
        return `<label class="choice"><input type="checkbox" name="values" value="${escapeHtml(option)}"${checked}> ${escapeHtml(weekdayName(locale, option as DayName))}</label>`;
      })
      .join("\n      ");
  }
  const value = typeof current?.["value"] === "number" ? String(current["value"]) : "";
  return `<label class="field"><input type="number" name="value" min="${step.min ?? 0}" max="${step.max ?? 40}" value="${value}"> ${escapeHtml(messages.wizard["wizard.weekly-hours.unit"])}</label>`;
};

export interface WizardPageInput {
  locale: Locale;
  /** Undefined when every required step has an answer: the wizard is done, not empty. */
  step: WizardStep | undefined;
  progress: WizardProgress;
  current: Partial<Record<WizardStepId, Record<string, unknown>>>;
  original: Partial<Record<WizardStepId, Record<string, unknown>>>;
  error: string | undefined;
}

/** The onboarding wizard, one step at a time (ADR-0009): a runner's own orientation, not the system's default. */
export function renderWizard(input: WizardPageInput): string {
  const messages = messagesFor(input.locale);
  const wizard = messages.wizard;
  const progressLine = format(wizard["wizard.progress"], {
    done: formatNumber(input.progress.answered),
    total: formatNumber(input.progress.total),
  });
  if (input.step === undefined) {
    // A finished wizard is a summary, not a dead end: every answer is shown with the link that changes it.
    const answers = WIZARD_STEPS.filter((step) => input.current[step.id] !== undefined)
      .map(
        (step) => `<li class="row"><span class="session">${escapeHtml(wizardQuestion(input.locale, step))}</span>
        <span class="muted">${escapeHtml(answerLabel(input.locale, step.id, input.current[step.id]))}</span>
        <a href="/wizard?step=${encodeURIComponent(step.id)}">${escapeHtml(messages.web["web.wizard-change"])}</a></li>`,
      )
      .join("\n");
    const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.nav-wizard"])}</p>
      <h1 class="page-title">${escapeHtml(wizard["wizard.title"])}</h1>
      <p class="page-sub">${escapeHtml(wizard["wizard.done"])}</p>
    </header>`;
    const done = `${pageHead}<section class="card narrow">
      <ul class="week">${answers}</ul>
      <p class="muted"><a href="/console">${escapeHtml(messages.web["web.console-link"])}</a></p></section>`;
    return layout({ locale: input.locale, title: wizard["wizard.title"], body: done, active: "/wizard", signedIn: true });
  }
  const step = input.step;
  const current = input.current[step.id];
  const original = input.original[step.id];
  const changed = original !== undefined && JSON.stringify(original) !== JSON.stringify(current);
  const errorHtml =
    input.error === undefined
      ? ""
      : `<p class="error" role="alert">${escapeHtml(format(messages.web["web.error"], { detail: input.error }))}</p>`;
  const originalHtml = changed
    ? `<p class="muted">${escapeHtml(messages.web["web.console-original"])}: ${escapeHtml(answerLabel(input.locale, step.id, original))}</p>`
    : "";
  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(messages.web["web.nav-wizard"])}</p>
      <h1 class="page-title">${escapeHtml(wizard["wizard.title"])}</h1>
      <p class="page-sub">${escapeHtml(progressLine)}</p>
    </header>`;
  const body = `${pageHead}<section class="card narrow">
      ${errorHtml}
      <form method="post" action="/wizard" class="stack">
        <input type="hidden" name="stepId" value="${escapeHtml(step.id)}">
        <p>${escapeHtml(wizardQuestion(input.locale, step))}</p>
        ${wizardField(input.locale, step, current)}
        <button type="submit">${escapeHtml(wizard["wizard.next"])}</button>
      </form>${originalHtml}
      <p class="muted"><a href="/console">${escapeHtml(messages.web["web.console-link"])}</a></p></section>`;
  return layout({ locale: input.locale, title: wizard["wizard.title"], body, signedIn: true });
}

export interface ConsolePageInput {
  locale: Locale;
  steps: readonly WizardStep[];
  current: Partial<Record<WizardStepId, Record<string, unknown>>>;
  original: Partial<Record<WizardStepId, Record<string, unknown>>>;
  /** Public guidelines only: an internal safety guideline never reaches a runner's page (ADR-0009). */
  guidelines: readonly GuidelineContract[];
}

/** The personal console: what the runner chose, original next to current, and the guidelines they may read. */
export function renderConsole(input: ConsolePageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const rows = input.steps
    .filter((step) => input.current[step.id] !== undefined || input.original[step.id] !== undefined)
    .map((step) => {
      const current = input.current[step.id];
      const original = input.original[step.id];
      const changed =
        original !== undefined && current !== undefined && JSON.stringify(original) !== JSON.stringify(current);
      const originalCell = changed
        ? `<span class="muted">${escapeHtml(web["web.console-original"])}: ${escapeHtml(answerLabel(input.locale, step.id, original))}</span>`
        : "";
      return `<li class="row"><span class="day">${escapeHtml(wizardQuestion(input.locale, step))}</span><span class="session">${escapeHtml(answerLabel(input.locale, step.id, current))}</span>${originalCell}</li>`;
    });
  const guidelines =
    input.guidelines.length === 0
      ? `<p class="muted">${escapeHtml(web["web.console-guidelines-empty"])}</p>`
      : `<ul class="week">${input.guidelines.map((guideline) => `<li class="row"><span class="session">${escapeHtml(guideline.text)}</span></li>`).join("\n")}</ul>`;
  const doneSteps = input.steps.filter((step) => input.current[step.id] !== undefined).length;
  const sub =
    rows.length === 0
      ? web["web.console-empty"]
      : format(messages.wizard["wizard.progress"], {
          done: formatNumber(doneSteps),
          total: formatNumber(input.steps.length),
        });
  const pageHead = `<header class="page-head">
      <p class="eyebrow">${escapeHtml(web["web.nav-console"])}</p>
      <h1 class="page-title">${escapeHtml(web["web.console-title"])}</h1>
      <p class="page-sub">${escapeHtml(sub)}</p>
    </header>`;
  const body = `${pageHead}<section class="card">
      ${rows.length === 0 ? `<p>${escapeHtml(web["web.console-empty"])}</p>` : `<ul class="week">${rows.join("\n")}</ul>`}
      <p class="muted"><a href="/wizard">${escapeHtml(messages.wizard["wizard.title"])}</a></p>
      <h2>${escapeHtml(web["web.console-guidelines"])}</h2>
      ${guidelines}
      <p class="muted"><a href="/">${escapeHtml(web["web.console-back"])}</a></p></section>`;
  return layout({ locale: input.locale, title: web["web.console-title"], body, active: "/console", signedIn: true });
}


/** The operator's sign-in. One operator in P0 (ADR-0009); the token is the whole identity. */
export function renderAdminLogin(locale: Locale, error: string | undefined): string {
  const messages = messagesFor(locale);
  const errorHtml =
    error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(messages.web["web.error"], { detail: error }))}</p>`;
  const body = `<section class="card narrow"><h2>${escapeHtml(messages.web["web.admin-title"])}</h2>${errorHtml}
      <form method="post" action="/admin/login" class="stack">
        <p class="muted">${escapeHtml(messages.web["web.admin-login-hint"])}</p>
        <input type="password" name="token" autocomplete="off">
        <button type="submit">${escapeHtml(messages.web["web.admin-login-button"])}</button>
      </form></section>`;
  return layout({ locale, title: messages.web["web.admin-title"], body, signedIn: false });
}

export interface AdminProgramsPageInput {
  locale: Locale;
  userId?: string;
  profile?: object;
  plan?: { firstDay: string; sessions: readonly { day: string; distanceKm?: number | null }[] };
  reviews?: readonly { reviewId: string; openedAtDay: string; status: string }[];
  entries?: readonly { day: string; outcome: string; completedKm: number | null }[];
}

/** Admin mode is read-only: an administrator reviews a runner's programme, never edits it (ADR-0012). */
export function renderAdminPrograms(input: AdminProgramsPageInput): string {
  const web = messagesFor(input.locale).web;
  const form = `<form method="get" action="/admin/programs" class="card stack">
      <label for="userId">${escapeHtml(web["web.admin-user-id"])}</label>
      <input id="userId" name="userId" value="${escapeHtml(input.userId ?? "")}" required>
      <button type="submit" class="btn btn-primary">${escapeHtml(web["web.admin-open"])}</button>
    </form>`;
  const profile = input.profile as Record<string, unknown> | undefined;
  const details = input.userId === undefined
    ? ""
    : `<section class="card stack">
        <h2>${escapeHtml(input.userId)}</h2>
        ${profile === undefined ? `<p class="muted">no profile</p>` : `<p class="note">${escapeHtml(`${String(profile["goal"] ?? "-")} / ${String(profile["level"] ?? "-")} / ${String(profile["daysPerWeek"] ?? "-")} days`)}</p>`}
        ${input.plan === undefined ? `<p class="muted">no plan</p>` : `<p class="note">${escapeHtml(`${input.plan.firstDay} · ${input.plan.sessions.length} sessions`)}</p>`}
        ${input.entries === undefined ? "" : `<p class="note">${escapeHtml(`${input.entries.length} entries`)}</p>`}
        ${input.reviews === undefined || input.reviews.length === 0 ? `<p class="muted">no reviews</p>` : `<table class="table"><thead><tr><th>opened</th><th>status</th></tr></thead><tbody>${input.reviews.map((review) => `<tr><td><a href="/review/${escapeHtml(review.reviewId)}">${escapeHtml(review.openedAtDay)}</a></td><td>${escapeHtml(review.status)}</td></tr>`).join("")}</tbody></table>`}
      </section>`;
  return layout({
    locale: input.locale,
    title: web["web.admin-programs"],
    body: `<header class="page-head"><p class="eyebrow">${escapeHtml(web["web.nav-console"])}</p><h1 class="page-title">${escapeHtml(web["web.admin-programs"])}</h1></header>${form}${details}`,
    signedIn: true,
    active: "/admin/programs",
  });
}

export interface AdminGuidelinesPageInput {
  locale: Locale;
  /** Every version, internal ones included: the operator is the one person allowed to read them all. */
  guidelines: readonly GuidelineContract[];
  saved: boolean;
  error: string | undefined;
}

const TIERS = ["non-negotiable", "constraint", "default"] as const;
const SCOPES = ["safety", "medical", "progression", "tone", "review-cadence"] as const;
const VISIBILITIES = ["internal", "public"] as const;

const selectOf = (name: string, options: readonly string[]): string =>
  `<select name="${escapeHtml(name)}">${options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}</select>`;

/** The operator console: append a guideline version. There is no edit form, because a version is not editable. */
export function renderAdminGuidelines(input: AdminGuidelinesPageInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const saved = input.saved ? `<p class="chip done">${escapeHtml(web["web.admin-saved"])}</p>` : "";
  const errorHtml =
    input.error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(web["web.error"], { detail: input.error }))}</p>`;
  const rows = input.guidelines.map(
    (guideline) =>
      `<li class="row"><span class="day">${escapeHtml(guideline.guidelineId)}@${formatNumber(guideline.version)}</span>` +
      `<span class="session">${escapeHtml(guideline.tier)} / ${escapeHtml(guideline.scope)} / ${escapeHtml(guideline.visibility)}</span>` +
      `<span class="muted">${escapeHtml(guideline.text)}</span></li>`,
  );
  const list =
    input.guidelines.length === 0
      ? `<p class="muted">${escapeHtml(web["web.admin-guidelines-empty"])}</p>`
      : `<ul class="week">${rows.join("\n")}</ul>`;
  const body = `<section class="card"><h2>${escapeHtml(web["web.admin-title"])}</h2>${saved}${errorHtml}
      <h2>${escapeHtml(web["web.admin-guidelines-title"])}</h2>${list}
      <form method="post" action="/admin/guidelines" class="stack">
        <label class="field">${escapeHtml(web["web.admin-guideline-id"])} <input name="guidelineId" required pattern="[a-z0-9]+(-[a-z0-9]+)*"></label>
        <label class="field">${escapeHtml(web["web.admin-version"])} <input type="number" name="version" min="1" value="1" required></label>
        <label class="field">${escapeHtml(web["web.admin-tier"])} ${selectOf("tier", TIERS)}</label>
        <label class="field">${escapeHtml(web["web.admin-scope"])} ${selectOf("scope", SCOPES)}</label>
        <label class="field">${escapeHtml(web["web.admin-visibility"])} ${selectOf("visibility", VISIBILITIES)}</label>
        <label class="field">${escapeHtml(web["web.admin-text"])} <textarea name="text" required></textarea></label>
        <label class="field">${escapeHtml(web["web.admin-rationale"])} <textarea name="rationale" required></textarea></label>
        <label class="field">${escapeHtml(web["web.admin-effective-from"])} <input type="date" name="effectiveFrom" required></label>
        <button type="submit">${escapeHtml(web["web.admin-create"])}</button>
      </form>
      <form method="post" action="/admin/sign-out"><button type="submit" class="quiet">${escapeHtml(web["web.admin-logout"])}</button></form>
    </section>`;
  return layout({ locale: input.locale, title: web["web.admin-title"], body, signedIn: false });
}
