---
id: red-flags-for-escalation
type: reference
status: draft
tags: [safety, red-flags, referral, triage]
sources: [FB-S1, FB-S2, FB-S3, FB-S5]
last_reviewed: 2026-11-03
owner: fb-agent
---

# Red flags: the list the safety layer actually stops on

**Bottom line:** one page, deliberately short, because a longer list gets ignored by the engine and by
the runner. Every entry is either **stop now and seek care** or **stop training and get assessed**.
Anything not on this list is a *training* decision and belongs in another file. Machine copy:
[../heuristics/safety-hard-stops.yaml](../heuristics/safety-hard-stops.yaml).

## Stop now, seek urgent care (do not "run it off")

| Flag | Why it is on the list |
|---|---|
| Chest pain/pressure, or pain radiating to arm/jaw | Cardiac until proven otherwise |
| Syncope, near-syncope, or dizziness with collapse during or right after a run | Exertional syncope is a workup, not a dehydration story |
| Palpitations **with** dizziness, chest discomfort, or breathlessness | Arrhythmia until proven otherwise |
| Breathlessness at rest, or at a workload that was previously easy, with no illness explanation | Needs assessment, not a slower pace |
| Fever, or illness with chest symptoms or below-neck/GI symptoms | Training through systemic illness is the classic harm; [FB-S1] |
| Sudden focal swelling, deformity, inability to weight-bear | Fracture/acute injury |
| Coughing blood, black stools, blood in urine after a run | Not a training question |
| New severe headache with visual change, or headache with neck stiffness | Medical |
| Pregnancy with bleeding, pain, or fluid leak | Obstetric emergency — the plan is irrelevant ([../personas/postpartum-return.md](../personas/postpartum-return.md)) |

## Stop training and get assessed (same-day or within days)

| Flag | Why |
|---|---|
| Pain that alters gait, or limping to finish | Gait change redistributes load onto tissue that is not adapted |
| Pain present **at night** or at rest, or point tenderness on bone | Bone-stress continuum ([injury-risk-and-pain-triage.md](injury-risk-and-pain-triage.md)) |
| Pain ≥ 7/10, or ≥ 4/10 with next-morning worsening that is rising across 3 reports | Escalating, not adaptive |
| Performance decrement ≥ 2 weeks with elevated resting HR + sleep/mood change | Non-functional overreach pattern; treatment is reduced load ([FB-S1]) |
| Menstrual disruption, or a REDs flag pattern (declining performance + fatigue + recurrent illness) | Low energy availability is the driver; **reduce load and refer** ([FB-S2], [FB-S3]) |
| Unexplained weight loss with fatigue, or resting HR up > 7 bpm sustained | Systemic cause until excluded |
| Repeated same-site pain returning every time load rises | The plan cannot fix a load-intolerance problem it keeps recreating |
| Postpartum: urinary leakage, pelvic pressure/pain, or diastasis symptoms with impact | Symptom-gated return, clinician-led ([../personas/postpartum-return.md](../personas/postpartum-return.md)) |
| Masters (40+): any new chest/breathlessness symptom, or a first-ever abnormal reading on a device | Zone maths is invalid until cleared ([../heuristics/medical-flags.yaml](../heuristics/medical-flags.yaml)) |

## What the product does when a flag fires

1. Sentence one is the instruction, in the runner's language. No praise, no plan talk, no training
   alternative in the same comment. The canonical wording is
   [../../docs/ux/feedback-microcopy.md](../../docs/ux/feedback-microcopy.md#stop); the shape is
   [../feedback-and-autoregulation/system-comment-playbook.md](../feedback-and-autoregulation/system-comment-playbook.md).
2. Today's session and every quality session in the horizon are removed. Nothing is substituted, and
   nothing is added later to compensate.
3. `referral()` is emitted with a level (`urgent` / `routine-urgent` / `sports-medicine`) and a
   **question to ask a clinician**, because the useful thing we can do is help the runner describe the
   problem well: onset, site, what changed it, night pain, load in the last 4 weeks.
4. The runner may keep easy movement **only** where the flag is not cardiac/systemic and they say they
   feel able — recorded as their decision, never as our recommendation.
5. A flag never produces a diagnosis or a condition name. We describe patterns ("this pattern usually
   needs an in-person assessment"), never labels — the OTS consensus is explicit that there is no
   accepted diagnostic test ([FB-S1], [FB-S5]), and the REDs tool is a triage instrument for
   non-clinicians, not a diagnosis ([FB-S3]).

## Anti-list (things that are *not* red flags)

Muscle soreness that eases with warm-up · a single bad sleep night · one session above target RPE ·
a missed week during a busy period · a slow 4-week progress trend with a device-derived V̇O₂max change ·
a vendor "recovery time" number. Treating these as emergencies is how a coaching app loses credibility —
and how runners learn that rest days are negotiable.

## Gaps to verify

- The above-neck/below-neck illness rule is long-standing practice with weak trial evidence; retained at
  `confidence: medium` ([../sources/bibliography.md](../sources/bibliography.md) [FB-S8] placeholder).
- No verified source for a specific resting-HR deviation threshold as a red flag; the ">7 bpm sustained"
  figure here is our knob, in `medical-flags.yaml`, range-bounded, and labelled as ours.
