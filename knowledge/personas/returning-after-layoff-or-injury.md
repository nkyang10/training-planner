---
id: personas/returning-after-layoff-or-injury
title: "Persona — returning after a layoff or injury"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S7, PLAN-S2]
---

**Key takeaways**

1. The defining asymmetry: **cardiovascular fitness returns faster than musculoskeletal tolerance**.
  The plan is governed by tissue, never by feel.
2. The user's memory of past pace is the main hazard. Reference paces from the pre-layoff self are
  deleted from active use and replaced by current-effort paces.
3. Return speed is set by **days off and by what the rest was for**, in bands — not by optimism.
4. The first 2–4 weeks are Z1-only with walk breaks allowed; the first quality session is a hill or
  strides, never a track interval.
5. This persona's biggest risk is not a slow return but a **relapse at week 6**, when the plan finally
  feels normal.

## Facts

- Load-related training errors are the most-studied modifiable injury exposure in running, with
  inconsistent effect estimates and no validated threshold; "returning to prior load too quickly" is
  the pattern reviews point at rather than any single number. [PLAN-S7 grade A review, confidence
  medium]
- No verified trial defines a return-to-running protocol after a layoff; the bands below are
  practitioner consensus plus the load-progression guardrails in
  `plan-construction/mileage-and-progression.md`. [grade C, confidence low]
- Detraining literature is not represented by a verified source in this knowledge base yet; therefore
  no "you lose X% per week" claim may appear anywhere in the product. [Gap]

## Practice

### Return bands (starting volume = % of the last *completed* normal week before the break)

| Time off | Was it for | Week 1 | Weeks 1–2 | Cycle | First quality |
|---|---|---|---|---|---|
| ≤ 7 days | illness/life | 90–100% | normal progression | 3:1 | unchanged |
| 8–21 days | minor illness/life | 70–80% | Z1 only in week 1 | 3:1 | week 3 |
| 3–8 weeks | overuse, illness | 50–60% | Z1 only, walk breaks allowed | 2:1 | week 4–5 |
| 3–6 months | significant injury/surgery | 30–40% or time-based 20–30 min | Z1 only 3–4 weeks | 2:1 | week 6+ |
| > 6 months, or any rest with a gait change | — | treat as new runner | run/walk from 20 min | 2:1 | week 8+ |

- Percentage applies to **time on feet**, and only one variable rises per week.
- The engine must ask what the clinician said (if anything) and what the discharge criteria were; "I
  was told to rest" is not a plan input, but "I was told I could resume walking pain-free" is a
  permission signal for week 1.

### Return-session rules

- Every session Z1 for the first 2–4 weeks, defined by talk test + easy pace band, not by HR (HR is
  unreliable post-illness and post-deconditioning).
- Walk breaks are programmed and non-shameful: "6 × 4 min run / 60 s walk" is a session, not a failure.
- First intensity exposure: 4–6 × 20 s strides on grass, or 6 × 45 s gentle hills. Both are
  low-fatigue, high-signal, and reveal the injured tissue's response within 24 h.
- Frequency ceiling: 3 days/wk until 4 consecutive weeks are completed at ≥ 85% with no pain reports.
- Cross-training is a legitimate substitute, not a consolation prize: bike/swim/elliptical maintains
  the aerobic stimulus where impact is the limiting factor. See `workout-library/cross-training.md`.

## Controversies

- **Pain during running: stop or monitor?** Practitioners split on a 0–3/10 "acceptable" threshold for
  tendon-type discomfort versus muscle-type. This product takes the conservative line: any pain that
  changes gait or is rising week over week stops progression and triggers a clinician-referral message.
  No diagnosis, no pain scoring as a training decision. status: contested
- **Cross-train first or run from day one?** For impact-limited histories, cross-training preserves
  fitness while tissue adapts; for detraining-only histories it delays the specific adaptation. The
  engine asks whether impact or fitness was the limiter. status: contested
- **How fast to reintroduce speed once running is comfortable.** Some coaches say "as soon as it feels
  fine"; the tissue-tolerance logic says 4–6 weeks of clean volume first. Default: 4–6 weeks.
  status: contested

## Gaps to verify

