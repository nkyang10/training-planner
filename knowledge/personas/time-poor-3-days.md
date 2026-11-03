---
id: personas/time-poor-3-days
title: "Persona — time-poor runner with 3 reliable days (and short slots)"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S4, PLAN-S8]
---

**Key takeaways**

1. Three days is a workable plan, not a consolation: the design question is **which session carries the
  adaptation**, because there is no spare session.
2. Minimum effective doses govern everything: a 3-day plan is legal only if each session clears its
  dose (aerobic: ≥ 30 min; threshold: ≥ 20 min of work; intervals: ≥ 8–12 min at I-pace).
3. With ≤ 45-minute slots, warm-up cost is the real budget: a 40-minute slot holds ~20 minutes of
  quality, and cruise intervals beat long continuous tempos.
4. The 80/20 conversation changes shape: at 3 sessions, 1 hard day is 33% of sessions. Judge
  distribution by **minutes per 28 days**, never by session count. [PLAN-S2, PLAN-S4]
5. This persona's plan must be robust to one day evaporating: every week has a designated
  "if only two happen" priority order.

## Facts

- In the 12-runner trial, the *distribution* of intensity, not session count, differentiated the arms
  (80.5% vs 66.8% in Z1; 11.8% vs 24.7% in Z2; equal high-intensity share). [PLAN-S4 grade B]
- Distribution research is drawn from trained athletes running 5–7 sessions; extrapolating percentages
  to a 3-session week is an explicit extrapolation, not a measured result. [PLAN-S2 grade A review]
- Threshold work can be delivered effectively in ≥ 20 min of work (continuous or 3 × 8 min cruise);
  the same adaptation target is reachable in a short slot, which is what makes this persona feasible.
  [grade C practice, PLAN-S8 dosing]

## Practice

- Session priority when the week collapses: **KEY > long run > easy**. Deleting the key session is the
  decision to make deliberately, never by default.
- Rotation is the core mechanism: since only one session can be hard most weeks, alternate
  **top-end (intervals/hills)** and **threshold/race-pace** week to week rather than doing a bit of
  both every week. Two weeks is the measurement window, not one.
- Hard session in the longest reliable weekday slot; long run on the one day with ≥ 75 min free, which
  is often not the weekend — ask, don't assume.
- Strength: 2 × 20 min, and they are **scheduled, not optional-adjacent**; this persona's injury risk
  is concentrated tissue load from infrequent impact, and strength is the mitigation. Grade C.
- Non-running aerobic cross-training counts as a session here for the aerobic share (brisk walk-runs,
  bike commutes), and the plan should say so — but it never substitutes for the long run when the goal
  is a race over 10K.
- Race goal realism: a 3-day plan can produce a strong 5K/10K and a finishable, enjoyable half. For a
  first marathon it is possible but the plan must say what is being traded (durability) and offer
  a 4th day once per month. Grade C.

## Controversies

- **Is 3 days enough for a marathon?** Anecdote says yes (faster-than-expected finishes), the volume
  logic says the long-run/durability deficit is real and the runner usually pays in the final 8 km.
  Default: allow it, label the trade-off, and require the "long run 3-weeks-out" rehearsal. status:
  contested (grade D anecdotes vs grade C reasoning)
- **Quality every session?** Some minimalist programmes make all three sessions hard. That works for
  short slots and short events, but it removes the aerobic share the distribution evidence protects
  and it fails for this persona when life adds stress. Default 1 hard + 2 easy. [PLAN-S4] status:
  contested
- **Doubles vs one longer run**: 2 × 25 min on a day off is a real alternative to a 60-min run for
  volume, but it costs adherence. Offer as an opt-in only. status: contested

## Plan shape

```yaml
weeks: 8–12
sessions_per_week: 3 (hard constraint from availability.days)
slot_minutes: 30–45 weekdays, 60–90 on the long day
hard_days: 1 (2 only in a 5-week peak sub-block, and only if the long run has ≥ 75 min)
rotation: {odd_weeks: "top-end", even_weeks: "threshold", long_day: "endurance ± race-pace"}
shape:
  - {tue: "KEY (40 min): 12′ warm-up → 5×3′ @ I / 30″ easy → 8′ cool-down   |   even weeks: 12′ → 3×8′ @ T → 8′"}
  - {thu_or_wed: "easy 30–40 + 4 strides (strides are the only intensity here)"}
  - {sat: "long easy 60–90; from week 6 add 15–25 min at race pace in the middle"}
strength: {count: 2, minutes: 20, placement: "evenings after easy runs, or lunchtime"}
priority_if_short: ["KEY", "long run", "easy run"]
volume_range: 20–45 km/wk
tests: {instrument: "parkrun or 3-mile test", cadence_weeks: 6}
taper: {days: 10, cut: "shorten sessions, keep all three days"}
```

## Typical self-inflicted errors

- Running all three days at the same "comfortably hard" effort, producing a week with no easy day and
  no true top-end day.
- Skipping the long run when a week is busy, then being unprepared at 15K+ in the half.
- Doing the key session cold in a 40-minute slot and getting a hard 15 minutes instead of a workout.
- Adding a 4th day only in the weeks where they feel guilty, producing the sawtooth.
- Strength: skipped, because "running is already 3 days".
- Racing a 10K on the long-run day and reporting it as an easy run, which makes the engine think
  recovery is unlimited.

## Messaging tone

- Respect the calendar above all. Messages must be shorter than the session they describe.
- Never imply the plan is a compromise. "Three good days beat five half-days" is the frame.
- Give the priority order in the same sentence as the ask, so the user knows what to cut.
- Do not say: "try to find more time", "ideally you'd also…", "just 20 more minutes", or guilt framing
  about missed easy runs.
- Examples (EN):
  - "Busy week: do Tuesday's intervals and Saturday's long run; Wednesday's easy run can go."
  - "That was a 39-minute slot with a real workout inside it. Exactly the right session for the time."
- 繁體中文（語氣：簡潔、尊重時間）：
  - 「這週很忙：做週二的間歇和週六的長跑，週三的輕鬆跑可以刪掉。」
  - 「40 分鐘的時段裡完成了完整的主課，這正是這個時間该有的樣子。」

## Review sensitivity

- **Medium sensitivity to volume, high sensitivity to slot reality.**
- Strong triggers: the same day missed twice → that weekday is deleted and the session moved to a slot
  with a completion history (this is a scheduling fix, not a motivation problem). Key session
  shortened 3 weeks in a row → shorten the prescribed dose to what actually happens; a 20-min version
  done is better than a 40-min version skipped.
- Weak triggers to ignore: an easy run cut to 20 min, a walk break, a slow long run in heat.
- Change budget: **1 change per review**. With 3 sessions, every change is structurally expensive.
- Never propose a 4th day as a fix for a stalled plan without asking about the user's calendar first;
  the honest answer may be "different key session", not "more running".
