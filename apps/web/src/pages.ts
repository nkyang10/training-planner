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
        <a href="/console">${escapeHtml(messages.web["web.console-link"])}</a> ·
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
    const done = `<section class="card narrow"><h2>${escapeHtml(wizard["wizard.title"])}</h2>
      <p>${escapeHtml(wizard["wizard.done"])}</p>
      <ul class="week">${answers}</ul>
      <p class="muted"><a href="/console">${escapeHtml(messages.web["web.console-link"])}</a></p></section>`;
    return layout({ locale: input.locale, title: wizard["wizard.title"], body: done, signedIn: true });
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
  const body = `<section class="card narrow"><h2>${escapeHtml(wizard["wizard.title"])}</h2>
      <p class="muted">${escapeHtml(progressLine)}</p>${errorHtml}
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
  const body = `<section class="card"><h2>${escapeHtml(web["web.console-title"])}</h2>
      ${rows.length === 0 ? `<p>${escapeHtml(web["web.console-empty"])}</p>` : `<ul class="week">${rows.join("\n")}</ul>`}
      <p class="muted"><a href="/wizard">${escapeHtml(messages.wizard["wizard.title"])}</a></p>
      <h2>${escapeHtml(web["web.console-guidelines"])}</h2>
      ${guidelines}
      <p class="muted"><a href="/">${escapeHtml(web["web.console-back"])}</a></p></section>`;
  return layout({ locale: input.locale, title: web["web.console-title"], body, signedIn: true });
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