- Graded return-to-run protocols with outcomes (tendinopathy, stress-fracture, post-surgical) — no
  verified primary source in this knowledge base; currently grade C from coaching consensus only.

## Escalate to a clinician

The plan **does not** resume running on its own after: a diagnosed stress fracture or bone stress
injury, surgery, a clinician-prescribed rest period, chest symptoms, or any condition where a
clinician set the criteria. In those cases the app's only job is to hold the calendar, keep the
cross-training option, and ask whether the clinician has cleared running — then start at the band the
user selects. Also escalate: pain that persists > 72 h after a session, swelling, night pain,
locking, numbness, or a limp the user reports; a return of the exact pain that ended the last block
stops progression immediately and is a question for a clinician, not a knob in a YAML file.

## Plan shape

```yaml
weeks: 12 (8 short layoff / 16 long layoff)
sessions_per_week: 3 → 4 after 4 clean weeks
hard_days: 0 for weeks 1–2 (3–6 for long layoffs), then 1, then 2
volume_metric: minutes                     # km is displayed, never prescribed
step_cycle: "2:1"
growth: {weekly_min_delta: "+10 min max on the long session", volume_pct_cap_of_prior: per return band}
shape_default:
  - {tue: "easy 20–35 min (walk breaks programmed from week 1 if needed)"}
  - {thu: "easy 20–35 min + 4 × 20 s strides from week 4"}
  - {sat: "long easy 30–70 min"}
optional: {session: cross-training, minutes: 30–45, replaces: "a missed run, never the long run"}
milestones:
  - {week: 2, item: "30 min continuous, no pain report during the next 24 h"}
  - {week: 4, item: "add a 4th easy day OR the first strides — never both"}
  - {week: 6, item: "first threshold touch: 3 × 6′ at a comfortably hard effort, not a prescribed pace"}
stop_rule: "same-region pain twice in one week ⇒ hold volume flat for 7 days and re-ask"
```

## Typical self-inflicted errors

- Reconstructing the old paces: "I used to run 4:30, so easy is 5:15" — in week 2, at 2 km of true
  tolerance.
- Judging readiness by the treadmill test that felt easy and jumping straight to the pre-injury peak.
- Replacing a missed run with a longer one, producing a 40% single-week jump.
- Adding intensity the week the pain stopped, which is the week most likely to restart it.
- Silent cross-training: doing the bike session but logging nothing, so the engine sees only misses and
  shrinks the plan wrongly.
- Two "test races" in the same fortnight to see where they are.

## Messaging tone

- Explicitly anti-regret: name the asymmetry once ("your lungs will be ready weeks before your
  tendons"), then keep it out of every message.
- Zero drama about setbacks. A bad week is a data point, not a verdict.
- Never "listen to your body" alone — pair it with an observable: "if it's still sore tomorrow, the
  next run is 20 minutes shorter."
- Do not say: "you'll be back to where you were in no time" (guarantee); "you were injured because…"
  (diagnosis/attribution); any reference to weight or body change during the layoff.
- Examples (EN):
  - "Your 5K fitness is closer than your calves think. Week 3 stays as written: three easy runs, the
    long one up 5 minutes."
  - "You logged 38 min instead of 25 — noted, and no penalty. Next run returns to 25; the ramp works
    better than the catch-up."
- 繁體中文（語氣：穩定、不夸大、不追責）：
  - 「你的心肺恢復得比肌腱快。第 3 週照原訂：三次輕鬆跑，長的那趟加 5 分鐘就好。」
  - 「你跑了 38 分鐘（原訂 25），已記錄，不扣分。下一趟回到 25 分鐘；循序漸進比補練有效。」

## Review sensitivity

- **Very high sensitivity, one-directional: reviews here may only subtract or hold.** No review in the
  first 4 weeks may add a session, minutes, or intensity — that is a product-level rule for this
  persona.
- Strong triggers: same-region pain report → freeze volume 7 days + clinician-referral line. Week
  completion < 60% → move sessions, don't shrink the *standard*; ask about scheduling instead. Any
  week over the band's cap → bring the next week back to the band and say why.
- Ignore: slow paces, HR numbers, "bored of easy running" (answer with variety inside Z1: trails,
  strides, a different route — not with intensity).
- Expected review output most weeks: **no change**.
