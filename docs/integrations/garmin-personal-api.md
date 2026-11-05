# Garmin Connect Personal API — what was verified live (2026-11-05)

The web app's Garmin card uses the **Personal API**, the self-service tier for one runner's own data. This note records
what was actually observed, so the code and the docs cannot drift.

## Credential shape

A Personal API key is created at <https://connect.garmin.com/app/settings/personalApiToken> (Create Key → accept terms →
choose 30/90/180/365-day expiry → copy once). The key is displayed **once**; it is a password. It is exchanged for a
short-lived access token; the key itself is never sent to data endpoints.

## Verified live calls

| Step | Request | Observed |
|---|---|---|
| Token | `POST https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token` with `Authorization: ApiKey <key>` | `200`, body is a JWT (~1141 chars), 24 h lifetime, scopes include `CONNECT_READ`, `PERSONAL_API_FITNESS_READ`, `PERSONAL_API_USER_READ`, `PERSONAL_API_WELLNESS_READ` |
| Profile | `GET https://personal.connectapi.garmin.com/userprofile-service/userprofile/settings` with `Authorization: Bearer <token>` | `200`, `displayName` present, metric units, locale `zh_TW` |
| Activities | `GET .../activitylist-service/activities/search/activities?start=0&limit=5` | `200`, array with `activityId`, `activityType.typeKey`, `distance` (metres), `duration` (seconds), `startTimeLocal` (`YYYY-MM-DD HH:mm:ss`) |
| Steps | `GET .../usersummary-service/stats/steps/daily/2026-11-01/2026-11-05` | `200`, array of `{calendarDate, totalSteps, totalDistance, stepGoal}` |

No refresh token: the key is re-exchanged when a token is needed (Garmin FAQ says the same). The key expires by design
(30/90/180/365 days), so a deployment must tell the runner to rotate it.

## What the code does with it

- `POST /connections/garmin/token` exchanges a pasted key (or `GARMIN_PERSONAL_API_KEY`) for a token, reads the profile,
  and stores a **connection record** with `credentialRef: "env:GARMIN_PERSONAL_API_KEY"` and `hasCredential: true`. The
  token and key are never returned or logged.
- `POST /connections/garmin/sync` re-exchanges the key, lists activities, filters them to the requested day range
  **client-side** (the personal tier's date query parameters are not documented on the fetchable pages, so the range is
  applied where it is testable), maps each completed run with distance > 0 to a day entry through the same `submitEntry`
  pipeline the manual form uses, and appends it. A zero-distance activity (indoor cardio) is counted as skipped.
- Idempotency: `garmin:<activityId>` makes a repeated sync a duplicate, not a second entry.

## What it does not do

- No write-back to Garmin (no upload, no workout push). The personal tier is read-only here.
- No token persistence: a real multi-user deployment needs a secret store and per-user token rows; this build keeps the
  key in the process environment (single-user local deployment).
- No automatic/scheduled sync: the runner presses "Sync now". A scheduler would need rate-limit and consent decisions.
- No health interpretation: steps/HRV/sleep are not used to change a plan; the planner remains deterministic and the
  safety layer subtract-only.
