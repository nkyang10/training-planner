/**
 * The three pages: sign in, the week, the day drawer.
 *
 * Everything the runner reads is a catalogue string or a number the engine produced; the pages never compose a
 * sentence about training. The comment on the day page is the narrator's output, inserted verbatim (escaped),
 * because a page that re-words the coach note would be a second narrator.
 */
import type { DayEntry, PlanVersion, Session } from "@training-planner/domain";
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
  const body = `
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
    <form method="post" action="/day/${escapeHtml(input.day)}" class="card stack">
      <fieldset>
        <legend>${escapeHtml(messages.web["web.form-legend"])}</legend>
        ${radios}
        ${reasonRow}
      </fieldset>
      <label for="rpe">${escapeHtml(messages.web["web.rpe"])}</label>
      <input id="rpe" name="rpe" type="range" min="1" max="10" step="1" value="${input.current?.rpe ?? 6}">
      <label for="legs">${escapeHtml(messages.web["web.legs"])}</label>
      <input id="legs" name="legs" type="range" min="1" max="5" step="1" value="${input.current?.legs ?? 2}">
      <label for="note">${escapeHtml(messages.web["web.note"])}</label>
      <textarea id="note" name="note" rows="2">${escapeHtml(input.current?.note ?? "")}</textarea>
      <input type="hidden" name="idempotencyKey" value="${escapeHtml(input.idempotencyKey)}">
      <button type="submit">${escapeHtml(messages.web["web.save"])}</button>
    </form>
    ${comment}`;
  return layout({ locale: input.locale, title: input.day, body, signedIn: true });
}

export { OUTCOMES };
