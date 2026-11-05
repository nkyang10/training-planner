/**
 * The coach panel: a question box on a day page.
 *
 * The panel only asks; it never answers. The answer arrives as a review the runner can accept or decline, so
 * nothing here composes a sentence about training. Copy comes from the catalogue when the key is present, with a
 * literal fallback so a catalogue that has not caught up yet degrades instead of crashing.
 */
import type { Locale } from "@training-planner/i18n";
import { messagesFor } from "@training-planner/i18n";
import { escapeHtml } from "./html";

export interface CoachPanelInput {
  locale: Locale;
  day: string; // ISO day the runner is asking about
  status?: string; // optional result message already localised by the caller
  error?: string;
}

/** A day is a link and a link is never guessed: a malformed day is a caller bug, not a bad URL to render. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function renderCoachPanel(input: CoachPanelInput): string {
  const { day, status, error } = input;
  if (!ISO_DAY.test(day)) throw new Error("day must be ISO");

  // Read the catalogue through an indexable view: the coach keys reached the catalogue before they reached the
  // `WebTemplate` union, and a catalogue that lags a deploy must degrade to the literal, never crash the day page.
  const web = messagesFor(input.locale).web as unknown as Record<string, string | undefined>;

  const title = web["web.coach-ask-title"] ?? "Ask the coach";
  const sub =
    web["web.coach-ask-sub"] ??
    "The coach answers from your plan and logs; a change opens a review. It will not invent numbers.";
  const placeholder = web["web.coach-ask-placeholder"] ?? "What would you like to ask about this day?";
  const button = web["web.coach-ask-button"] ?? "Ask the coach";

  const lines: string[] = [
    `<section class="card coach-panel" aria-labelledby="coach-ask-title">`,
    `  <h2 id="coach-ask-title">${escapeHtml(title)}</h2>`,
    `  <p class="muted">${escapeHtml(sub)}</p>`,
    `  <form method="post" action="/day/${escapeHtml(day)}/coach" class="stack">`,
    // The catalogue has no separate "question" label key yet, and inventing one here would leak English into the
    // Chinese page. The heading names the box instead, through the accessible name rather than a second visible label.
    `    <textarea id="coach-ask-question" name="question" required maxlength="500" rows="3" aria-label="${escapeHtml(
      title,
    )}" placeholder="${escapeHtml(placeholder)}"></textarea>`,
    `    <button class="btn btn-primary" type="submit">${escapeHtml(button)}</button>`,
    `  </form>`,
  ];

  if (status !== undefined) {
    lines.push(`  <p class="chip done" role="status">${escapeHtml(status)}</p>`);
  }
  if (error !== undefined) {
    lines.push(`  <p class="error" role="alert">${escapeHtml(error)}</p>`);
  }

  lines.push(`</section>`);
  return `${lines.join("\n")}\n`;
}
