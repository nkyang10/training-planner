# Glossary — one thing, one name

The source of truth for the words the product uses in both languages, so two screens never call the same
thing two names (`docs/ux/feedback-microcopy.md#localization-integrity`). Terms the running community uses
in English stay English, with a Chinese gloss on first use per plan.

| Concept | English | 繁體中文 | Note |
|---|---|---|---|
| pace | pace, `5:45/km` | 配速,`5:45 配速` | the unit follows the locale, the number does not change |
| tempo session | tempo | 節奏跑 | never 「節奏訓練」 in copy |
| plan / block | plan, block | 課表 / 週期 | a plan is what the runner sees; a block is a phase of it |
| long run | long run | 長跑 | |
| easy run | easy | 輕鬆跑 | |
| recovery run | recovery | 恢復跑 | a recovery run is not an easy run with a nicer name |
| quality session | quality session | 強度課 | the umbrella for tempo, VO2max, hills, MP |
| strides | strides | 加速跑 | kept short on purpose: 20 秒加速跑 × 6 |
| marathon pace | MP | 馬拉松配速 | MP stays in English in both |
| VO2max | VO2max | VO2max | never translated |
| rest day | rest day | 休息日 | a rest day is a day accounted for, not a hole |
| micro-adjustment | micro-adjustment | 微調 | the chip on tomorrow's cell |
| review | review | 重新檢視 | an offer to look, not an automatic rewrite |
| adherence | adherence | 持續度 | never 「意志力」 — that is a different, shaming claim |

## Rules

1. If a term is in this table, no screen may invent a synonym for it.
2. A new user-facing term is added here **in the same PR** that first uses it.
3. English idioms are rewritten, never machine-translated: "listen to your body" is 身體的訊號, not
   「聽你身體的話」.
4. Medical referral copy is the one place the register changes: it uses 「您」 (clinical), not 「你」 (coach).
