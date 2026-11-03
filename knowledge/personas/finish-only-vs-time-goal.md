---
id: personas/finish-only-vs-time-goal
title: "Goal mode — finish-only vs time goal: what changes in the plan and in the language"
status: draft
confidence: medium
evidence: [review, practitioner]
applies_to: [onboarding, plan-generator, review-engine, feedback]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: [PLAN-S2, PLAN-S4, PLAN-S5]
---

**Key takeaways**

1. `finish_only` is a **goal mode**, not a persona: it composes with every persona (novice, masters,
  time-poor). It changes dose, language and review thresholds — not the architecture.
2. Finish-only still needs intensity. Removing all intensity turns the plan into an unprepared long
  walk-run with an injury spike at the end; one quality session per week stays. [PLAN-S2, PLAN-S4]
3. A time goal is a **prediction with a band and an expiry date**, never a promise. The band's width
  comes from the evidence's age and extrapolation distance.
4. Both modes need the same rehearsal: the finish-only runner also has to survive 4 h on their feet and
  should know what that feels like.
5. Mode switches are explicit events with a recorded reason. The engine must not silently convert
  "I want to finish" into "you should run 4:50/km" because a parkrun went well.

## Facts

- The intensity argument is the same in both modes: in runners, the distribution that improved
  performance most kept high-intensity time low and *moderate* time low, i.e. one or two real quality
  days rather than daily medium effort. [PLAN-S4 grade B]
- The taper evidence is mode-independent: a finish-only marathon still gets the 2-week, 41–60%
  exponential reduction; what changes is only the intensity kept inside it. [PLAN-S5 grade A]
- There is no verified evidence in this knowledge base on goal framing and adherence in runners; the
  behavioural statements below are coaching reasoning (grade C, confidence low) and must not be quoted
  as motivational science. [Gap]

## Practice

### What `finish_only` changes

| Element | `time_goal` | `finish_only` |
|---|---|---|
| Quality sessions/wk | 1–3 by persona | 1 (2 on request), effort-anchored not pace-anchored |
| Race-pace work | dosed blocks | rehearsal only: 2–3 exposures of 20–40 min at a "race effort" |
| Long run | pace-structured | **time-on-feet** structured (e.g. 100 min continuous, no pace target) |
| Pacing language | bands, splits per km | effort + checkpoints ("could talk in sentences at km 30") |
| Cutoff awareness | usually irrelevant | required: entry cutoff, and expected finish time from the user's own easy pace |
| Review threshold | completion + quality execution | completion + "finished the long run feeling able to continue" |
| Taper intensity | short MP/race-pace touches | short effort touches, same frequency kept |

### What does **not** change

- Volume ceilings, growth rules, hard-stop safety rules, and rest-day sanctity — identical in both
  modes. A finish-only plan is not a licence for a 40% weekly jump.
- The requirement of one long-run rehearsal at ≥ 60% of expected race duration.
- Clinician-referral triggers and the no-diagnosis rule.

### Time-goal handling (the honesty rules)

1. Compute a **band** from the active evidence item (`plan-construction/measurement-and-testing.md`),
   never a single predicted time.
2. Compare band with goal and say which of three states applies:
   - **inside band** → normal build, goal is a plan input.
   - **at the edge** (≤ ~5% outside) → build unchanged, goal labelled "stretch", add a tune-up race.
   - **far outside** (> ~10%) → keep the goal visible, but generate a **two-track** Specific phase:
     Track A (attempt) and Track B (finish strong, decision at 10K/20K markers), and state the
     assumption in one sentence.
3. Recompute only on test evidence, never on feelings; when the band moves, say so in plain language
   and show the input that changed.
4. On race day, the goal becomes a **pacing plan plus a decision rule**, e.g. "if 10K in 49:30–50:15,
   hold; if faster, ease to band; if slower than 52:00, run the B race" — the numbers come from the
   plan, the LLM only phrases them.
5. A time goal with no registered race is allowed but must be labelled "target time trial" and needs a
   date; a floating time goal has no taper and no honesty check.

## Controversies

