/**
 * The stylesheet, served as one file. No build step, no framework, no client-side CSS-in-JS.
 *
 * A professional tablet app: cream canvas, a fixed ember-lit rail, a blurred topbar, one 1320px working column.
 * Summer heat on paper - solar, coral and lime over deep charcoal ink - with warm shadows, 20px radii and a bold
 * display face. The shell and pages own the structure; this file only dresses it.
 */
export const STYLES = `
:root {
  --ink: #1B120C;
  --ink-2: #3A2A20;
  --paper: #FFF8F0;
  --surface: #FFFFFF;
  --wash: #FFF1E4;
  --line: #F0DCCB;
  --ember: #FF5A1F;
  --solar: #FFB020;
  --coral: #FF4D6D;
  --lime: #C6F24E;
  --success: #1F7A4D;
  --danger: #C03A2B;
  --muted: #7A6455;
  --heat: linear-gradient(135deg, #FF5A1F 0%, #FFB020 55%, #FF4D6D 100%);
  --radius: 20px;
  --radius-sm: 14px;
  --shadow: 0 18px 40px -24px rgba(90, 40, 10, .45);
  --shadow-lift: 0 26px 60px -30px rgba(90, 40, 10, .55);
  --font-display: "Bricolage Grotesque", "Archivo", system-ui, sans-serif;
  --font-body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  background-color: var(--paper);
  background-image:
    radial-gradient(1100px 540px at 106% -8%, rgba(255, 176, 32, .18), rgba(255, 176, 32, 0) 62%),
    radial-gradient(760px 420px at -10% 4%, rgba(255, 90, 31, .09), rgba(255, 90, 31, 0) 60%);
  background-attachment: fixed;
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

h1, h2, h3, h4 { margin: 0; color: var(--ink); font-family: var(--font-display); font-weight: 700; line-height: 1.15; }
p { margin: 0 0 12px; }
a { color: var(--ember); text-underline-offset: 3px; }
a:hover { color: var(--coral); }
img, svg, video { display: block; max-width: 100%; }
small { font-size: 12px; }
hr { height: 1px; border: 0; background: var(--line); }
::selection { background: var(--solar); color: var(--ink); }
:focus-visible { outline: 3px solid var(--ember); outline-offset: 2px; }

/* Shell ------------------------------------------------------------------ */

.app-shell {
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  align-items: start;
  min-height: 100vh;
}
.app-shell > .sidebar { grid-column: 1; grid-row: 1 / span 2; }
.app-shell > :not(.sidebar) { grid-column: 2; min-width: 0; }

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 268px;
  padding: 24px 18px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: linear-gradient(180deg, #FFF9F2 0%, var(--wash) 100%);
  border-right: 1px solid var(--line);
  box-shadow: 24px 0 50px -46px rgba(90, 40, 10, .5);
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 2px 6px 20px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -.02em;
  text-decoration: none;
}
.brand:hover { color: var(--ink); }
.brand small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .16em;
  text-transform: uppercase;
}
.brand-mark {
  display: grid;
  flex: none;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: var(--heat);
  box-shadow: 0 14px 26px -14px rgba(255, 90, 31, .75), inset 0 1px 0 rgba(255, 255, 255, .4);
}
.brand-mark::before {
  content: "";
  width: 18px;
  height: 23px;
  background: #FFFFFF;
  clip-path: polygon(58% 0, 16% 58%, 45% 58%, 36% 100%, 84% 42%, 53% 42%);
}

.side-nav { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; }
.side-group { display: grid; gap: 3px; margin-top: 18px; }
.side-group:first-of-type { margin-top: 8px; }
.side-group h2 {
  margin: 0 0 6px;
  padding: 0 12px;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.side-link {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  white-space: nowrap;
  transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.side-link:hover { background: #FFE9D6; color: var(--ink); }
.side-link:active { transform: translateY(1px); }
.side-link.active { background: var(--heat); color: #FFFFFF; box-shadow: 0 14px 28px -16px rgba(255, 90, 31, .7); }
.side-link.active:hover { color: #FFFFFF; }

.sidebar-foot {
  display: grid;
  gap: 8px;
  margin-top: auto;
  padding: 16px 10px 0;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}
.sidebar-foot a { color: var(--ink-2); font-weight: 600; text-decoration: none; }
.sidebar-foot a:hover { color: var(--ember); }

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 66px;
  padding: 12px 30px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 248, 240, .88);
  background: color-mix(in srgb, var(--paper) 84%, transparent);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
  backdrop-filter: blur(16px) saturate(1.15);
}
.topbar-brand { display: none; }
.topbar-title {
  margin: 0;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -.01em;
}
.topbar-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-left: auto; }

.bar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 248, 240, .88);
  background: color-mix(in srgb, var(--paper) 84%, transparent);
  -webkit-backdrop-filter: blur(16px) saturate(1.15);
  backdrop-filter: blur(16px) saturate(1.15);
}
.bar h1 { margin: 0; font-family: var(--font-display); font-size: 18px; font-weight: 700; line-height: 1.2; }

.main { width: 100%; max-width: 1320px; margin: 0 auto; padding: 32px; }
.main-auth { display: grid; gap: 18px; max-width: 560px; padding: 56px 24px; }
.auth-brand { display: flex; justify-content: center; margin-bottom: 4px; }
.auth-brand .brand { padding: 0; font-size: 22px; }

/* Page heading ----------------------------------------------------------- */

.page-head { margin: 2px 0 26px; }
.page-head > :last-child { margin-bottom: 0; }
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--ember);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.eyebrow::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--heat);
  box-shadow: 0 0 0 3px rgba(255, 90, 31, .12);
}
.page-title {
  margin: 0 0 10px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -.025em;
  text-wrap: balance;
}
.page-sub { max-width: 68ch; margin: 0; color: var(--muted); font-size: 16px; line-height: 1.6; }

/* Hero ------------------------------------------------------------------- */

.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 220px;
  margin: 0 0 28px;
  border-radius: 28px;
  background: var(--heat);
  color: #FFFFFF;
  box-shadow: var(--shadow-lift);
}
.hero-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-position: center;
  background-size: cover;
  mix-blend-mode: multiply;
  opacity: .55;
  pointer-events: none;
}
.hero-copy { position: relative; z-index: 1; max-width: 720px; padding: 28px; }
.hero-copy > :last-child { margin-bottom: 0; }
.hero h1, .hero h2, .hero .page-title {
  margin: 0 0 10px;
  color: #FFFFFF;
  font-family: var(--font-display);
  font-size: clamp(26px, 3vw, 38px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -.02em;
}
.hero p, .hero .page-sub { max-width: 60ch; margin: 0 0 14px; color: rgba(255, 255, 255, .94); font-size: 15px; line-height: 1.55; }
.hero .eyebrow { color: #FFF3D9; }
.hero .eyebrow::before { background: var(--lime); box-shadow: 0 0 0 3px rgba(198, 242, 78, .2); }
.hero a { color: #FFFFFF; }
.hero .chip { background: rgba(255, 255, 255, .16); border-color: rgba(255, 255, 255, .4); color: #FFFFFF; }
.hero .btn-primary { background: #FFFFFF; color: var(--ink); box-shadow: 0 16px 30px -18px rgba(60, 20, 0, .6); }
.hero .btn-primary:hover { background: #FFF3E6; color: var(--ink); }
.hero .btn-ghost, .hero button.quiet { background: rgba(255, 255, 255, .12); border-color: rgba(255, 255, 255, .55); color: #FFFFFF; }
.hero .btn-ghost:hover, .hero button.quiet:hover { background: rgba(255, 255, 255, .22); color: #FFFFFF; }

/* Stats and cards -------------------------------------------------------- */

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 0 0 22px; }
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow);
}
.stat::before { content: ""; width: 26px; height: 4px; margin-bottom: 10px; border-radius: 999px; background: var(--heat); }
.stat-value {
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -.02em;
  font-variant-numeric: tabular-nums;
}
.stat-label { color: var(--muted); font-size: 12px; font-weight: 700; line-height: 1.4; letter-spacing: .08em; text-transform: uppercase; }

.card {
  margin: 0 0 20px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}
.card > :last-child { margin-bottom: 0; }
.card h2 {
  margin: 0 0 12px;
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -.01em;
}
.card h3 {
  margin: 0 0 8px;
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
  letter-spacing: .14em;
  text-transform: uppercase;
}
.card.narrow { max-width: 420px; margin: 56px auto; padding: 28px; }
.card.stack { display: grid; gap: 14px; }

/* Buttons ---------------------------------------------------------------- */

.btn, .btn-primary, .btn-ghost, button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 20px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, border-color .18s ease;
}
.btn-primary, button:not(.quiet):not(.btn-ghost) {
  border-color: transparent;
  background: var(--heat);
  color: #FFFFFF;
  box-shadow: 0 14px 28px -16px rgba(255, 90, 31, .75);
}
.btn-primary:hover, button:not(.quiet):not(.btn-ghost):hover {
  transform: translateY(-1px);
  box-shadow: 0 20px 34px -18px rgba(255, 90, 31, .85);
}
.btn-ghost, .btn.btn-ghost, button.quiet {
  border-color: var(--line);
  background: transparent;
  color: var(--ink-2);
  box-shadow: none;
}
.btn-ghost:hover, .btn.btn-ghost:hover, button.quiet:hover { transform: translateY(-1px); background: var(--wash); color: var(--ink); box-shadow: none; }
.btn:active, button:active { transform: translateY(0); }
.btn[disabled], button[disabled], .btn[aria-disabled="true"] { opacity: .45; cursor: not-allowed; transform: none; box-shadow: none; }
.inline { display: inline-flex; align-items: center; margin: 0; }

/* Forms ------------------------------------------------------------------ */

.field { display: grid; gap: 6px; }
.stack { display: grid; gap: 14px; }
fieldset { display: grid; gap: 8px; min-width: 0; margin: 0; padding: 0; border: 0; }
legend { margin: 0 0 8px; padding: 0; color: var(--ink); font-family: var(--font-display); font-size: 15px; font-weight: 700; line-height: 1.3; }
label { color: var(--ink-2); font-size: 13px; font-weight: 600; line-height: 1.4; }

.choice {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease;
}
.choice:hover { background: var(--wash); border-color: #E8CDB6; }
.choice input { flex: none; width: 18px; height: 18px; margin: 0; accent-color: var(--ember); }
.choice small, .choice .muted { display: block; margin: 0; color: var(--muted); font-size: 12px; font-weight: 500; line-height: 1.45; }

input[type="text"], input[type="password"], input[type="number"], input[type="date"],
input[type="email"], input[type="search"], input:not([type]), select, textarea {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.4;
  box-shadow: inset 0 1px 0 rgba(90, 40, 10, .02);
  transition: border-color .18s ease, box-shadow .18s ease;
}
select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 36px;
  background-image:
    linear-gradient(45deg, transparent 50%, var(--muted) 50%),
    linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 19px) 50%, calc(100% - 14px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}
textarea { min-height: 96px; resize: vertical; line-height: 1.55; }
input:hover, select:hover, textarea:hover { border-color: #E3C6AE; }
input:focus, select:focus, textarea:focus { border-color: var(--ember); outline: 0; box-shadow: 0 0 0 3px rgba(255, 90, 31, .16); }
input::placeholder, textarea::placeholder { color: #A99584; }
input[type="range"] { width: 100%; min-height: 32px; padding: 0; border: 0; background: transparent; accent-color: var(--ember); box-shadow: none; }
input[type="checkbox"], input[type="radio"] { width: 18px; height: 18px; min-height: 0; margin: 0; padding: 0; accent-color: var(--ember); box-shadow: none; }

/* Chips, notes, status --------------------------------------------------- */

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--wash);
  color: var(--ink-2);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
  text-decoration: none;
}
a.chip:hover { border-color: #E3C6AE; background: #FFE9D6; color: var(--ink); }
.chip.done { border-color: rgba(31, 122, 77, .28); background: #EAF7EF; color: var(--success); }
.chip.quiet { border-color: var(--line); background: transparent; color: var(--muted); }
.chip.adjusted { display: inline-flex; margin: 10px 0 0; }

.note { margin: 8px 0 0; padding-left: 12px; border-left: 3px solid var(--solar); color: var(--ink-2); font-size: 14px; line-height: 1.55; }
.muted { margin: 0 0 10px; color: var(--muted); font-size: 14px; line-height: 1.55; }
.error {
  margin: 10px 0;
  padding: 10px 14px;
  border: 1px solid rgba(192, 58, 43, .26);
  border-radius: 12px;
  background: #FCEDEA;
  color: var(--danger);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
}

/* Lists and tables ------------------------------------------------------- */

.week { margin: 0; padding: 0; list-style: none; }
.row { padding: 12px 10px; border-top: 1px solid var(--line); border-radius: 12px; transition: background .18s ease; }
.week > .row:first-child { border-top: 0; }
.row:hover { background: var(--wash); }
.row.today { background: #FFF0E2; box-shadow: inset 3px 0 0 var(--ember); }
.row .chip { margin-top: 4px; }
.row-link {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 6px;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
}
.row-link:hover { color: inherit; }
.row-link:focus-visible { outline-offset: 0; }
.row-link .chip { justify-self: start; }
.row-link .session { justify-self: end; text-align: right; }
.day { color: var(--ink); font-family: var(--font-display); font-size: 15px; font-weight: 700; line-height: 1.25; }
.session { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; line-height: 1.4; }

.table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; line-height: 1.45; }
.table th { padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--wash); color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .12em; text-align: left; text-transform: uppercase; }
.table th:first-child { border-top-left-radius: 12px; }
.table th:last-child { border-top-right-radius: 12px; }
.table td { padding: 12px; border-bottom: 1px solid var(--line); color: var(--ink-2); vertical-align: middle; }
.table tbody tr:hover td { background: var(--wash); }
.table td:last-child, .table th:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.table tr:last-child td { border-bottom: 0; }

/* Period navigation and totals ------------------------------------------ */

.period-nav { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 6px 0 16px; }
.period-nav a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  transition: background .18s ease, color .18s ease, border-color .18s ease;
}
.period-nav a:hover { background: var(--wash); border-color: #E3C6AE; color: var(--ink); }
.period-nav a.chip { border-radius: 999px; }
.period-nav label { font-size: 13px; font-weight: 700; }
.period-nav input[type="date"] { width: auto; min-width: 170px; }
.totals { margin: 4px 0 0; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }

/* Week grid -------------------------------------------------------------- */

.week-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.day-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 104px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  box-shadow: 0 10px 22px -20px rgba(90, 40, 10, .5);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
}
.day-card:hover { transform: translateY(-2px); border-color: #E3C6AE; box-shadow: var(--shadow); color: inherit; }
.day-card .date { display: flex; align-items: baseline; gap: 6px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.day-card .date b { color: var(--ink); font-family: var(--font-display); font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
.day-card .session { color: var(--ink); font-size: 13px; font-weight: 600; line-height: 1.35; }
.day-card .chip { align-self: flex-start; margin-top: auto; }
.day-card .note { margin: 2px 0 0; padding-left: 8px; border-left-width: 2px; font-size: 12px; line-height: 1.45; }
.day-card.today { border-color: var(--ember); box-shadow: 0 0 0 3px rgba(255, 90, 31, .16), var(--shadow); }
.day-card.today .date b { color: var(--ember); }
.day-card.logged { background: linear-gradient(180deg, #FFF9F2 0%, var(--surface) 100%); }

/* Month grid ------------------------------------------------------------- */

.month-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.month-grid .dow {
  padding: 4px 2px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: .12em;
  text-align: center;
  text-transform: uppercase;
}
.month-day {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-height: 68px;
  padding: 7px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  color: inherit;
  font-size: 12px;
  line-height: 1.35;
  text-decoration: none;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease;
}
.month-day:hover { transform: translateY(-1px); border-color: #E3C6AE; background: var(--wash); color: inherit; }
.month-day .num { color: var(--ink); font-family: var(--font-display); font-size: 15px; font-weight: 800; line-height: 1.1; }
.month-day .session { overflow: hidden; color: var(--muted); font-size: 10px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.month-day.today { border-color: var(--ember); box-shadow: 0 0 0 2px rgba(255, 90, 31, .16); }
.month-day.pad { opacity: .45; }
.dot { width: 8px; height: 8px; margin-top: auto; border-radius: 50%; background: var(--line); }
.dot.done { background: var(--success); }
.dot.missed { background: var(--danger); }
.dot.rest { background: #B7A493; }

/* Mobile bar ------------------------------------------------------------- */

.coach-photo { max-width: 180px; max-height: 180px; border-radius: 12px; border: 1px solid var(--line); object-fit: cover; }
.coach-message .note { white-space: pre-wrap; }

.tabs { display: none; }

@media (max-width: 1100px) {
  .app-shell { grid-template-columns: 232px minmax(0, 1fr); }
  .sidebar { width: 232px; padding: 20px 14px 16px; }
  .main { padding: 26px; }
}

@media (max-width: 900px) {
  .app-shell { display: block; }
  .sidebar { display: none; }
  .app-shell > :not(.sidebar) { grid-column: auto; }
  .topbar { padding: 10px 18px; }
  .topbar-brand { display: block; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
  .topbar-title { font-size: 16px; }
  .topbar-actions .btn { min-height: 38px; padding: 0 14px; font-size: 13px; }
  .main { padding: 18px 18px 96px; }
  .main-auth { padding: 40px 18px; }
  .tabs {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 60;
    display: flex;
    gap: 2px;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line);
    background: rgba(255, 248, 240, .92);
    -webkit-backdrop-filter: blur(18px) saturate(1.2);
    backdrop-filter: blur(18px) saturate(1.2);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs a {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    min-width: 64px;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
  }
  .tabs a:hover, .tabs a:focus-visible { background: var(--wash); color: var(--ink); }
  .page-title { font-size: clamp(28px, 6vw, 38px); }
  .hero { min-height: 190px; border-radius: 22px; }
  .hero-copy { padding: 22px; }
  .week-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .month-day { min-height: 58px; padding: 5px; }
  .month-day .session { display: none; }
}

@media (max-width: 640px) {
  .main { padding: 14px 14px 92px; }
  .card { padding: 18px; border-radius: 16px; }
  .page-sub { font-size: 15px; }
  .stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .stat-value { font-size: 24px; }
  .period-nav a { min-height: 38px; padding: 0 12px; font-size: 12px; }
  .row-link { grid-template-columns: 4.5rem minmax(0, 1fr); }
  .row-link .chip { grid-column: 2; justify-self: start; }
}

@media (max-width: 380px) {
  .month-grid { gap: 3px; }
  .month-day { min-height: 50px; padding: 4px; border-radius: 9px; }
  .month-day .num { font-size: 13px; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; scroll-behavior: auto !important; }
}

@media print {
  .sidebar, .topbar, .tabs, .period-nav, .btn, button { display: none !important; }
  body { background: #FFFFFF; }
  .card { box-shadow: none; border-color: #CCCCCC; }
  .main { max-width: none; padding: 0; }
}
`;
