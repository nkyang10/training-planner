---
id: personas/masters-40plus
title: "Persona — masters runner (40+)"
status: draft
confidence: low
evidence: [review, practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S5, PLAN-S7]
---

**Key takeaways**

1. Masters training is not "less": it is **same stimulus, more recovery between stimuli**. Frequency of
  hard efforts falls before the quality of the effort does.
2. The two structural changes with the highest payoff: hard days spaced **48–72 h**, and **2:1** load
  cycles instead of 3:1.
3. The second weekly interval session is usually better spent on hills + strides: similar neuromuscular
  and intensity stimulus, far lower recovery cost. (Coaching consensus, grade C.)
4. Warm-up and cool-down are not optional overhead after 40; the engine should build them into the
  session, not into "extra".
5. **Evidence honesty:** this file's physiological framing is coaching consensus. No primary
  masters-specific study was verified in this pass, so nothing here is a hard constant. See
  `## Gaps to verify`.

## Facts

- The injury literature is not age-specific, but its central finding — inconsistent associations
  between load variables and injury, with rapid load rise as the most-studied exposure — applies with
  more consequence when recovery time is longer. [PLAN-S7 grade A review]
- Taper prescription (2 weeks, exponential −41–60%, intensity maintained) comes from mixed-age
  samples; masters practitioners report needing the longer end of the range. No age-stratified
  analysis was verified. [PLAN-S5 grade A + grade C practice]
- Age-related change in VO₂max, tendon stiffness, high-threshold motor-unit capacity and recovery
  rate is described in exercise-physiology textbooks and masters-coaching literature as real but
  highly individual and strongly attenuated in people who keep training. **Specific rates were not
  verified in this pass and must not be presented as numbers.** [grade C, confidence low]

## Practice

- Hard-day spacing 72 h by default in Build/Specific; never three hard days in a week.
- Cycle 2:1 (2 build weeks, 1 down week at 60–70%); the down week is where adaptation is reported.
- Volume growth capped at the lower end of the persona ceiling table and expressed in **minutes per
  week**, not km — time on feet is the honest load metric when pace varies day to day.
- Weekly intensity: 1 true Z3 session, 1 threshold **or** hill session, strides twice, everything else
  genuinely easy. [PLAN-S2 distribution logic still holds; the polarized evidence is at least as
  relevant here as threshold-heavy.]
- Warm-up 15 min minimum before any Z2/Z3 session (jog 10 + drills + 4 × 20 s), cool-down 10 min.
- Strength 2–3×/wk is closer to mandatory than optional for this persona (heavy-ish lower-body +
  single-leg work); it is the highest-value "extra" in the plan. Grade C.
- Sleep is a training variable the plan can protect: no key session scheduled before a user's stated
  minimum-sleep night; the engine reschedules rather than accepting a hard session on 4 h of sleep.
- Taper: 18–21 days, volume cut 35–45% (shallower, longer), frequency kept. [PLAN-S5 + grade C]

## Controversies

- **Intensity vs volume priority.** Some masters programmes cut volume hard and keep intensity weekly;
  others keep volume and drop the second quality session. Both are defensible; the engine's default
  keeps intensity and cuts frequency, because frequency of hard efforts is the recovery bottleneck.
  status: contested
- **Is more frequency harmful after 40?** Not per se — easy frequency is well tolerated and helps
  recovery. The contested claim is about *hard* frequency. status: contested
- **Pace-based zones after 40.** Population HRmax formulas are unreliable here; measured HRmax or
  pace-based zones only. status: contested (settled by measurement, not argument)

## Gaps to verify

- Primary sources on age-related VO₂max decline in trained vs previously sedentary adults, and on
  resistance-training effect size in masters endurance athletes (grade A/B candidates: journals of
  sport & ageing, medicine & science in sports & exercise, Scandinavian Journal of Medicine & Science in
  Sports). Nothing in this file may be quoted as a percentage per decade until verified.

## Escalate to a clinician

