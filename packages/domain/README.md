# packages/domain

Shared vocabulary: training day boundaries (local 04:00 to 04:00), session classes, signal records,
feedback taxonomy, plan version and diff types, error codes, i18n message keys. No business rules and
no numbers -- numbers belong to `knowledge/heuristics/`, decisions belong to `packages/planner-core`.

Also owns the two guards everything else leans on: the tz-aware training-day helper
(`docs/ux/calendar-and-time.md`) and the number-grounding check that rejects an LLM output containing a
number absent from `allowedNumbers` (`docs/adr/0007`).
