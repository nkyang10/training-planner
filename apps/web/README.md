# apps\web

The per-user web client: calendar, five-tap daily entry, the system comment, and the review sheet.
Screens and their states: `docs/ux/screens.md`; navigation: `docs/ux/information-architecture.md`;
exact wording including the escalation text: `docs/ux/feedback-microcopy.md`.

Two rules the UI is not allowed to break: a review always shows "keep as is" first with a visible diff
and a stated cost, and no screen shows a weight, a calorie, or a diagnosis (rule 6). All strings come
from the message catalogue in `en` and `zh-Hant` (rule 8).
