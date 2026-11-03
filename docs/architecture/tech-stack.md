---
status: draft
last_reviewed: 2026-11-03
---

# Tech stack

Constraint that decides everything else: **the planner must be pure, deterministic, and testable in
isolation from the web tier.** So: one language, strict types, a workspace where the brain is a
dependency of the app rather than a folder inside it.

| Layer | Choice | Why this, and what it would cost to choose otherwise |
|---|---|---|
| Language / runtime | TypeScript on Node 22 LTS | One type system across planner, API, and UI; planner-core stays testable without a browser. Alternative (Python planner + TS UI) buys scientific libraries we don't need in v1 and costs a second build/test/deploy pipeline plus a serialization boundary between rules and numbers. |
| Repo | pnpm workspace monorepo (`apps/*`, `packages/*`) | `planner-core` and `domain` are imported directly; one lockfile, one CI, atomic changes across a rule and its test. |
| Frontend | Next.js (App Router) + React | SSR for a fast calendar shell, route-level code splitting, streaming the week grid. Self-hostable (no vendor lock). |
| Styling / components | Tailwind + shadcn/ui (owned copies, not a black-box kit) | Copy-in components we can bend for a dense calendar; no runtime dependency on a design system we can't edit. |
| Calendar | **Custom month/week grid** (`packages`-local components) over FullCalendar | The day cell is the product: session structure, feedback state, comment badge, safety chip, diff overlay. Off-the-shelf calendars fight that. Cost: we own layout, a11y and drag-drop. |
| Server API | Fastify + zod schemas from `packages/domain` | Typed routes, fast, JSON-schema generation for free, framework-independent so the same handlers can run as CLI/worker entry points. |
| DB | Postgres 16 + Drizzle ORM (SQL-first migrations) | RLS is the tenancy mechanism ([ADR-0002](../adr/0002-single-db-row-level-security.md)) — this rules out ORMs that hide or pool connections in ways that make per-request `SET LOCAL` unreliable. SQL-first keeps the migrations reviewable. |
| Cache / queue | Redis + BullMQ | Generation, import sync, notifications, nightly rollups. BullMQ gives per-user rate limiting, repeatable jobs (perfect for per-timezone schedules), and stalled-job recovery. |
| Auth | Auth.js: magic link + Google/Apple | Low-friction, passwordless, supports 16+ minors flows and per-user deletion. Self-hosted, so no third-party identity silo on health data. |
| Validation | zod everywhere; JSON Schemas published in `schemas/json` | One definition of every contract; `packages/domain` and the documented schemas stay in sync via generation, not copy-paste. |
| Testing | Vitest (unit, golden plans, property tests via `fast-check`), Playwright (calendar + entry + review flows), Drizzle schema/RLS tests | Golden plans and property tests are the *specification* of the planner; RLS tests are the specification of isolation. |
| LLM | Provider-agnostic adapter behind an interface; template path always available | The narrator is enrichment; the fallback is a first-class feature. Keeps a vendor swap to one file and keeps offline/free tiers working. |
| i18n | next-intl, catalogues in `apps/web/messages/{en,zh-Hant}.json` | Traditional Chinese is a launch requirement, not a translation task; ICU pluralisation for km/min and a CJK tone register
  ([feedback-microcopy.md](../ux/feedback-microcopy.md)). |
| Observability | OpenTelemetry traces + structured logs; per-user job trace ids; product metrics in a metrics store | "Why did the plan change?" must be answerable from data, not from memory. |
| Deploy | Docker Compose (dev), one app container + one worker container + managed Postgres/Redis (Fly.io or Railway) | Two long-running processes only; the planner runs in the worker. Managed Postgres because backups/point-in-time recovery are a product requirement here, not ops trivia. |
| CI | GitHub Actions: typecheck, unit+golden+property, RLS suite, Playwright, knowledge-bundle build, link/`last_reviewed` lint | The knowledge lint is a CI job so the knowledge base cannot silently rot ([MAINTENANCE.md](../../knowledge/MAINTENANCE.md)). |

## Deliberately not chosen

- **A rules engine framework (Drools/JsonLogic/CEL).** Our rules need domain concepts, clamped
  ranges, provenance and unit tests in the same file as the planner. A YAML data file *interpreted by
  typed TypeScript functions* keeps that, and the YAML stays reviewable by a coach who never writes
  code. Frameworks would add a second language and a debugging wall.
- **A time-series DB / warehouse for activities.** Volume is ~1–2 activities per user per day.
  Postgres with partitioned `events` and materialised rollups is correct for years. Revisit at
  ~10⁷ activity rows, not before.
- **Serverless functions for generation.** Long CPU-bound plan builds, per-user rate limiting, and
  BullMQ-style scheduling fit a persistent worker better; cold starts on a hot path that must answer
  in 2 s is the wrong trade.
- **Microservices.** One API, one worker, one DB. The seams are already package boundaries
  (`planner-core`, `domain`), so a future split is a packaging change, not a rewrite.
- **Client-only local-first (no server).** Attractive for privacy, but per-user sync across devices,
  coach grants, server-side review triggers and scheduled regeneration need a server of record. We
  keep the *entry form* offline-capable instead, which is where offline actually matters.

## Versioning policy
Semver on `packages/planner-core` and on the knowledge bundle; both are stamped on every plan version
(`plannerVersion`, `knowledgeHash`). A user-visible plan change from a rule fix is a *patch* to them
and a *minor* to us, and appears in the weekly summary as "the planner changed: …" — never silently.
