---
id: personas/trail-ultra
title: "Persona — trail and ultra runner (50K–100K, mountain or hilly)"
status: draft
confidence: low
evidence: [cohort, review, practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S7, PLAN-S12]
---

**Key takeaways**

1. **Time, not distance, is the unit.** A 50K in the mountains is 6–9 h of load; the same course in km
  terms plans a 3 h run and misses the event.
2. Weekly training time in the verified comparison: marathon runners **5.2 ± 0.9 h/wk** versus Ironman
  triathletes **12.9 ± 2.6 h/wk**. Ultra demands sit in that second region; a marathon-shaped volume
  plan is off by hours. [PLAN-S12 grade B cohort]
3. Vertical gain is a second load axis the generator must model; the flat-pace equivalents in
  circulation are folk heuristics, not measurements.
4. The two ultra-specific adaptations no road plan provides: **downhill eccentric tolerance** and
  **hours of low-intensity time on feet including hiking**.
5. Pacing discipline in an ultra is an *effort* rule with distance-blind checkpoints, because terrain
  makes pace meaningless.

## Facts

- Verified cohort comparison of well-trained endurance athletes' weekly training time: marathon
  5.2 ± 0.9 h vs Ironman 12.9 ± 2.6 h. It is a triathlon study, not an ultra study, and is used here
  only to bound "how much time an event of ~12–16 h actually requires". [PLAN-S12 grade B]
- The injury literature's training-error findings (rapid load rise, most-studied modifiable risk,
  inconsistent effect sizes) apply to ultra runners with more force, because ultra volume grows in
  **hours** where a 10% weekly step is 90+ minutes. [PLAN-S7 grade A review, extrapolated — label as
  such]
- Intensity-distribution evidence for ultra runners is **not** represented by any verified source in
  this knowledge base; the studied populations run 5–7 sessions on flat ground. Ultra distribution is
  assumed pyramidal-by-necessity (most time is hiking/easy) rather than prescribed. [PLAN-S2 gap]

## Practice

### Load modelling

```yaml
primary_load_unit: minutes
secondary_load_unit: metres of ascent      # both recorded per session and per week
flat_equivalence_heuristic: "100 m ascent ≈ +1 km of flat effort"   # grade D folk rule, display only, never a hard input
hard_rules:
  - "no weekly ascent increase > 25–30% while weekly time grows"
  - "longest session time, not distance, defines the plan's peak"
  - "one long session ≥ 60% of race duration is the durability marker; 2 such sessions per block"
```

### Week and block

- 4–6 sessions; the long one is 2.5–5 h on trails, done **with the hiking plan the race will use**
  (practice switching to walking on steep grades rather than forcing a run).
- Second-longest run 90–120 min with hill repeats inside it; keep hills all year — they are the
  ultra-specific quality session and cost less recovery than track intervals.
- Downhill dosing: 20–40 min of controlled descent per long run from 8 weeks out, growing in the same
  step cycle as volume. Eccentric soreness after the first two exposures is expected; soreness that
  lasts > 48 h means the dose jumped.
- Distribution: mostly easy, one hill/quality day, one long day. Do not import a road "80/20" number;
  keep high-intensity time low and let the long days carry the volume. [PLAN-S2 caution]
- Terrain and surface: ≥ 2 long runs per block on the race-like surface (technical, rooty, loose);
  road-only long runs do not prepare ankles or attention.
- Race rehearsal: same shoes, same pack, same cap/hydration, and the **user's own** fuel routine. The
  app may schedule "rehearse your routine" but prescribes no amounts, products, or grams — that is a
  nutrition question, out of product scope (AGENTS rule 6).

## Controversies

- **Should an ultra plan look like a marathon plan with a longer long run?** Broadly no — the limiter
  is hours and terrain, not VO₂max; yet some coaches still prescribe weekly MP-style blocks. Engine
  treats MP as a small, occasional element for 50K racers only. status: contested
- **Vertical equivalence formulas** (grade D) are everywhere and unvalidated; some coaches use
  "1 m ascent = 10 m flat", others use metabolic models. The generator records ascent as its own axis
  and avoids converting. status: contested
- **Hiking in training**: stigmatised by road-trained runners, correct technique for steep race grades.
  Programmed explicitly as "power hike 8–12% grade, 4 × 4 min" so it reads as a workout. status:
  contested (mostly a status problem, not a physiological one)
