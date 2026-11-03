---
id: personas/postpartum-return
title: "Persona — returning to running postpartum (clinician-led, symptom-gated)"
status: draft
confidence: low
evidence: [practitioner]
applies_to: [onboarding, plan-generator, review-engine]
last_reviewed: 2026-11-03
owner: unowned
supersedes: []
sources: []
---

**Scope statement — read first**

This file is **not** medical guidance and the product does not decide when a postpartum runner may run.
The app's role is to (a) require clinician clearance before any running is scheduled, (b) express the
clinician's and pelvic-health physiotherapist's criteria as a graded, symptom-gated calendar, and (c)
keep the training record honest. No verified primary postpartum study was reviewed in this pass; the
practical framing below is **clinician-authored return-to-run consensus (grade C) with confidence low**
and may not be quoted as evidence. See `## Gaps to verify`.

**Key takeaways**

1. **Clearance first, then a plan.** No running session is scheduled until the user says a clinician
  has cleared them for running; the app records who cleared them and when, and does not evaluate the
  clearance.
2. Readiness is **symptom-gated, not calendar-gated**: the gates are symptoms during and after running,
  not weeks since birth and not fitness feel.
3. **Impact is the stressor**, not pace. Progression is graded exposure to impact (walk → walk/run →
  continuous run), and the volume of impact is the knob.
4. Any positive gate symptom stops progression and sends the user back to their clinician or
  pelvic-health physio — the plan never "works around" it.
5. Two things the plan must actively protect: **rest** and **the option of cross-training without
  guilt**. Sleep debt and caregiving schedule are load, and the plan must treat them as load.

## Facts

- No source in this knowledge base has been verified for postpartum return-to-run timing, diastasis
  recti, pelvic floor function, or breastfeeding and training. Therefore: **no numbers, no timeframes
  presented as evidence, no diagnosis, no guarantees.** [confidence low by construction]
- What is safe to state as product policy rather than physiology: the app never prescribes food,
  calories, or fluids; it never advises about medication; and it never interprets symptoms. Medical
  questions route to a clinician or a lactation consultant. [AGENTS rule 6]

## Practice

### Gate symptoms — progression stops and the user is referred

Any of these **during or after a run**, or on a day-to-day basis:

- Urine leakage, or a sensation of pelvic pressure, heaviness, or dragging.
- Abdominal coning/doming along the midline, or a new or widening midline gap the user notices.
- Low back, hip, or pubic pain; pain that changes gait.
- Vaginal bleeding that has restarted or increased with activity.
- Chest pain, palpitations, breathlessness out of proportion, dizziness or near-fainting.
- A caesarean or perineal wound that is painful, opening, discharging, or not yet reviewed.

Positive gate ⇒ the calendar stops progression (subtraction only, per AGENTS rule 3) and the message is
a referral, never a workaround: "This is a question for your clinician or a pelvic-health
physiotherapist. The plan will hold where it is."

### Graded impact ladder (the plan's actual structure)

Each step is held until the user reports no gate symptoms for **two consecutive weeks at that step**,
then advances one step — never two.

| Step | Content | Impact volume |
|---|---|---|
| 0 | Clearance pending: walking, mobility, breathing work as the clinician advised | none |
| 1 | Brisk walking 20–40 min, 3–5 days | none |
| 2 | Walk/run intervals, e.g. 8 × (60 s run / 90 s walk) | very low |
| 3 | 12–15 × (90 s run / 60 s walk), later longer runs | low |
| 4 | Continuous easy 15–25 min | moderate |
| 5 | Continuous 30–45 min, then normal weekly growth rules | normal |
| 6 | Only now: strides, then hills, then any threshold work | — |

- The ladder is **not** linear in time and it is legal to hold a step for months; the plan says so.
- Regression is not failure: after a positive gate symptom the calendar returns to the previous step,
  with the reason recorded and no change to any completed day.
- Core and strength work: prescribed only as "the program your physio gave you"; the app schedules it,
  never designs its content beyond generic bodyweight work already cleared.

### Intensity, heart rate, and other traps

- Population heart-rate formulas and pre-pregnancy HR zones are **not** valid here. Use effort and the
  talk test; re-baseline HR only after a clean test some weeks into step 5+.
- Heat, dehydration and sleep debt amplify everything: the engine may not schedule a key session on a
  night the user reported < 5 h sleep.
- Nutrition and milk supply are out of scope entirely; the plan may only say "eat and drink normally,
  nothing restrictive" and route the question.
- Mood and energy are monitored only as scheduling input, never interpreted. Persistent low mood,
  anxiety, or inability to function is a referral message with the specific suggestion to speak to a
  clinician or midwife — no screening questions, no assessment, no labels.

## Controversies

- **How soon after birth may running resume?** Public guidance and clinical practice vary; the app's
  position is that it is a clinician decision with symptom gates, and it deliberately shows **no
  timeline**. status: contested in the public domain; settled as policy here
