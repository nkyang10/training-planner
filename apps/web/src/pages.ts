/**
 * The three pages: sign in, the week, the day drawer.
 *
 * Everything the runner reads is a catalogue string or a number the engine produced; the pages never compose a
 * sentence about training. The comment on the day page is the narrator's output, inserted verbatim (escaped),
 * because a page that re-words the coach note would be a second narrator.
 */
import type { DayEntry, PainReport, PlanVersion, Review, Session } from "@training-planner/domain";
import type { PainTrend } from "@training-planner/entries";
import type { SeasonSummary } from "@training-planner/season";
import { format, formatNumber, messagesFor, weekdayName } from "@training-planner/i18n";
import type { Locale } from "@training-planner/i18n";
import { escapeHtml, layout } from "./html";

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
}

export interface DayPageInput {
  locale: Locale;
  day: string;
  session: Session | undefined;
  current: DayEntry | undefined;
  comment: { text: string; nudge?: string } | undefined;
  /** The next revision's idempotency key: stable for a double submit of the same form, new on a fresh page. */
  idempotencyKey: string;
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

export function renderCalendar(input: CalendarPageInput): string {
  const messages = messagesFor(input.locale);
  if (input.plan === undefined) {
    return layout({
      locale: input.locale,
      title: messages.web["web.title"],
      body: `<section class="card"><p>${escapeHtml(messages.web["web.no-plan"])}</p></section>`,
      signedIn: true,
    });
  }

  const rows = input.days.map((day) => {
    const session = input.plan?.sessions.find((candidate) => candidate.day === day);
    const current = input.currentOf(day);
    const comment = input.commentOf(day);
    const isToday = day === input.today;
    const status =
      current === undefined
        ? `<span class="chip quiet">${escapeHtml(messages.web["web.not-logged"])}</span>`
        : `<span class="chip done">${escapeHtml(messages.web["web.logged"])}</span>`;
    const sessionText = session === undefined ? "" : sessionLabel(input.locale, session);
    const commentText =
      comment === undefined || comment.text.length === 0 ? "" : `<p class="note">${escapeHtml(comment.text)}</p>`;
    return `<li class="row${isToday ? " today" : ""}">
      <a href="/day/${escapeHtml(day)}" class="row-link" aria-label="${escapeHtml(
        format(messages.web["web.day-link"], { weekday: weekdayName(input.locale, day) }),
      )}">
        <span class="day">${escapeHtml(weekdayName(input.locale, day))}</span>
        <span class="session">${escapeHtml(sessionText)}</span>
        ${status}
      </a>
      ${commentText}
    </li>`;
  });

  const intro = input.intro === undefined ? "" : `<p class="muted">${escapeHtml(input.intro)}</p>`;
  const prompt =
    input.prompt === undefined ? "" : `<p class="chip prompt" role="status">${escapeHtml(input.prompt)}</p>`;
  const banner =
    input.openReview === undefined
      ? ""
      : `<a class="card banner" href="/review/${escapeHtml(input.openReview.reviewId)}">${escapeHtml(messages.web["web.review-banner"])}</a>`;
  const body = `
    ${prompt}
    ${banner}
    <section class="card">
      <h2>${escapeHtml(messages.web["web.calendar-title"])}</h2>
      ${intro}
      <ul class="week">${rows.join("\n")}</ul>
      <p class="muted">
        <a href="/season">${escapeHtml(messages.web["web.season-link"])}</a> ·
        <a href="/pain">${escapeHtml(messages.web["web.pain-link"])}</a>
      </p>
    </section>`;
  return layout({ locale: input.locale, title: messages.web["web.calendar-title"], body, signedIn: true });
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
      signedIn: true,
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
    return `<li class="row${week.status === "current" ? " today" : ""}">
      <span class="day">${escapeHtml(format(messages.web["web.season-week"], { day: week.weekStart }))}</span>
      <span class="chip quiet">${escapeHtml(statusLabel(week.status))}</span>
      <span class="session">${escapeHtml(facts.join(" · "))}</span>
    </li>`;
  });

  const adherence =
    summary.adherencePct === null
      ? messages.web["web.season-adherence-none"]
      : format(messages.web["web.season-adherence"], { pct: formatNumber(summary.adherencePct) });

  const body = `
    <section class="card">
      <h2>${escapeHtml(messages.web["web.season-title"])}</h2>
      <p class="muted">${escapeHtml(adherence)}</p>
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
          if (report.nightPain) flags.push("night pain");
          if (report.trendGaitChange) flags.push("gait change");
          if (report.knownInjury) flags.push("known injury");
          const flagText = flags.length === 0 ? "" : `<p class="note">${escapeHtml(messages.web["web.pain-flags"])}</p>`;
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
  return layout({ locale: input.locale, title: messages.web["web.pain-title"], body, signedIn: true });
}

export function renderDay(input: DayPageInput): string {
  const messages = messagesFor(input.locale);
  const sessionText = input.session === undefined ? "" : sessionLabel(input.locale, input.session);
  const errorBlock =
    input.error === undefined ? "" : `<p class="error" role="alert">${escapeHtml(format(messages.web["web.error"], { detail: input.error }))}</p>`;

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
        <input type="radio" name="outcome" value="${outcome}"${outcome === "completed" ? " checked" : ""}>
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

  const body = `
    <section class="card">
      <h2>${escapeHtml(format(messages.web["web.day-title"], { weekday: weekdayName(input.locale, input.day), day: input.day }))}</h2>
      <p class="muted">${escapeHtml(sessionText)}</p>
      ${saved}
      ${errorBlock}
    </section>
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
      <label for="correctionReason">${escapeHtml(messages.web["web.correction-reason"])}</label>
      <input id="correctionReason" name="correctionReason" type="text" maxlength="280" value="">
      <label for="note">${escapeHtml(messages.web["web.note"])}</label>
      <textarea id="note" name="note" rows="2">${escapeHtml(input.current?.note ?? "")}</textarea>
      <input type="hidden" name="idempotencyKey" value="${escapeHtml(input.idempotencyKey)}">
      <button type="submit">${escapeHtml(messages.web["web.save"])}</button>
      <p class="note" data-offline-status role="status"></p>
    </form>
    ${comment}`;
  return layout({ locale: input.locale, title: input.day, body, signedIn: true });
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
        <span>${escapeHtml(option.labelKey)}<br><small class="muted">${escapeHtml(
          format(web["web.review-cost"], { cost: option.costSummary }),
        )}</small></span>
      </label>`,
    )
    .join("\n");

  const body = `
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