- **Racing twice a month** is normal in trail culture and hostile to any load model. B/C race rules
  from `periodization/phase-transition-rules.md` apply, and the plan labels such races "not a peak".

## Escalate to a clinician

Ultra-specific red flags the plan does not try to manage: repeated GI failure during long sessions,
dark urine or reduced urination after a long effort, unexplained swelling, numbness or a foot that
will not lift, a headache with confusion at the end of a long hot effort, or any collapse. Also the
usual chest pain / palpitations / syncope rules. Heat and altitude questions are clinician questions,
not pace adjustments.

## Plan shape

```yaml
weeks: 12–16 (16 if the race > 12 h or first ultra)
sessions_per_week: 4–5
hard_days: 1–2 (hills, not track intervals)
weekly_time_target: "5–11 h/wk peak depending on race duration; warn above 12 h/wk for non-elite"
peak_longest_session: "60–75% of expected race time, capped at 4.5–5 h for non-professionals"
step_cycle: "3:1 (2:1 for masters or after any injury)"
shape_5_day:
  - {tue: "hills 8×75″ uphill, trail or treadmill 10% grade | or tempo 25′"}
  - {wed: "easy 45–60 road or trail, Z1"}
  - {thu: "easy 45–60 + 6 strides, off-road preferred"}
  - {sat: "long trail 120–300 min, hiking plan practised, 20–40 min controlled descent"}
  - {sun: "recovery 40–60 easy OR rest (back-to-back only in Specific, ≤ 2 weekends per block)"}
durability_markers: ["2 sessions ≥ 60% race duration", "1 weekend with long run + next-day easy run"]
races: {b_race: "a 25–35K trail race 6–8 weeks out as the rehearsal, counted as the week's long run"}
taper: {days: 21, cut: "cut time and ascent, keep hill touches and frequency", last_hard_days_out: 10}
```

## Typical self-inflicted errors

- Planning the long run in km and discovering at km 30 that the race is another 2 h away.
- Adding vertical every week alongside time, so tissue load rises twice as fast as the plan thinks.
- Zero downhill practice, then a quad-destroying first descent at km 45.
- Turning every trail run hard because "trails are already a workout" — the junk-mile pattern with a
  nicer view.
- Racing a second ultra 3 weeks after the A race, then arriving at the next block injured.
- New gear on race day: shoes, pack, or pole technique never rehearsed on a long run.
- Copying a road marathon plan's MP blocks into a 100K.

## Messaging tone

- Speaker-to-speaker about terrain: name the hill, the surface and the weather; this persona trains
  outside and resents road-centric language.
- Permission-giving about walking and effort: "on anything over ~12% you should be walking; that is the
  technique, not a failure."
- Numbers in hours and metres, not pace. Pace language only on flat repetitions.
- Do not say: "just keep it under 5:30", "the pace doesn't matter, keep going" (unsafe on mountain
  terrain), any guarantee about finishing, or anything minimising heat/altitude risk.
- Examples (EN):
  - "Saturday: 3 h 15 with 900 m of ascent, walk every steep grade, and take the descents under
    control rather than fast. Sore quads on Monday are expected; sore on Thursday means I'll shorten
    the next one."
  - "You logged the long run as 'easy, 4 h'. That is the workout this block is built around, so log it
    with the ascent — it changes what I plan next."
- 繁體中文（語氣：具體、重視地形）：
  - 「週六：3 小時 15 分、累積上升 900 公尺。陡坡就用走的，那是技術不是放棄；下坡求穩不求快。」
  - 「你把 4 小時的長跑記成『輕鬆』。這正是本週期的核心課，請一併記錄上升高度，我會據此安排下一週。」

## Review sensitivity

- **Low sensitivity to pace signals (they are meaningless here), high sensitivity to time, ascent and
  recovery duration.**
- Strong triggers: soreness > 48 h after a long run → cut the next long run 25–30% and hold ascent flat.
  Weekly ascent + time both up and completion < 80% → cut ascent first. Any GI or heat report during a
  long session → add a rehearsal session with the user's routine and shorten the next long run.
- Weak triggers to ignore: slow pace on a hilly day, a hike-heavy long run, one missed midweek run.
- Reviews here should most often **re-balance** (shift ascent vs time) rather than reduce everything:
  an ultra runner who loses all vertical loses the race-specific stimulus.
