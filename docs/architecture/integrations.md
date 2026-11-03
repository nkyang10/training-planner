---
status: draft
last_reviewed: 2026-11-03
---

# Integrations: what we can actually build on

**Design posture: manual-first, import-as-enrichment.** The loop (plan → log → comment → review)
must work with zero connected devices. This is not laziness — it is the only posture that survives
the access reality below, and it is also the honest one: the highest-value signals in this product
(RPE, legs, pain, sleep, why a session was missed) are *not on the watch*.

## Verified constraint: Strava (checked 2026-11-03)

From [Strava developer docs](https://developers.strava.com/docs/getting-started/):

- Creating an app **requires a paid Strava subscription**.
- New apps start in **single-player mode**: only the developer's own account can authorise. You build
  and test against your own data first.
- After configuration you can self-upgrade to a tier of **10 connected athletes**, with
  **200 requests / 15 min and 2,000 requests / day** read limits (400/4,000 overall).
- Beyond 10 athletes you must **submit the app for review** — a real gate between "works for me and
  my running club" and "a product".
- A **webhook endpoint is required by the API terms** (deauthorisation + activity create/update), so
  a public HTTPS callback is not optional.
- The API does not expose arbitrary athletes' data; only OAuth-authorised users.

Consequences we design for:

1. Strava is a **v1.5 enrichment**, not the foundation; the app is demoable, sellable, and testable
   without it.
2. Sync is **pull-on-open + webhook-driven**, with a per-user token bucket well under the documented
   limits (batch: fetch only athletes with a session today or a pending sync).
3. Deauth webhook must actually delete/stop-sync — implement it as a real feature, day one of the
   integration.
4. The 10-athlete ceiling means the pre-launch cohort is *literally* a running club; design the
   waitlist and the migration path (manual import meanwhile) around that.

## Unverified: Garmin (must re-check before any milestone that needs it)

`developer.garmin.com/connect-iq/` returned empty content and `developers.garmin.com` did not resolve
from the research environment on 2026-11-03. Working assumption: **gated / business-approval
required**, with the Health API aimed at device manufacturers. Third-party unofficial libraries exist
but carry ToS and breakage risk and are not an option for a paid product holding health data.
Tracked as [PROD-S2](../../knowledge/sources/bibliography.md) with `grade D — unverified`. **No
feature may be planned that requires Garmin.** Re-verify with a direct enquiry, not a blog post.

| Source | Realistic for a small team today | Value here | Notes |
|---|---|---|---|
| Manual entry / GPX-CSV import | ✅ day one | high | also the accessibility fallback |
| Strava | ✅ up to 10 users, then review | high (activities, HR, pace) | read-only in v1 |
| Apple Health (via a companion iOS app) | ⚠️ requires an app we build and maintain | medium (sleep, HRV, resting HR) | export is user-initiated |
| Withings / Oura / Whoop / Polar / Coros | varies, mostly partner or approval-gated | medium | check individually; assume no |
| Garmin | ❓ unverified, assume gated | high | do not plan on it |
| Workout **write-back** to a watch | ❌ v1 | — | every vendor gates it; biggest scope trap here |

## Import architecture (so vendors cannot hurt us)

```
provider SDK/HTTP → normaliser → ActivityObserved event {provenance, provider, rawHash}
                                → identity matcher → DayLink (planned session ↔ activity)
```

- **Idempotent** ingestion keyed on `(provider, provider_activity_id, revision)`; provider token
  refresh handled centrally with per-user failure isolation (one user's dead token cannot stall the
  queue).
- **Identity matching is explicit and reviewable**: date proximity + session kind + duration/HR
  plausibility ⇒ `autoLinked | suggested | manual`. When ambiguous the UI asks once. A wrongly
  linked run poisons adherence, `rpeGap`, and every comment derived from it, so the default is
  "ask", not "guess".
- **Provenance is preserved forever**: an easy run typed in and an easy run imported from Strava are
  different evidence strengths, and metrics may weight them differently — but the user must always
  see which is which.
- **Absence is meaningful and stated**: a runner with no device gets comments and reviews built on
  RPE-only evidence, and the review screen says *"this review has no HR evidence; confidence:
  medium"*. That sentence is a feature.

## Notification channels
Email (transactional + weekly summary) and Web Push in v1; SMS/WhatsApp later where legally clean.
Every notification is generated from the current effective plan (safety cancellations respected), is
timezone-local, has a per-user frequency budget, and a one-tap "stop these".

## Failure handling summary
Provider down → UI shows last-known data with an age stamp; entry/comment/review paths unaffected.
Provider schema drift → normaliser tests with recorded fixtures per provider; unknown fields pass
through into `rawJson` rather than crashing. Rate limit → adaptive backoff + per-user fairness queue.