Always, before a new hard block if any of: new chest pain or pressure, palpitations or an irregular
pulse, unexplained breathlessness at a previously easy pace, dizziness/near-syncope during or after a
run, a family history of sudden cardiac death, or uncontrolled blood pressure. Also: any question about
medication (including blood-pressure drugs and how they change heart-rate zones — HR zones become
unusable with beta-blockers) goes to the prescriber, never to the plan. Pain lasting > 72 h, swelling,
night pain, or numbness: stop and ask. This product never diagnoses and never adjusts medication.

## Plan shape

```yaml
weeks: 12–16 (16 for a marathon, 10–12 for a half, 8 for a 10K)
sessions_per_week: 4–5
hard_days: 2 (never 3)
spacing: {min_gap_hard_days_h: 72, easy_day_after_hard: required}
step_cycle: "2:1"
volume_ceiling: lower end of the days-based table; growth ≤ 6–8%/wk and ≤ 5 km/wk
warmup_min: 15 (before any Z2/Z3), cooldown_min: 10
shape_5_day:
  - {mon: rest}
  - {tue: "KEY-1 intervals 4–6×800–1000 @ I, or 6×75″ hills"}
  - {wed: easy 40 + 4 strides}
  - {thu: "KEY-2 cruise intervals 3×8′ @ T | tempo 20′ continuous"}
  - {fri: rest | mobility}
  - {sat: "long run 80–120 min easy; MP or race-pace block ≤ 40 min, only in Specific"}
  - {sun: easy 30–40 (optional, first to be cut)}
strength: {count: 2, placement: "after easy runs, ≥48 h from KEY days"}
taper: {days: 18, volume_cut_pct: 40, last_hard_days_out: 7}
```

## Typical self-inflicted errors

- Training Tuesday like age 28 and paying on Thursday, then "making up" Thursday with a hard Saturday
  and arriving at the race with three hard efforts in nine days.
- Cutting the warm-up when time is short — and then blaming the first two intervals.
- Two threshold sessions in a week because "it's only tempo".
- Skipping strength all block, then chasing a tendon problem for six weeks.
- Racing every second weekend at race effort and calling it a speed workout.
- Ignoring a stiff calf that "went away after two kilometres" until it no longer goes away.

## Messaging tone

- Respect the training history first: many of these users have 20+ years of running and know their
  bodies better than any template. Advice is a proposal, not a correction.
- Avoid age framing that sounds like decline. Say "recovery takes longer now, so the plan spaces things
  out", never "at your age".
- Concrete and unrushed; give the reason for the spacing every time it appears.
- Do not say: "you're too old for that", "slow down", "you should get checked" without naming the
  specific sign that warrants it, or any body-composition commentary.
- Examples (EN):
  - "You had quality on Tuesday and Saturday with nothing easy between. Let's move the second one to
    Thursday — same stimulus, and Saturday's long run becomes a real long run again."
  - "Thursday felt hard but you recovered inside 24 h, so the dose was right. The plan stays."
- 繁體中文（語氣：尊重經驗、就事論事）：
  - 「週二和週六都是品質課，中間沒有真正的輕鬆日。把第二次挪到週四——刺激一樣，週末的長跑也才跑得出內容。」
  - 「週四那堂雖然辛苦，但 24 小時內就恢復了，說明剂量合適，課表不動。」

## Review sensitivity

- **High sensitivity to recovery signals, low sensitivity to single-session performance.**
- Strong triggers: any session needing > 48 h to feel normal again → move to 2:1 and add 24 h of spacing
  (one change). Two pain reports in the same region → remove the next Z3 session and re-check after
  10 days (no diagnosis, no "push through"). Insufficient-sleep week → reschedule key days, do not
  reduce fitness claims.
- Weak triggers to ignore: a slow easy run, HR elevated on one hot day, one missed session, a bad
  parkrun.
- Subtractions only in this persona's reviews by default; any addition requires ≥3 clean weeks and an
  explicit reason recorded with its expected cost.
