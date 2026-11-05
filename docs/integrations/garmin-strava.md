# Garmin and Strava integration — what the official docs say, and what this product would need

Researched on **2026-11-05** from the vendors' own developer pages. The web-search provider was unavailable in this
session, so "latest this week" could not be checked against changelogs; what follows is what the official pages actually
returned, and the gaps are stated rather than filled.

## Strava — API v3 (verified from developers.strava.com)

Sources:
- [API and SDK reference](https://developers.strava.com/docs/reference/)
- [Authentication](https://developers.strava.com/docs/authentication/)

| Fact | Detail |
|---|---|
| Protocol | OAuth2, three-legged; app registered for a client ID + secret |
| Web authorize | `GET https://www.strava.com/oauth/authorize` |
| Mobile authorize | `GET https://www.strava.com/oauth/mobile/authorize` (Android intent / iOS `ASWebAuthenticationSession`; app v75+ for mobile OAuth; falls back to web when the app is absent) |
| Token exchange | `POST https://www.strava.com/oauth/token` with `client_id`, `client_secret`, `code`, `grant_type=authorization_code` |
| Tokens | short-lived **access token** (6 h) + **refresh token**; refresh rotates the refresh token, so persist the newest one |
| Scopes | `read`, `read_all`, `profile:read_all`, `profile:write`, `activity:read`, `activity:read_all`, `activity:write` |
| Activities | `GET /api/v3/athlete/activities?before=&after=&page=&per_page=`; `GET /api/v3/activities/{id}` |
| Uploads | `POST /api/v3/uploads` (activity upload) — the path for importing a `.fit`/`.tcx` |
| Webhooks | supported (per docs index); `activity:read` is required for activity webhooks |
| Deauthorization | legacy `POST https://www.strava.com/oauth/deauthorize`; **from 2026-06-01** apps may use `POST https://www.strava.com/oauth/revoke` (HTTP Basic client credentials), recommended, and the only supported endpoint from **2027-06-01** |
| Rate limits | documented on the separate rate-limits page; not fetched here |

What this product would use: `activity:read` (list runs), then `GET /activities/{id}` for distance/time/pace; uploads
only if the planner ever pushes a session to Strava, which would need `activity:write` and is a separate consent.

## Garmin — Connect Developer Program (verified from developer.garmin.com via a text proxy)

Source: [Garmin Connect Developer Program — overview](https://developer.garmin.com/gc-developer-program/) (fetched via
`https://r.jina.ai/` because the direct page returned an empty body / unsupported content type in this session).

| Tier | Access | Delivery | Historical | Capacity |
|---|---|---|---|---|
| **Personal** | own Garmin Connect data, personal API key/token from the Garmin Connect website | pull only | — | one person |
| **Business — Starter** | Activity, Courses, Health, Training, Women's Health APIs | **push only** | not included | limited |
| **Business — Enterprise** | same APIs + Golf | push or ping/pull | 1 month + | unlimited |

What this product would use: the **Personal** tier is enough to read one runner's own activity/health JSON for a local
or single-user deployment; a multi-runner product needs **Starter/Enterprise** approval and a push webhook endpoint, which
means a public HTTPS endpoint and a Garmin-issued application — i.e. a deployment decision, not a library choice.

Garmin also publishes Connect IQ (watch-app SDK) and a Health API; those pages returned empty/unsupported content in
this session, so no claim is made here about their current SDK versions.

## The honest gap

- **"Latest SDK this week" is not established.** The search provider had no API key and the vendor pages do not publish
  a dated changelog on the pages that were fetchable. Treat the tables above as *current documented shapes*, not as a
  verified "this week" diff.
- No OAuth application has been registered with either vendor, and no client ID/secret exists in this repository.

## What integration would require (and what is buildable without credentials)

| Piece | Needs |
|---|---|
| Strava OAuth connect/callback routes, token storage (encrypted), refresh rotation, `activity:read` fetch, deauthorize/revoke | **client ID + secret**, a public callback URL, and a consent screen; the routes can be written and tested against a fake, but not used |
| Garmin Personal API token import | the runner's own token (they can generate it); a single-user local build can use it |
| Garmin Starter/Enterprise | **program approval** + push endpoint + app credentials |
| Activity ingestion → `DayEntry` mapping | buildable now: map distance/time/pace/HR to an entry draft, with the same validation the manual form uses |
| Per-user isolation for tokens | the same rule as health data: tokens are health-adjacent secrets, stored per user, never in logs |

A safe first slice is **import-only, read-only, consent-gated**: Strava `activity:read` or a Garmin personal token, map a
run to a day entry, never write back to the vendor, and never let a sync overwrite a past day (AGENTS rule 4).
