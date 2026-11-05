# Strava app setup — what the runner-visible "Link Strava" button needs

The web app can show a Strava card today, but it cannot complete a real link until an OAuth application exists. This note
records exactly what must be created, from the vendor's own authentication page
([developers.strava.com/docs/authentication](https://developers.strava.com/docs/authentication/)) fetched 2026-11-05.

## What to create

1. Register an application at <https://www.strava.com/settings/api>.
2. Set **Authorization Callback Domain** to the domain that will receive the redirect. `localhost` and `127.0.0.1` are
   white-listed by Strava, so a local test can use `http://localhost:8082/connections/strava/callback`; a deployment needs
   its real HTTPS domain.
3. Copy the **client ID** and **client secret** into the process environment:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `STRAVA_REDIRECT_URI` (must be inside the callback domain)
4. Request only the scopes the product uses. For read-only import: **`activity:read`** (and `activity:read_all` only if
   the runner wants "Only Me" activities). Writing back to Strava would need `activity:write` and is a separate consent.

## The flow the app implements

```
GET /connections/strava/start
  -> 503 strava-not-configured when the three variables are absent (honest, no fake redirect)
  -> otherwise returns { authorizeUrl } for https://www.strava.com/oauth/authorize
     ?client_id=...&redirect_uri=...&response_type=code&approval_prompt=auto&scope=activity:read&state=...

GET /connections/strava/callback?code=...&state=...
  -> 501 strava-callback-not-implemented until a state store exists (a callback without CSRF state is not a link)
  -> with code + state + env: POST https://www.strava.com/oauth/token
     (client_id, client_secret, code, grant_type=authorization_code)
  -> store the connection, keep the refresh token in a deployment secret store, never in the repository
```

## Token facts that shape the code

| Fact | Consequence |
|---|---|
| Access tokens expire after **6 hours** | refresh before use; the refresh call rotates the refresh token, so persist the newest one |
| Refresh tokens can change on every refresh | a token column must be updated atomically with the new value |
| `scope` in the token response is space-delimited and may be **narrower** than requested | store the granted scope and show it; do not assume `activity:read_all` |
| Deauthorization: `POST https://www.strava.com/oauth/revoke` from **2026-06-01** (HTTP Basic with client credentials); the only supported endpoint from **2027-06-01** | implement revoke, not just local disconnect |
| Rate limits are documented separately | the sync route must be manual or scheduled, not a tight loop |

## What is deliberately not built

- No callback state store, so `/connections/strava/callback` answers `501` instead of accepting a code it cannot bind to a
  runner.
- No token persistence: the connection record stores `credentialRef` (e.g. `env:STRAVA_REFRESH_TOKEN`), not a token.
  A real deployment needs a secret store (KMS/Vault/keyring) and a documented rotation story.
- No Strava sync: `/connections/strava/sync` answers `503 strava-not-configured`.

These are the same boundaries the code states; nothing here is implied to work.