- **Diastasis recti: barrier or normal phase?** Managed by a physio, not by a plan; the app must not
  prescribe specific "repair" exercises. status: out of scope
- **Is a structured plan useful at all this early?** Yes for record-keeping and honest pacing of impact;
  dangerous if it becomes a performance schedule. Hence step 0–3 plans contain no paces and no goals.
  status: contested (product decision)

## Gaps to verify

- Clinical guidelines on physical activity after uncomplicated vaginal and caesarean birth (candidate
  grade A sources: national physical-activity guidelines, obstetric/sports-medicine society position
  statements, and Cochrane reviews on postpartum exercise). The physiology & metrics scope has
  registered ACOG Committee Opinion No. 804 as [PHYS-S48] — grade C, publisher landing page, **not
  verified by this scope**, so this file cites nothing.
- Symptom-based return-to-run criteria and pelvic-floor outcomes in runners (candidates:
  British Journal of Sports Medicine, International Urogynecology Journal, physiotherapy-led cohort
  studies). Until verified, everything above stays confidence: low and grade C practitioner framing.

## Escalate to a clinician

Before any scheduled running: clinician clearance. Immediately, and regardless of the plan: chest pain
or palpitations, fainting, breathlessness at rest, a swollen painful calf, severe headache with
visual change, fever with breast redness, heavy bleeding, wound problems, or thoughts of self-harm
(seek urgent care now). For gate symptoms above: a clinician or pelvic-health physiotherapist. This
product does not diagnose, does not grade symptoms, and does not authorise return to impact.

## Plan shape

```yaml
precondition: {clinician_cleared: required, recorded_as: "cleared_by_user_on <ISO date>"}
weeks: open-ended (no goal date until step 4)
goal: none_until_step_4                # no race, no time goal in steps 0–3
sessions_per_week: 3–5 (walking days count as sessions for attendance)
hard_days: 0 through step 5
impact_metric: "run minutes per week"   # the only progression variable in steps 2–5
step_advance_rule: "2 clean weeks at the current step ⇒ +1 step (one change, recorded)"
step_hold_rule: "any gate symptom ⇒ hold or regress one step + referral line; never add intensity"
shape_step_3_example:
  - {mon: "walk 30 min + physio program"}
  - {wed: "walk/run 12 × (90 s / 60 s), total run time 18 min"}
  - {sat: "walk/run, run time 20 min, easy walk between"}
optional: {session: cross-training, notes: "bike/swim only if pain-free and cleared; never replaces impact steps"}
strength: {content: "as prescribed by the physio", app_role: "schedule only"}
```

## Typical self-inflicted errors

- Restarting at pre-pregnancy pace and distance because the first gym visit "felt fine".
- Reading a week-number as a permission slip ("it's been 12 weeks, so I can run a half").
- Ignoring leakage or heaviness as normal and unavoidable — it is the most important signal the app has
  and the one users most often skip in feedback.
- Doing high-intensity "postpartum workouts" from social media before any impact tolerance exists.
- Cutting food intake to get back to a pre-pregnancy weight while training: outside product scope, and a
  clinician conversation.
- Sleeping less, running more, and concluding the plan is too easy when the actual constraint is a
  3-month-old.

## Messaging tone

- Warm, unhurried, zero performance framing until the user is at step 4+. Attendance language only.
- Name the gate plainly and without alarm, and always pair it with the specific referral: "That's worth
  asking a pelvic-health physio about — the plan holds here."
- Never: "get your body back", "bounce back", "post-baby weight", "you're behind", or any timeline.
- Never congratulate weight; congratulate the *choice to hold a step*: "Holding this step was the right
  call."
- Examples (EN):
  - "Three clean weeks at this step, so the run time goes from 12 to 15 minutes total. Same number of
    days, same easy effort."
  - "You mentioned leaking after the run. That's a question for a clinician or a pelvic-health
    physiotherapist, and it's not something to train through. Week stays exactly as it is."
- 繁體中文（語氣：温和、不設時程、不評價身體）：
  - 「這個步驟連續兩週都沒有不適，所以總跑步時間從 12 分鐘增加到 15 分鐘。次數不變，強度不變。」
  - 「你提到跑後有漏尿的情形。這需要問醫師或骨盆底物理治療師，不是硬撐就能解決的訓練問題。本週課表維持原樣。」

## Review sensitivity

- **Highest sensitivity to gate symptoms; zero sensitivity to performance.** A single gate-symptom
  report outweighs any amount of good attendance data.
- Reviews in steps 0–3 are **subtraction-only**: hold, regress, or move a session. No review may add
  run minutes, intensity, or days in those steps.
- Ignore for planning purposes: slow paces, walk breaks, inconsistent HR, "felt easy", one missed
  session, and any mood statement that is not persistent (persistent → referral, still no plan change).
- Standard review output in this persona: **"Nothing changes this week, and that is progress."**
