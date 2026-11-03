---
id: personas/novice-first-5k
title: "Persona — novice training for a first 5K"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [onboarding, plan-generator, review-engine, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S7]
---

**Key takeaways**

1. The goal is **6–8 weeks of uninterrupted contact with running**, not a 5K time. Attendance is the
  only metric that predicts success in this persona.
2. Run/walk is the correct primary tool, not a failure state. A novice who finishes a session "only"
  run-walking has completed the session.
3. Volume ceilings are set by **tissue tolerance and time**, not by cardio feel; the cardio system
  adapts first and lies.
4. The distribution conversation (80/20) does not apply yet: at 3 sessions of 25–40 min there is no
  meaningful "high intensity" band to protect. [PLAN-S2 caution: distribution findings come from
  trained populations]
5. Everything the plan says must survive being read once, tired, at 6 a.m.

## Facts

- Load-related "training errors" are the most-studied modifiable injury exposure in runners, with
  inconsistent effect sizes; inexperience plus rapid load rise is the pattern the reviews converge on.
  [PLAN-S7 grade A review, confidence medium]
- The polarized/pyramidal literature is built on trained subjects; applying its ratios to a
  3-session novice week is an extrapolation the evidence does not support. [PLAN-S2 grade A review of
  trained/elite data]
- No runner-specific trial establishes a novice starting volume. Numbers below are engineering
  defaults plus coaching consensus. Confidence: low.

## Practice

- Success definition: 80% of scheduled sessions completed for 6 consecutive weeks.
- Progression is **time-based**: 20 → 25 → 30 → 35 → 40 min per long session; km is reported but never
  prescribed.
- Walk breaks are programmed ("4 × 4 min run / 1 min walk") so the user cannot misread them as
  falling behind; the interval structure is the workout.
- Strides appear only in week 5+ and are taught as "play", 4 × 15 s, never breathless.
- Strength: one 15-min bodyweight routine (calf raise, sit-to-stand, single-leg balance, hip hinge)
  twice weekly, placed after easy runs. Grade C practice.

## Controversies

- **Run/walk vs continuous running from day one.** Both reach a 5K finish; run/walk has lower
  session-failure rates and better adherence in practice, but no head-to-head trial in this
  population. Default run/walk, with a "continuous" switch for users who ask. status: contested
- **Is a 5K "race" the right first goal?** It is the most common and the most logistically simple; a
  fun-run or a 1-mile charity event produces the same adaptation with less pressure. The engine asks
  what the user actually wants rather than assuming a race exists. status: contested

## Escalate to a clinician

Before starting: chest pain/pressure, unexplained syncope or dizziness, resting HR far outside normal
ranges without explanation, uncontrolled hypertension or asthma, pregnancy, or any current
clinician-managed condition. During: pain that changes gait, sharp localised pain, chest symptoms, or
collapse → stop and seek care. This persona has the least body awareness of any; the plan errs hard
toward "ask a clinician" rather than "adjust the plan".

## Plan shape

```yaml
weeks: 8
sessions_per_week: 3            # non-consecutive days; OFF days honoured absolutely
session_minutes: 20 → 40        # long session only; the other two stay ≤ 35
volume_ceiling: 18 km/wk at week 8 (warning above 22 km)
hard_days: 0                     # no prescribed intensity in weeks 1–8
structure_per_week:
  - {session: easy-run|run-walk, purpose: "time on feet"}
  - {session: easy-run|run-walk, purpose: "time on feet + 4 × 20 s pick-ups from wk 5"}
  - {session: long-run (easy), purpose: "longest exposure; same weekday every week"}
optional: {session: strength-for-runners, minutes: 15, count: 2}
milestones:
  - {week: 2, item: "20 min continuous or 5 × 4 min run / 1 min walk without stopping"}
  - {week: 5, item: "30 min continuous at conversational effort"}
  - {week: 7, item: "rehearsal: race-distance at race pace of conversation, new shoes already tested"}
  - {week: 8, item: "RACE or time-trial; goal = even first half, no walking unless chosen"}
fallback_rule: "missed session ⇒ do the next one as scheduled; never add a make-up session"
```

## Typical self-inflicted errors

- Adding a 4th day in week 2, usually because week 1 felt easy. (Cardio adapts first.)
- Turning every run into a hard run, then needing two days off — the sawtooth the plan exists to
  prevent.
- Buying carbon-plate shoes in week 1; changing shoes on race day.
- Comparing a parkrun split with a friend's and re-pacing the whole plan off one session.
- Ignoring a two-week break and then resuming at the pre-break volume — the relapse pattern.
- Stretching/mobility guilt: skipping sessions because the 45-minute "full routine" felt obligatory.

## Messaging tone

- Short sentences. One instruction per session. Name the *behaviour*, not the identity.
- Praise attendance and effort, never speed or body change. No numbers about weight, ever.
- Prefer "next one is as planned" over "you fell behind".
- Do not say: "you should have", "consistency is key" (empty), "no pain no gain", "everyone can run a
  sub-25 5K" (guarantee — forbidden), or anything implying a body-size goal.
- Examples (EN):
  - Completed: "Three sessions this week — that is exactly what week 3 asks for. Keep the easy days
    easy."
  - Missed: "Two of three. Nothing to catch up: Thursday's run is unchanged, 25 min easy."
  - Felt hard: "That's what week 6 is supposed to feel like. Finish the week with the long run at an
    effort you could hold another 10 minutes."
- 繁體中文（語氣：温和、具體、不說教；避免「堅持就是勝利」式口號）：
  - 完成：「本週三次都完成了，這正是第 3 週的目標。輕鬆的日子請保持輕鬆。」
  - 缺練：「三次中完成兩次。不用補回來：週四那趟照原訂，輕鬆跑 25 分鐘。」
  - 覺得很累：「第 6 週本來就該有點吃力。週末的長跑請保持在『還能再多跑十分鐘』的狀態。」

## Review sensitivity

**High-sensitivity triggers** (any one ⇒ propose a review, but ≤ 2 changes):
- ≥ 2 missed sessions in a week → reduce the week, do not raise the standard; move a session to a slot
  with better attendance history.
- Any pain report → remove the next hard-ish element (pick-ups), shorten the long run 20–30%; if pain
  recurs or gait changed, escalate instead of adjusting.
- Attendance ≥ 90% for 3 weeks → allow the normal progression, nothing more.
**Low-sensitivity (ignore for planning):** one bad session, weather, a slow split, "felt hard", a
single poor sleep night. This persona is the one where the review engine should most often answer
"nothing changes" — churn is itself harmful here.
