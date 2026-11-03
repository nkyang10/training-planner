---
id: personas/competitive-amateur-marathon
title: "Persona — competitive amateur marathoner (sub-3:30 target band)"
status: draft
confidence: medium
evidence: [review, meta-analysis, practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S5, PLAN-S8, PLAN-S9, PLAN-S10, PLAN-S11, PLAN-S12]
---

**Key takeaways**

1. This persona is where plan design actually matters: 2–3 quality sessions, a real Specific phase,
  and marathon-pace volume that is dosed, not improvised.
2. The failure mode is **volume ambition outrunning recovery capacity** — 100 km/wk plans built on a
  70 km reality, then a collapsed taper.
3. MP volume is capped by textbook dosing (~20–25% of weekly km max) [PLAN-S8]; the binding constraint
  is the long run, not the midweek session.
4. A time goal is legitimate planning input and never a promise. State bands, name the assumptions, and
  keep a finish-only fallback visible.
5. Race-day execution errors in this persona (going out 8–15 s/km too fast) cost more than any single
  training week; the plan must rehearse pacing.

## Facts

- Taper prescription with meta-analytic support: ~2 weeks, exponential volume reduction 41–60%,
  intensity and frequency maintained. [PLAN-S5 grade A]
- Recreational-to-competitive marathoners in the training-load literature averaged **5.2 ± 0.9 h of
  training per week**; a plan needing 12+ h/wk is not a recreational plan and must be labelled as
  exceptional. [PLAN-S12 grade B cohort]
- Published marathon plans differ structurally: Daniels-style phase plans use 3 quality sessions with
  taper dropping to 2 [PLAN-S8, PLAN-S9 grade C/D]; Hansons-style plans use 6 days, high frequency of
  quality sessions and no recovery weeks [PLAN-S10 grade C]; Pfitzinger-style plans use step cycles with
  progression long runs [PLAN-S11 grade C]. They are not interchangeable, and the generator picks one
  family per block.
- Distribution data caution: polarized advantage is best supported in trained subjects, but this
  persona's realistic volume (55–90 km/wk) is at the low end of the studied elite ranges. [PLAN-S1,
  PLAN-S2]

## Practice

- Block length 16–18 weeks for a first competitive build; 12–14 for a second marathon in the same year.
- Week architecture: Tue intervals/MP-cruise · Thu threshold or hills · Sat MP long run · two easy runs
  (one of them a 40-min recovery run after the long run) · one full rest day.
- Peak weeks 3–6, in the Specific phase, 2–4 weeks pre-race. Peak long run 30–34 km **or** 120–150 min,
  whichever comes first; time-on-feet is the safer currency.
- MP dosing: 45–75 min inside the long run at peak, ≤ 25% of weekly km at MP, and no more than two MP
  exposures per week. → rule: heuristics/workout-dosage.yaml#mp_week_pct (range 10–25)
- Back-to-backs: 2–3 weekends max, Sat MP run + Sun easy 40–60 min, combined weekend ≤ 45% of volume.
- Tune-up: one half marathon 5–7 weeks out as the specificity test, or a 10K 4 weeks out; never inside
  the last 3 weeks.
- Strength 2×/wk heavy-ish, ≥ 48 h from key days; keep it through the taper at half dose.

## Controversies

- **Hansons-style cumulative fatigue vs step cycles.** Deliberate no-recovery-week plans can work for
  high-training-age amateurs, but the injury reviews point the other way and the design leaves no room
  for a bad week. Engine default = 3:1; opt-out requires a ≥2-year stable history and a recorded
  acknowledgement. [PLAN-S7, PLAN-S10, PLAN-S11] status: contested
- **How much MP volume.** 20% vs 30% of weekly mileage; a "10 × 2 mile @ MP" culture exists that the
  dosing rules explicitly cap. [PLAN-S8] status: contested
- **Long run ceiling**: 30 km vs 35 km vs 2.5–3 h. No trial compares them; time-of-feet and body-mass
  realities dominate. status: contested
