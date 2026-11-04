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
  return `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(input.title)}</title>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
  ${header}
  <main>${input.body}</main>
</body>
</html>`;
}
