/**
 * The HTML shell: escaping and the document frame.
 *
 * The frame is a **tablet app shell**, not a page with a header: a left rail for the sections, a slim top bar for the
 * current view, and a content column that breathes. On a phone the rail folds into the bottom tab bar; the tabs keep the
 * same links so the two layouts never disagree about where a section lives.
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
  /** The section to mark active, as a path (e.g. "/month"). Optional: a page that forgets it still renders. */
  active?: string;
}

const link = (href: string, label: string, active: string | undefined): string =>
  `<a class="side-link${active === href ? " active" : ""}" href="${href}"${active === href ? ' aria-current="page"' : ""}>${label}</a>`;

export function layout(input: LayoutInput): string {
  const messages = messagesFor(input.locale);
  const web = messages.web;
  const htmlLang = input.locale === "zh-Hant" ? "zh-Hant" : "en";
  const brand = `<a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">⚡</span>
      <span class="brand-copy"><strong>${escapeHtml(web["web.brand"])}</strong><small>${escapeHtml(web["web.brand-tagline"])}</small></span>
    </a>`;

  const sidebar = `<aside class="sidebar">
      ${brand}
      <nav class="side-nav" aria-label="Sections">
        <section class="side-group">
          <h2>${escapeHtml(web["web.side-train"])}</h2>
          ${link("/", escapeHtml(web["web.nav-week"]), input.active)}
          ${link("/month", escapeHtml(web["web.nav-month"]), input.active)}
          ${link("/season", escapeHtml(web["web.nav-season"]), input.active)}
          ${link("/stats", escapeHtml(web["web.nav-stats"]), input.active)}
        </section>
        <section class="side-group">
          <h2>${escapeHtml(web["web.side-log"])}</h2>
          ${link("/", escapeHtml(web["web.side-today"]), input.active)}
          ${link("/pain", escapeHtml(web["web.nav-pain"]), input.active)}
        </section>
        <section class="side-group">
          <h2>${escapeHtml(web["web.side-plan"])}</h2>
          ${link("/wizard", escapeHtml(web["web.nav-wizard"]), input.active)}
          ${link("/coach", escapeHtml(web["web.nav-coach"]), input.active)}
          ${link("/console", escapeHtml(web["web.nav-console"]), input.active)}
        </section>
        <section class="side-group">
          <h2>${escapeHtml(web["web.side-account"])}</h2>
          ${link("/connections", escapeHtml(web["web.nav-connections"]), input.active)}
          ${link("/export", escapeHtml(web["web.nav-export"]), input.active)}
        </section>
      </nav>
      <div class="sidebar-foot">
        <form method="post" action="/sign-out" class="inline">
          <button type="submit" class="btn btn-ghost">${escapeHtml(web["web.sign-out"])}</button>
        </form>
      </div>
    </aside>`;

  const topbar = `<header class="topbar">
      <div class="topbar-brand">${escapeHtml(web["web.title"])}</div>
      <div class="topbar-title">${escapeHtml(input.title)}</div>
      <div class="topbar-actions">
        <a class="btn btn-ghost" href="/month">${escapeHtml(web["web.nav-month"])}</a>
        <a class="btn btn-primary" href="/">${escapeHtml(web["web.side-today"])}</a>
      </div>
    </header>`;

  // The mobile bar keeps the same destinations as the rail; it is the rail folded, not a second information architecture.
  const tabs = `<nav class="tabs" aria-label="Sections">
      <a href="/">${escapeHtml(web["web.nav-week"])}</a>
      <a href="/month">${escapeHtml(web["web.nav-month"])}</a>
      <a href="/season">${escapeHtml(web["web.nav-season"])}</a>
      <a href="/stats">${escapeHtml(web["web.nav-stats"])}</a>
      <a href="/pain">${escapeHtml(web["web.nav-pain"])}</a>
      <a href="/wizard">${escapeHtml(web["web.nav-wizard"])}</a>
      <a href="/coach">${escapeHtml(web["web.nav-coach"])}</a>
      <a href="/connections">${escapeHtml(web["web.nav-connections"])}</a>
      <a href="/export">${escapeHtml(web["web.nav-export"])}</a>
    </nav>`;

  const shell = input.signedIn
    ? `<div class="app-shell">${sidebar}<div class="app-body">${topbar}<main class="main">${input.body}</main></div></div>${tabs}`
    : `<main class="main main-auth">
        <div class="auth-brand">${brand}</div>
        ${input.body}
      </main>`;

  return `<!doctype html>
<html lang="${htmlLang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#FF5A1F">
  <title>${escapeHtml(input.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="/static/app.css">
  <script src="/static/queue.js" defer></script>
</head>
<body>
  ${shell}
</body>
</html>`;
}
