---
status: draft
last_reviewed: 2026-11-04
---

# Feedback microcopy & coaching tone

Every daily comment, chip, review verdict and nudge is a *voice* decision. This file is the contract
for both languages, and it is enforced by the narrator guardrails, not just by taste.

## The AIR contract (Acknowledge · Interpret · Redirect)

1. **Acknowledge** one concrete fact from today. If there is no concrete fact, say nothing.
2. **Interpret** it in plain language, with the confidence we actually have.
3. **Redirect** to what happens tomorrow and what to watch for.

Two to four sentences. One number per sentence maximum. Never three metrics in one breath — a tired
runner reads the first number and skips the rest.

## Tone register

| | English | 繁體中文 |
|---|---|---|
| Person | second person, direct ("you logged 6/10") | 第二人稱「你」,不用「您」(coaching intimacy, not customer service) |
| Voice | calm coach, low exclamation, dry humour allowed | 平實、溫暖但不煽情;不用驚嘆號堆疊 |
| Verdicts | named things name things ("this is too fast") | 直接但保留尊嚴:「這個進度对你的恢復太快了」 |
| Emphasis | sparing bold; italics for uncertainty | 少用粗體;不確定處用「可能」「看起來」 |
| Emoji | none in comments; glyphs only in UI states | 同左 |

Why 你 and not 您: the daily comment is a coach talking to an athlete they know, not a service desk.
Respect is carried by specificity, not by honorifics. (If we later add a clinical/physio voice for
referrals, that one switches to 您 — recorded as a deliberate exception.)

## Templates by situation

**Good day, plan as written**
> 12 km with the last 3 at marathon pace and effort at 5/10 — that's the exact response this block is
> built for. Tomorrow is rest; keep it boring.
>
> 12 公里,最後 3 公里跑馬拉松配速,自覺努力只有 5/10 —— 這正是這個週期要的反應。明天是休息日,維持輕鬆。

*(Note the deliberate failure mode we avoid: "Amazing job! You're crushing it! 🔥" — no fact, no
direction, and it trains the runner to chase praise.)*

**Missed session, benign reason**
> Work got the Thursday session — that happens, and it doesn't change the block. Friday moves to
> Saturday and the long run stays Sunday. Don't try to bank the distance back.
>
> 週四的課被工作吃掉了 —— 這會發生,也不會讓週期失控。我把週五的課移到週六,週日的長跑不變。不要把距離補回來。

**Illness**
> Fever and a chest cold stop the block, not the season. Rest until you're 48 hours symptom-free
> without medication, then 2 easy days before anything hard. If you get breathless at rest, or the
> fever lasts more than 3 days, see a doctor.
>
> 發燒加上胸部不適,這週的課先暫停 —— 暫停的是一個週期,不是整個賽季。症狀消失且不用退燒藥後再等 48 小時,然後先兩天輕鬆跑,再回到強度。如果靜止時會喘,或發燒超過 3 天,請就醫。

**Pain (triage, never diagnosis)**
> Knee at 4/10 that's worse the next morning means the load is above what it's tolerating right now.
> This week: no intervals, keep the easy runs if they're pain-free. If it hurts while walking, or
> there's night pain, stop and see a clinician — I can't tell you what it is.
>
> 膝蓋 4/10、隔天早上更緊,代表現在的負荷超過它能負荷的程度。這週不跑間歇;輕鬆跑如果不痛就跑。如果走路會痛、或晚上會痛,請停止並就醫 —— 我無法判斷那是什麼傷。

**Too-fast progression (the review teaser)**
> Three weeks up ~18% with legs at 4/5 four days in a row: the plan is ahead of your recovery. Worth
> a look before the tune-up race — I'll show you the options.
>
> 連續三週約 +18%,七天裡有四天腿部回饋 4/5:計畫的進度比你的恢復快。在热身賽之前值得重新檢視一次,我會把選項列給你看。

**Nudge (evening, one per day)**
> Two taps left for today. Effort and legs is enough.
>
> 今天還差兩個點選。填「自覺努力」和「腿部感受」就夠了。

**Honest silence** (rule fired with nothing specific) → emit nothing. Silence is a valid comment type
and keeps the ones that appear meaningful.

## Never say

| Category | Banned (examples) | Why |
|---|---|---|
| Diagnosis | "you have ITB syndrome", "looks like a stress fracture" | we triage and refer; a wrong label changes what a runner tells their doctor |
| Guarantees | "this will get you to 3:59", "you won't get injured" | we cannot promise; promising manufactures blame later |
| Energy/weight | any weight, calorie, "cut", "clean eating", "fasted to burn fat" framing | RED-S risk profile; banned in both languages at the guardrail layer, tested |
| Shame / moral load | "you skipped again", "no excuses", "champions don't miss sessions" | shame is the fastest way to end logging, and unlogged days are the days we need |
| Fake precision | "your VDOT is 46.3", "readiness 62%" | precision without evidence is a lie with a decimal point |
| Guilt-driven streaks | "don't break your 47-day streak!" | streak pressure turns sick days into runs |
| Toxic positivity on hard data | "listen to your body… but push through!" | contradicts our own safety model |
| Second-guessing the runner's life | "maybe prioritise better" | we don't know their constraints; we adapt around them |

Also banned: exclamation-mark stacking, ALL CAPS motivation, emoji in comments, quoting a runner's
own note back at them in a judgmental frame, and any comparison to other users ("runners like you").

## Rules the narrator enforces mechanically

1. Every number in the output must exist in the `FactObject` (exact match, formatted).
2. Max 4 sentences (en), max ~110 characters; zh-Hant max ~140 characters. Overflow → template path.
3. Language must match the user's locale (script check for CJK vs Latin).
4. Blocklist + category classifier for the banned set above; failure → deterministic template text.
5. `hard_stop` comments must contain a referral line when the rule is medical.
6. Readability target: ≤ grade 8 (en); for zh-Hant, prefer short clauses, avoid chained nominalisations,
   and never machine-translate an English idiom ("listen to your body" → 身體的訊號).
7. Units and formats are locale-aware: `5:45/km` vs `5:45 配速`, km/mi, 週一-first weeks, ISO dates in
   exports, and CJK punctuation (「」, ——, no full-width space before a Latin number).

Implemented in `packages/narrator` (`src/guardrails.ts`): grounding against
`commentFacts.allowedNumbers`, the banned categories as data with the promise each one protects, the
exclamation limits per locale, the script check, and slot completeness. Rules 6 and 7 are copy-authoring
rules and live in the catalogues (`packages/i18n`) with the glossary at
[`apps/web/messages/glossary.md`](../../apps/web/messages/glossary.md). Each guardrail has a failing case in
`packages/narrator/test/narrator.test.ts` — a guardrail that has never been red is a comment with a boolean
in front of it.

## Voice for the two other writers

- **Weekly summary**: slightly more reflective; allowed two numbers side by side; always includes
  what did *not* change.
- **Review verdict**: declarative and accountable ("the plan is too fast", not "consider perhaps
  possibly reviewing load"). The runner must be able to repeat the verdict to a friend in one sentence.

## Localization integrity

Chinese copy is authored, not translated: message keys carry a `tone_note` for each locale, and the
catalogues are reviewed together. Terms kept in English where the running community uses English
(-tempo, MP, strides, VO2max) with a Chinese gloss on first use per plan. A single glossary file
`apps/web/messages/glossary.md` is the source of truth for 配速 / 節奏 / 課表 / 週期 / 長跑 / 輕鬆跑
so two screens never call the same thing two names.