- **Carbon-plate shoes as a training variable**: they change pace at equal effort and can mask fitness
  changes; some coaches restrict them to 1 session/wk. No runner-specific longitudinal data in this
  knowledge base yet. status: contested

## Plan shape

```yaml
weeks: 16–18
sessions_per_week: 5–6
hard_days: 3
volume_range: 55–95 km/wk peak (warn if peak > 1.35 × best 4-week average of the last year)
phase_split: {base: "6 wk", build: "5 wk", specific: "4 wk", taper: "2 wk"}
shape_6_day:
  - {tue: "KEY-1: 5×1000 @ I (Build) → 3×2 mi @ MP cruise (Specific)"}
  - {wed: easy 50–60}
  - {thu: "KEY-2: cruise intervals 4×8′ @ T | hills 8×60″"}
  - {fri: easy 45–55 + strides}
  - {sat: "KEY-3: progression long 90–150 min, MP block 45–75 min"}
  - {sun: recovery 40–60 (back-to-back partner) | rest}
  - {mon: rest}
reset_weeks: "every 4th week at 65%; never inside the taper"
taper: {days: 14, shape: exponential, volume_cut_pct: 50, last_hard_days_out: 6}
goal_language: "predicted band 3:24–3:32 from a half done 2026-09-13; goal 3:25 is at the band edge"
```

## Typical self-inflicted errors

- Increasing volume and quality in the same week during the Specific phase — the classic injury week.
- Turning easy runs into 6:10/km "marathon-plus" runs, producing 4 medium days and 0 real quality.
- Testing marathon pace in week 4 because it felt easy, then plateauing in week 12 with nothing left to
  add.
- A 35 km long run 10 days out, then a flat race.
- Racing a half 12 days before the marathon "to sharpen".
- Adding mileage during travel weeks with no long-run slot, so the volume becomes 6 medium midweek runs.
- Ignoring a niggle for 3 weeks while holding peak volume, then losing 6 weeks.

## Messaging tone

- Peer-to-peer. This persona knows the vocabulary; speak in paces, minutes and rationale, and respect
  that they may have run several marathons.
- Be willing to disagree out loud, with the reason: "I'd hold the 32 km; here's why."
- Never hype. Never a guarantee. State uncertainty as a range and the assumption it rests on.
- Do not say: "you've got this" (no information); "one more week like this and you'll break 3:20"
  (guarantee + risk prompt); shaming about a missed long run.
- Examples (EN):
  - Over-reaching: "You added 9 km and a 6×1000 in the same week you reported heavy legs. Volume or
    intensity next week — not both. I'd keep the intervals and drop Saturday to 90 easy."
  - Race rehearsal: "Sat: 2 h with 60 min @ 4:55–5:00, race shoes, same 6:30 start. If the last 20 min
    is at effort rather than pace, that's a pass."
- 繁體中文（語氣：對等、直接、給依據）：
  - 進度太快：「你在回報『雙腿沉重』的那一週同時加了 9 公里與 6×1000。下週只能二選一：保留間歇，把週六改成 90 分鐘輕鬆跑。」
  - 賽前演練：「週六：2 小時，中段 60 分鐘保持在 4:55–5:00，穿比賽鞋、同樣 6:30 出發。若最後 20 分鐘是靠體力撐住而不是配速，就算通過。」

## Review sensitivity

- **High sensitivity, low volatility.** This persona produces rich data and reacts to it; the engine
  should accept signal and reject noise.
- Triggers: two consecutive weeks < 85% completion → cut the next week 10–15% and say why. Long run
  MP block failed twice (couldn't hold the band) → hold volume, repeat the session next week instead of
  progressing. Resting HR +8% for 3 days → remove the next KEY-1. Race in the last 3 weeks requested →
  decline, substitute a rehearsal.
- Hard stops (non-negotiable, subtract-only): no third quality session added by a review; no peak-week
  volume increase inside 3 weeks of the race; no back-to-back after a pain report.
- Change budget: 1 change, occasionally 2, each with reason + signal + expected cost. "Nothing changes"
  is a valid and common review output.
