# packages/i18n

The words, and the formatter that fills them. No decisions, no guardrails that need to know what a fact means.

```ts
import { format, messagesFor, weekdayName } from "@training-planner/i18n";

messagesFor("zh-Hant").comment["acknowledge.completed"]; // "今天記錄了 {km} 公里。"
format("今天記錄了 {km} 公里。", { km: 12 });              // "今天記錄了 12 公里。"
weekdayName("zh-Hant", "2026-11-05");                     // "週四"
```

## Parity is a type, not a checklist

The catalogues are typed by the engine's own key unions (`FactTemplate`, `AdjustReasonKey`,
`AdjustCostKey`, `StopInstructionKey`, `SessionKind`), so:

- a template the engine can emit and a catalogue does not translate is a **compile error**;
- a catalogue key the engine cannot emit is a compile error too, which is what stops dead copy accumulating.

`test/i18n.test.ts` re-checks parity at runtime as well, because the two failures look different in
production: a missing translation is a crash, and a stale key is copy nobody notices is dead.

## The formatter refuses to guess

- an unknown `{slot}` throws; a missing slot throws — never an empty string that reads like a typo;
- numbers render with at most one decimal, no thousands separators: `12`, `2.5`, never `1,234.0`;
- whitespace collapses, so a template that drops an optional word does not leave a double space.

## Copy rules that live elsewhere

Tone, banned phrases, exclamation limits and script matching are enforced in
[`packages/narrator`](../narrator/README.md), because they need to know what a fact means. This package
holds the words, and the words are reviewed against
[`docs/ux/feedback-microcopy.md`](../../docs/ux/feedback-microcopy.md): second person, calm coach, no emoji,
one idea per sentence.

Chinese is authored, not translated (`docs/ux/feedback-microcopy.md#localization-integrity`). The one
deliberate exception is the medical referral copy, which switches to 「您」 because it is a clinical voice,
not a coaching one — the exception is recorded in the doc, not discovered in a diff. Terms the running
community uses in English (tempo, MP, strides, VO2max) stay English with a Chinese gloss, and
[`apps/web/messages/glossary.md`](../../apps/web/messages/glossary.md) is the single source of truth for
them.
