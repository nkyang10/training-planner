/**
 * The three pages: sign in, the week, the day drawer.
 *
 * Everything the runner reads is a catalogue string or a number the engine produced; the pages never compose a
 * sentence about training. The comment on the day page is the narrator's output, inserted verbatim (escaped),
 * because a page that re-words the coach note would be a second narrator.
 */
import type { DayEntry, PlanVersion, Review, Session } from "@training-planner/domain";
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
}

const sessionLabel = (locale: Locale, session: Session): string => {
  const messages = messagesFor(locale);
  if (session.kind === "rest") return messages.web["web.rest-day"];
  return format(messages.web["web.session"], {
    kind: messages.kind[session.kind],
    km: formatNumber(session.distanceKm ?? 0),
  });
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
  const banner =
    input.openReview === undefined
      ? ""
      : `<a class="card banner" href="/review/${escapeHtml(input.openReview.reviewId)}">${escapeHtml(messages.web["web.review-banner"])}</a>`;
  const body = `
    ${banner}
    <section class="card">
      <h2>${escapeHtml(messages.web["web.calendar-title"])}</h2>
      ${intro}
      <ul class="week">${rows.join("\n")}</ul>
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
      <label for="completedKm">${escapeHtml(messages.web["web.completed-km"])}</label>
      <input id="completedKm" name="completedKm" type="number" min="0" max="250" step="0.1" inputmode="decimal" value="${input.current?.completedKm ?? ""}">
      <label for="rpe">${escapeHtml(messages.web["web.rpe"])}</label>
      <input id="rpe" name="rpe" type="range" min="1" max="10" step="1" value="${input.current?.rpe ?? 6}">
      <label for="legs">${escapeHtml(messages.web["web.legs"])}</label>
      <input id="legs" name="legs" type="range" min="1" max="5" step="1" value="${input.current?.legs ?? 2}">
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