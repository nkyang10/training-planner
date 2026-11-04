/**
 * The stylesheet, served as one file. No build step, no framework, no client-side CSS-in-JS: a phone at 22:40
 * gets one small stylesheet and one HTML document.
 *
 * Mobile first, dark-mode aware, and deliberately quiet: a logged day is not a reward and an unlogged day is
 * not a warning (feedback-microcopy.md).
 */
export const STYLES = `
:root {
  --bg: #fbfaf7;
  --ink: #1f2328;
  --muted: #5c6672;
  --line: #e3ded4;
  --card: #ffffff;
  --accent: #2f6f4f;
  --quiet: #8a8577;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171a;
    --ink: #e9e6df;
    --muted: #a4a09a;
    --line: #2a2f35;
    --card: #1b1f24;
    --accent: #7fc9a3;
    --quiet: #8f8b84;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}
.bar h1 { font-size: 17px; margin: 0; font-weight: 600; }
main { padding: 16px; max-width: 640px; margin: 0 auto; }
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 16px;
}
.card.narrow { max-width: 380px; margin: 48px auto; }
h2 { font-size: 16px; margin: 0 0 12px; }
h3 { font-size: 14px; margin: 0 0 8px; color: var(--muted); font-weight: 600; }
.muted { color: var(--muted); margin: 0 0 12px; }
.week { list-style: none; margin: 0; padding: 0; }
.row { border-top: 1px solid var(--line); }
.row:first-child { border-top: 0; }
.row.today { background: color-mix(in srgb, var(--accent) 8%, transparent); border-radius: 10px; }
.row-link {
  display: grid;
  grid-template-columns: 5.5rem 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 12px 4px;
  color: inherit;
  text-decoration: none;
  min-height: 48px;
}
.day { font-weight: 600; }
.session { color: var(--muted); font-variant-numeric: tabular-nums; }
.chip {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  white-space: nowrap;
}
.chip.done { color: var(--accent); border-color: currentColor; }
.chip.quiet { color: var(--quiet); }
.chip.adjusted { display: inline-block; margin: 8px 0 0; color: var(--accent); border-color: currentColor; }
.note { margin: 4px 4px 12px; color: var(--ink); }
.error { color: #a3342c; }
.stack { display: grid; gap: 10px; }
fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
legend { font-weight: 600; padding: 0; margin-bottom: 4px; }
.choice { display: flex; align-items: center; gap: 8px; min-height: 44px; }
label { color: var(--muted); font-size: 14px; }
input[type="range"] { width: 100%; accent-color: var(--accent); }
textarea, input[type="password"], select {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--card);
  color: var(--ink);
  font: inherit;
}
button {
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 0;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
}
button.quiet { background: transparent; color: var(--muted); font-weight: 400; }
.inline { margin: 0; }
@media (max-width: 380px) {
  .row-link { grid-template-columns: 4.5rem 1fr; }
  .row-link .chip { grid-column: 2; justify-self: start; }
}
`;
