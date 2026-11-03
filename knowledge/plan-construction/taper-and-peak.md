---
id: plan-construction/taper-and-peak
title: "Taper and peak: length, magnitude, last hard session, race week, post-race"
status: draft
confidence: high
evidence: [meta-analysis, review, practitioner]
applies_to: [plan-generator, review-engine, calendar]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S5, PLAN-S8, PLAN-S11]
---

**Key takeaways**

1. The best-supported taper shape is **~2 weeks, exponential volume reduction of 41–60%**, with
  intensity and session frequency maintained. [PLAN-S5 grade A meta-analysis]
2. Tapering is a **freshness/benefit trade-off**, not rest: cut fatigue, keep the stimulus. Deleting
  intensity is the classic self-inflicted taper error.
3. Taper length scales with how much volume must be shed and with the race's duration — not with how
  nervous the runner is.
4. The last hard session belongs **5–7 days out** for a marathon. Nothing untested goes in the last 10
  days: no new shoes, food, pace, or warm-up.
5. The race is not the end of the plan; the **re-entry rule** decides whether the next block happens.

## Facts

- Meta-analysis of tapering studies: the most efficient strategy reported was **a 2-week taper with an
  exponential reduction of training volume by 41–60%**; performance gains were blunted by longer tapers
  and by larger volume cuts. [PLAN-S5 grade A, mixed-sport populations — running-specific effect
  likely similar but not isolated]
- Maintaining intensity and frequency while cutting volume is the consensus prescription across the
  taper literature and every mainstream running text; the alternative (reduced intensity, maintained
  volume) produces a dull, heavy leg feeling and no measurable benefit. [PLAN-S5, PLAN-S8, PLAN-S11
  grade C]
- → rule: heuristics/taper.yaml#taper_days (range 4–28)
- → rule: heuristics/taper.yaml#volume_cut_pct (range 20–65, default 45–50)
- → rule: heuristics/taper.yaml#frequency_floor_pct (range 60–100, default 75)
- → rule: heuristics/taper.yaml#last_hard_session_days_out (range 3–10)

## Practice

### Shape choice

| Shape | Volume profile (week-1 → race) | When the engine picks it |
|---|---|---|
| Exponential (default) | 100 → 82 → 60 → 45 → race | default for half and marathon; matches [PLAN-S5] |
| Linear | 100 → 85 → 70 → 55 | when the user's schedule cannot hold the exponential's mid-taper sessions |
| Step | 100 → 65 → 65 → 60 | when the taper is long (>3 weeks) or the user travels mid-taper |

Frequency floor: keep ≥ 70–75% of the number of running days; make them shorter. Session **count** is
what preserves the feel of fitness; volume is what sheds the fatigue.

### Taper length by distance (grade C, anchored on the 2-week meta-analytic optimum)

| Race | Taper | Last hard session | Notes |
|---|---|---|---|
| 5K / 10K | 5–10 days | 3–5 days out | shorter: detraining outruns freshness at this distance |
| Half | 10–14 days | 5–7 days out | keep 2–3 km @ MP in the last week |
| Marathon | 14–21 days (default 14) | 5–7 days out | extend to 21 d for heavy-volume or masters runners |
| Ultra (>50K) | 21–28 days | 10–14 days out | cut **time on feet**, keep hills and fuel rehearsal |

Individual difference matters more than the table: if the user reports "heavy" for 4+ days at the start
of taper, the taper started too late, not too small — the fix is a shorter block, not a smaller race
week.

### What stays, what goes

- Stays: race-pace touches (short), strides, mobility/strength routine (halved), warm-up rehearsal,
  long-run weekday and start time.
- Goes: long-run distance (−30% then −50%), hill volume, any new strength load, back-to-backs, doubles.
- Never goes to zero: a 20–30 min easy run with 4 strides on the day before a 10K keeps the pattern
  alive; 25 min easy with 2 × 1 km @ MP three days before a marathon is standard rehearsal.

### Race-week checklist (generator emits as dated tasks)

```yaml
d-14: {final: "last MP long run", admin: "bib collected, start-time plan, travel booked"}
d-10: {rule: "nothing new: shoes, insoles, socks, food, caffeine dose, warm-up"}
d-7:  {session: "30–40 min easy + 4 strides", sleep: "protect tonight — the night BEFORE matters more than the night before the race"}
d-5:  {session: "last real quality: 2–3 km @ MP inside 40 min easy"}
d-3:  {session: "30 min easy, 4 strides", fuel: "increase carbohydrate share; keep fluids/sodium normal; no new products"}
d-2:  {session: "20 min easy OR rest", logistics: "kit laid out with weather-specific layering; pin number practice"}
d-1:  {session: "15–20 min easy + 3 strides (rest if travel day)", food: "normal, familiar, earlier in the evening"}
d0:   {session: "RACE", warmup: "rehearsed, ≤ 10 min jog + drills + 3 race-pace strides; start slower than target for 5–10 min"}
```
[Checklist content: grade C practitioner consensus; the only measured parameter here is "keep intensity,
cut volume" [PLAN-S5].]

### Post-race recovery and re-entry

| Days after race at/above half distance | Allowed | Not allowed |
|---|---|---|
| 0–3 | walking, easy spin, swim if pain-free | any structured run |
| 4–7 | easy 20–40 min, Z1, flat | strides if gait felt uneven |
| 8–14 | easy runs ≤ 60% of the block's typical week, 4–6 strides once | tempo, MP, hills, races |
| 15+ | resume Build only if 2 pain-free weeks and "normal legs" reported | — |

- A race used as a fitness test still bills the recovery: the plan deducts it from the *week it
  happened*, and paces re-baseline from it (see `measurement-and-testing.md`).
- Marathon: expect 2–4 weeks before structured work is productive; do not schedule a second marathon
  inside 8 weeks without labelling it "not a peak".

## Controversies

- **More taper is always safer?** No — [PLAN-S5] found blunted gains with longer tapers and bigger
  cuts, and recreational runners detrain quickly at low volume. Over-tapering is a real failure mode.
  status: contested (public intuition vs meta-analysis)
- **Taper volume for low-volume runners.** The meta-analysis is dominated by higher-volume athletes; a
  runner at 30 km/wk cutting 50% loses meaningful aerobic stimulus. Engine floors the cut at "lose no
  more than one running day" and shifts the reduction to session length. status: contested
- **Carb-loading specifics** (grams, timing) are nutrition guidance and out of scope for this product
  (no calorie/diet prescriptions). The plan may only say "familiar food, carbohydrate-forward, nothing
  new". status: policy

## Individual differences

- Masters need a longer, shallower taper: 18–21 days at 35–45% cut rather than 14 days at 55%.
- Novices / first-timers: cut volume less and add days off — their limiter is novelty and
  nervousness, not accumulated fatigue. A first-timer's race week is mostly logistics.
- Users whose feedback shows insomnia or elevated resting HR in the taper: treat as fatigue signal and
  remove the last quality session rather than adding rest days mid-week (fewer decisions, same effect).
