---
id: feedback-and-autoregulation/system-comment-playbook
title: Writing the daily system comment — what it must do, in what order, and when it must shut up
status: draft
confidence: high
evidence: [review, practitioner]
applies_to: [all]
last_reviewed: 2026-11-03
owner: fb-agent
supersedes: []
sources: [FB-S1, FB-S6, FB-S9]
---

## Key takeaways

- The comment has **one job: make the next decision obvious.** Not encouragement, not analysis, not
  accountability theatre.
- Fixed structure, variable language: **AIR** — *Acknowledge* (what happened, in their terms),
  *Interpret* (what it means, with the evidence and its limits), *Recommend* (one action for the next
  session, plus what would change my mind).
- It must be **generate-able from the fact object alone**, deterministically, with no model. The LLM
  is a stylist on top of it, never the author of a decision
  ([ADR-0007](../../docs/adr/0007-llm-language-only-with-template-fallback.md)).
- Silence is a valid output. A comment that says nothing new costs trust; the spec allows
  "no change, nothing to flag" as a one-line render — and it must be *rarely* used, or the loop dies.
- Length: **≤ 120 words**, ≤ 4 sentences, one number per sentence maximum.

## Facts — the contract

A comment is a pure function of `FactObject` + `locale` + `persona` + `narrator`
(template | LLM-styled). It must contain, in order:

1. **Acknowledge** — the fact, without evaluation. "Four kilometres, felt easy." Never "only", never
   "great job". The runner's own `statusDetail` is quoted back as context, not judged.
2. **Interpret** — the mechanism, at most one, always with the window and confidence:
   "two sessions in a row at RPE 7 when I prescribed 5 — your easy pace is probably too fast, or the
   week is hard." If evidence is insufficient, say so in the sentence: "I can't tell which yet."
3. **Recommend** — exactly one next action, and it must be one the engine has already put in the plan
   or an explicitly allowed micro-adjustment. Plus the *condition* that would change it: "if legs are
   ≤ 2 tomorrow, keep Thursday as written."

Then optionally: **one line of honesty** — what we do not know. This is the line that makes the rest
believable.

→ rule: `heuristics/daily-feedback-rules.yaml#comment-contract`

## Facts — what the comment must never do

| Never | Because | Enforcement |
|---|---|---|
| Invent or re-derive a number | numeric grounding is the whole safety argument for the LLM boundary | narrator validator: every number must exist in `FactObject` |
| Diagnose ("you have ITBS", "this is overtraining") | we cannot; [FB-S1] says there is no accepted marker | banned-category check, both locales |
| Promise a result ("this guarantees sub-4") | creates blame later, and is false | banned-category check |
| Mention weight, calories, or food | energy availability is a clinician's conversation ([FB-S2]) | banned-category check |
| Shame a miss or praise compliance as virtue | compliance framing collapses autonomy and adherence ([FB-S9]) | tone rules + review of catalogues |
| Add load as a consequence of a miss | the classic injury mechanism | the engine cannot emit it, so the narrator cannot say it |
| Comment on a day the runner has not logged | absence is not a fact about them | entry-status gate |
| Repeat yesterday's recommendation verbatim | proves nobody is reading | last-N similarity check, escalate to review flag instead |

→ rule: `docs/engine/safety-layer.md` (subtract-only) · `docs/ux/feedback-microcopy.md#never-say`

## Practice — templates by situation

Six worked bilingual examples live in
[docs/ux/feedback-microcopy.md](../../docs/ux/feedback-microcopy.md#worked-examples). The families:

| Family | Trigger | Interpretation to offer | Recommendation shape |
|---|---|---|---|
| `as-planned-good` | done, RPE in band, legs ≤ 3 | confirmation + the *next* structural step ("this is the second week at this volume; the step up is Saturday") | keep, or the planned progression |
| `as-planned-hard` | done, RPE above band | name the two candidate causes, do not pick without a repeat | next easy day explicitly easier; alternate offered |
| `partial` | partial completion | what was banked, not what was lost | continue as written; do **not** make it up |
| `skipped-intent` | skipped with work/travel/family | normalise, protect the week's structure | move, don't add: relocate the key session to the best remaining day |
| `skipped-motivation` | skipped, `just-didnt` / `motivation` | curiosity, not concern | offer the 20-minute version and the alternate; ask nothing |
| `pain-advise` | pain 4–6, no red flags | trend + what we are watching | downgrade today, keep the week, state the escalation rule |
| `stop` | red flag | stop, in plain words, first sentence | referral section, no training content |
| `streak-break` | 4+ day gap in logging | factual, no guilt | the smallest possible re-entry (a walk-run, 20 min) |

**`stop` overrides length rules**: the first sentence is the instruction, everything else is optional.

## Practice — tone across languages

The zh-Hant register is direct, warm, second-person 你, no exclamation marks, no coaching-slogan
voice. English avoids the American coach default of enthusiasm tokens ("Awesome!", "Let's go!"). The
shared requirement in both: **the interpretation sentence must be as long as the encouragement
sentence, or the comment is rejected in review.** Full register table:
[docs/ux/feedback-microcopy.md](../../docs/ux/feedback-microcopy.md#register).

## Controversies

- **Is a daily comment the right cadence?** It is the product's thesis, and it is unproven: adherence
  and commenting are confounded (a runner who logs is already engaged). The honest posture is
  [docs/roadmap/backlog.md](../../docs/roadmap/backlog.md#research-gaps-we-are-carrying-tracked-not-hidden)
  — measure it, do not assume it. If the daily comment is wrong for low-engagement users, the fix is
  *fewer, denser* comments (a skipped day may deserve silence, a week deserves a summary), not more.
- **How much mechanism to explain.** Novices need enough to learn; veterans are bored by it. Current
  stance: one mechanism per comment maximum, persona-tuned depth, and a "why?" affordance that opens
  the full rule and its source ids.
- **Personality level.** A distinctive voice is memorable and a strong voice on a bad day reads as
  cold. We keep the voice neutral-warm and let *specificity* carry the personality — the runner should
  feel read, not performed at.