- **Does a finish-only plan need any structured intensity?** Yes by the distribution argument and by
  the practical fact that finishing a marathon is a moderate-intensity event for a slow runner — they
  will be at threshold for hours. Counter-view: minimal interference is kinder to a first-timer's
  adherence. Default: one low-cost quality session (hills or strides + a middle-mile section).
  [PLAN-S4] status: contested
- **Should the engine ever suggest a time goal?** Suggesting a *band* from evidence is honest;
  suggesting an *ambition* is a motivational nudge that can push volume up unsafely. Default: state the
  band only when asked, and never on a missed-session week. status: contested
- **Cutoff-driven training.** Some coaches build to the cutoff for slow finishers; others argue it
  invites overuse. The plan builds to the user's own comfortable long-run pace + 20% margin from the
  cutoff and shows the arithmetic. status: contested

## Plan shape

```yaml
# finish_only overlay (applied on top of any persona template)
overlay:
  quality_sessions_per_week: 1
  intensity_anchor: effort                  # talk test + RPE, pace bands hidden
  long_run_metric: minutes
  rehearsals:
    - {when: "6 wk out", session: "long run with 20 min at race effort in the middle"}
    - {when: "4 wk out", session: "long run, 2 × 15 min at race effort, 5 min easy between"}
    - {when: "2 wk out", session: "long run minus 30%, race clothes, user's own fuel routine"}
  checkpoint_language: ["start", "25%", "50%", "75%", "final"]
  review_signal: "finished the long run able to continue"
# time_goal overlay
overlay_time:
  band_source: "race_evidence[active]"
  tune_up_race: "required 5–7 wk out (half) or 4 wk out (10K)"
  two_track_if: "goal outside band by > 10%"
  race_day_artifact: "pacing plan + decision rules"
```

## Typical self-inflicted errors

- Finish-only user quietly adopts a time goal in week 3 and starts running the long runs fast —
  converting a plan into an unmanaged threshold block.
- Time-goal user trains the goal instead of the process: adds MP volume every week because the
  calendar feels unproductive.
- Both modes: deleting easy days rather than quality days when time is short (backwards).
- Chasing a "virtual race" screenshot pace on a treadmill in week 11.
- Finish-only user skipping all intensity, then hitting the wall at 30K with no durability.
- Choosing the goal from a friend's result rather than the user's own evidence item.

## Messaging tone

- `finish_only`: sensory and time-based, no split arithmetic anywhere. "Long enough that you'd be happy
  to keep going", "the last 20 minutes should feel like the middle". Never "just", never "only" — the
  word *only* makes the goal sound like a consolation.
- `time_goal`: precise, band-first, no hype. Numbers always with the assumption attached and the date
  of the evidence they came from.
- Both: never a guarantee, never a moral reading of a session, never body-composition language.
- Examples (EN):
  - finish_only: "Saturday is 2 h on your feet at a pace you could hold for another 30 min. No pace
    target — that is the whole point of this block."
  - time_goal: "From your 10K on 2026-10-18 the marathon band is 3:24–3:34. Your goal 3:20 sits outside
    it; the plan stays, and we'll re-check it after the half on 2027-01-17."
- 繁體中文：
  - 完賽型（語氣：不帶 split 數字）：「週六是 2 小時的持續時間，配速以『還能再跑 30 分鐘』為準。這堂課沒有配速目標。」
  - 目標時間型：「依你 2026-10-18 的 10K 成績推估，馬拉松區間約為 3:24–3:34。你的目標 3:20 在區間之外；課表不變，我們到 2027-01-17 半馬後再核對一次。」

## Review sensitivity

- `finish_only`: **low sensitivity** — reviews mostly hold. Trigger list: missed long run twice (move
  it, don't shrink the block), any pain, and "finished the long run completely spent" twice (cut the
  next long run 20%). A single easy-run miss is noise.
- `time_goal`: **high sensitivity to quality-session execution**, low to easy-run pace. Trigger list:
  two failed MP/threshold sessions → hold volume and repeat the session; a tune-up race result → recompute
  the band (an evidence change, the only legitimate reason to re-pace mid-block); race inside 3 weeks →
  no new intensity, no new distance.
- Mode-change requests: recorded as an explicit event with the user's stated reason, and the engine
  responds by re-deriving **future** sessions only (never rewriting history), keeping the change budget
  of ≤ 2 changes.
