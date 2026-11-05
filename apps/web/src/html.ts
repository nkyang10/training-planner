/**
 * The HTML layer's two primitives: escaping and the document shell.
 *
 * Escaping is not optional in a page that renders a runner's own note back at them; a note is free text and the
 * comment is generated text, and both are inserted into markup. `escapeHtml` is applied at every insertion site
 * by the page functions, not by the template, so a forgotten call is a visible `&lt;` rather than an injection.
 */
import type { Locale } from "@training-planner/i18n";
import { messagesFor } from "@training-planner/i18n";

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ENTITIES[character] ?? character);
}

export interface LayoutInput {
  locale: Locale;
  title: string;
  body: string;
  signedIn: boolean;
}

export function layout(input: LayoutInput): string {
  const messages = messagesFor(input.locale);
  const htmlLang = input.locale === "zh-Hant" ? "zh-Hant" : "en";
  const header = input.signedIn
    ? `<header class="bar">
      <h1>${escapeHtml(messages.web["web.title"])}</h1>
      <form method="post" action="/sign-out" class="inline">
        <button type="submit" class="quiet">${escapeHtml(messages.web["web.sign-out"])}</button>
      </form>
    </header>`
    : `<header class="bar"><h1>${escapeHtml(messages.web["web.title"])}</h1></header>`;
  // Navigation is a first-class part of the shell, not a footer afterthought: on a phone the footer was below the
  // fold, so the app had no visible way to reach the season, the month or the console.
  const nav = input.signedIn
    ? `<nav class="tabs" aria-label="Sections">
      <a href="/">${escapeHtml(messages.web["web.nav-week"])}</a>
      <a href="/month">${escapeHtml(messages.web["web.nav-month"])}</a>
      <a href="/season">${escapeHtml(messages.web["web.nav-season"])}</a>
      <a href="/console">${escapeHtml(messages.web["web.nav-console"])}</a>
      <a href="/wizard">${escapeHtml(messages.web["web.nav-wizard"])}</a>
      <a href="/pain">${escapeHtml(messages.web["web.nav-pain"])}</a>
      <a href="/connections">${escapeHtml(messages.web["web.nav-connections"])}</a>
      <a href="/export">${escapeHtml(messages.web["web.nav-export"])}</a>
    </nav>`
    : "";
  return `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <link rel="stylesheet" href="/static/app.css">
  <script src="/static/queue.js" defer></script>
</head>
<body>
  ${header}
  ${nav}
  <main>${input.body}</main>
</body>
</html>`;
}
