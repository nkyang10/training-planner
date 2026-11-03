---
status: draft
last_reviewed: 2026-11-03
---

# Safety layer

Runs **after** every planning pass and **after** every micro-adjustment. Structurally limited to
*removing or downgrading* load. It is the only component allowed to interrupt a runner outside
business hours, and the only one whose decision a tap cannot dismiss.

Rule source: `knowledge/heuristics/safety-hard-stops.yaml` (+ `knowledge/risk-and-safety/*` prose).
Rule changes are code changes with golden fixtures.

---

## 1. Three tiers

| Tier | Effect on plan | User interaction | Logging |
|---|---|---|---|
| `hard_stop` | remaining sessions in scope become rest/recovery; review opened | blocking card, must be acknowledged; **not** dismissible by a single tap | permanent record, exported in the season file |
| `constrain` | upper bound applied (no intensity above X for N days, no long run, no hills) | inline notice on affected days | change-log entry |
| `advise` | nothing changes | comment + suggestion | event only |

**Override path.** For `hard_stop`, the runner can choose "I understand, continue anyway" *only*
where the rule is advisory by nature (e.g. load-step ceiling). Rules tagged `non_overridable`
(chest pain, syncope, haematuria, suspected bone stress with night pain, fever with below-the-neck
symptoms, post-concussion) offer no continue button at all — only a referral message and a
"clearance logged" path where the runner records that a clinician said it is fine. That record is
kept, and clearance never re-adds the missed volume.

---

## 2. Pain triage

The triage is a *decision aid to stop*, not a diagnosis.

| Signal | Interpretation we may state | Action |
|---|---|---|
| 0–3/10, warms up, no change next morning | commonly training-tolerable | `advise`: monitor, keep easy days easy |
| 4–6/10, or changes gait, or worse next morning | load above current tolerance | `constrain`: drop the quality session, keep easy volume if pain-free; review opened |
| ≥7/10, focal bony tenderness, night pain, swelling, numbness | stop | `hard_stop` on that site; refer to a clinician |
| Any pain + unexplained load step in the last 2 weeks | dominant modifiable risk factor present | `hard_stop` + review that reduces, not shifts, the block |

Never: name an injury ("you have plantar fasciitis"), prescribe rehab exercises as treatment, or
offer "run through it" as an option the system recommends. Referral wording standard lives in
`knowledge/risk-and-safety/injury-risk-and-pain-triage.md`.

---

## 3. Non-negotiable structural guardrails (generator-level, always on)

Independent of any signal — a plan can never be generated that violates them:

1. At least one full rest day in every 7-day window (or the runner's explicit medical/religious
   calendar equivalent recorded in `fixedCalendar`).
2. No three consecutive high-stress days; no high-stress day immediately before a race or a
   non-negotiable key session.
3. Weekly volume increment clamped to `load-progression.yaml` range, with a stricter ceiling after
   any layoff ≥ 2 weeks (`returning-after-layoff`), and a stricter one for masters and for
   injury-history runners.
4. Down week every 3rd–4th week inside the content horizon, non-removable by any rule that wants
   to "make up" missed work.
5. Intensity distribution sanity: no week above the configured high-intensity share ceiling, and a
   4-week rolling window must stay inside the modelled band.
6. Long run ≤ ceiling by goal and background; a long run is never adjacent to a race.
7. Post-race: ≥1 recovery week with no quality sessions, before any new block.
8. Taper and race-week templates cannot be overridden to add load.
9. Hard sessions per week ≤ `hardSessionCapPerWeek`, whose maximum is capped by the engine — a user
   preference cannot license 4 VO2max sessions per week.
10. Any `healthFlag` requiring clinician sign-off (`pregnancy`, `cardiac_history`, `insulin-treated
    diabetes`, `under_18`, `RED-S_indicators`, `post_injury_return`) forces the *conservative* plan
    branch and a visible sign-off notice, regardless of goal pressure.

---

## 4. Conditions we do not plan through

The product stops generating forward intensity and refers instead, for: chest pain/pressure,
palpitations with dizziness, syncope or near-syncope, dyspnoea disproportionate to effort, blood in
urine, fever with below-the-neck symptoms, suspected bone-stress pain with night pain, a sickle-cell
or heat-exertional collapse event, pregnant users in a new high-intensity block without clearance,
and youth athletes in adult-volume plans.

### RED-S posture
Warning signals we can see (unexplained performance decline + high or rising load + reported appetite
loss + menstrual disruption + repeatedly "no legs") open a `high` review whose only options are
reductions, plus a referral message. The app **never** responds with weight targets, calorie
targets, or diet advice — those outputs are banned at the narrator guardrail level, in both
languages, not merely discouraged.

---

## 5. Product-level posture

- Every generated plan shows, in the plan header: *"This is a training tool, not medical advice.
  Conditions marked ⚕ need clinician clearance."* (bilingual, in the exported file too).
- Season export includes the safety record: what was flagged, when, what the runner chose, and what
  was recorded as clearance. A physio receiving that export should be able to reconstruct the
  loading history in minutes.
- Liability framing in terms of service: the system provides information and pattern detection; the
  runner and their clinician decide; `hard_stop` is a *recommendation with teeth*, not a device
  that can physically prevent a run.
- Heat and altitude: plans are adjusted down for expected temperature/humidity bands and for arrival
  at altitude (acclimatisation windows), and the reason is displayed — silently reaping the benefits
  of an environment the runner can see out of the window is a trust bug.
- Minors: no under-16 accounts; 16–17 requires guardian acknowledgement and volume caps
  (`guardrails-and-disclaimers.md` in `knowledge/risk-and-safety/`).

---

## 6. Testing the safety layer

Safety is a test suite, not a paragraph:

- **Property tests** (fast-check style) over generated plans: no plan in the corpus violates §3 —
  run thousands of randomised profiles, availability patterns and injury histories.
- **Adversary fixtures** in `eval/golden-plans/safety/`: a profile engineered to break each guardrail
  (e.g. 100 km/week requested from 25 km/week; "I have chest pain, give me intervals"; a user who
  logs 5 h sleep every night and demands a marathon PR). Expected output: the specific rule id that
  fired and the reduced plan.
- **Narrator banned-output tests**: a corpus of prompts/contexts asserting the banned categories
  never appear in the English or Traditional Chinese output, including when the user asks for them.
