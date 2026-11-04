# apps/web

The per-user web client: the week, the day drawer, and the entry form. Server-rendered HTML, one stylesheet,
no SPA framework (ADR-0008).

```bash
API_TOKENS='{"dev-token":"<user-uuid>"}' PORT=8081 npx tsx apps/web/src/index.ts
```

Screens and their states: `docs/ux/screens.md`; navigation: `docs/ux/information-architecture.md`; exact
wording including the escalation text: `docs/ux/feedback-microcopy.md`.

## The three pages

| Route | What it is |
|---|---|
| `GET /login`, `POST /login` | a token form that sets an `HttpOnly; SameSite=Lax` session cookie |
| `GET /` | the current Monday–Sunday week: session kind and distance per day, a logged/not-logged chip, and the plan's first explanation sentence |
| `GET /day/:day`, `POST /day/:day` | the drawer: five outcomes, effort, legs, an optional note, a "why" row for a skipped day, and the coach note after saving |

A form post is the whole interaction. The server builds the **same `EntryDraft` a JSON client would** and runs the
same entry pipeline, so there is one write path, not one per client.

## Rules this client keeps

- **No screen invents a number.** The coach note is `packages/narrator`'s output, inserted verbatim (escaped);
  the explanation sentence is the same function the CLI uses; the session text is the plan's own distance.
- **Every string is a catalogue string.** The page labels live in `packages/i18n` under `web.*`, in both
  languages, and a missing key is a compile error.
- **A gap is an invitation, not an error.** A day outside the plan still opens; a missing entry is a faint
  "Not logged yet", never a broken streak.
- **The double-submit is safe.** The form carries an idempotency key derived from (user, day, next revision), so
  submitting the same form twice returns the stored row instead of writing a second one.
- **A skipped day states its reason or is refused.** `OutcomeDetail` is a closed enum; the client will not
  invent a reason the runner did not give.
- **Escaping is applied at every insertion site** — a note is free text and the comment is generated text, and
  both are rendered back into markup.
- **No weight, no calorie, no diagnosis, no streak** (AGENTS rule 6; `docs/ux/feedback-microcopy.md`).
- **A review shows "keep as is" first with a visible diff and a stated cost.** The review sheet is not built
  yet, and when it is, the ordering is a rule of `packages/review`, not a layout choice.

## The offline queue

`public/queue.js` is loaded on every page and intercepts the entry form when `navigator.onLine` is false. The
draft is stored in IndexedDB under its idempotency key, the page shows the catalogue's "saved on this device"
copy, and on `online` the script replays each draft with `source=offline-queue`.

The **rules** are not in that script: `packages/offline` owns them (idempotent enqueue, no replay while offline,
a failure keeps the draft, abandonment is a state not a deletion) and is tested without a browser. The script is
the plumbing, and it is deliberately thin enough that there is little policy to get wrong. Its DOM and IndexedDB
behaviour is **not covered by unit tests** — there is no jsdom in the repository — so it is verified by
inspection and by the wire tests that prove the server accepts and records a replay.

## What is not built yet

- **The calendar month grid, swipe navigation, keyboard shortcuts, the review sheet.** `docs/ux/screens.md` owns
  those; this slice is the loop, not the whole surface.
- **Real authentication.** `createMemorySessions` maps tokens to users for development and tests.
