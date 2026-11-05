# AI-coach revamp — design review (2026-11-05)

## The product, restated

There is no human coach. The runner reads the programme from the AI coach, asks for a programme when they want one,
and talks to the AI coach in real time. The AI coach may decide that a change is needed and tell the runner. An
administrator may review a programme, never edit it. ADR-0012 is the decision record.

## What changed against the previous IA

| Previous | Revamped | Why |
|---|---|---|
| "Coach" nav and "Coach conversation" | **AI Coach** | the word must mean the model, not a person |
| Plan generated only by the setup wizard | **Request a program** on the week page: 7/14/21/28 days | the runner asks; the deterministic planner answers |
| Chat as a side panel | **AI Coach is a first-class page** with context, photos, references, summary | conversation is the front door, not a utility |
| Change opened by a button after a reply | coach posts a **decision message** carrying the review id (opt-in auto-open) | the AI tells the runner what it decided |
| "Console" | **Admin** with `/admin/programs` read-only | at most an administrator reviews, never edits |

## Flow, end to end

1. **Setup** (`/wizard`) once: goal, level, days, long-run day. Stored as a profile revision.
2. **Request a program** (week page): days selector → `POST /program/request` → API `POST /plan` → week view.
3. **Read the programme**: week grid, month grid, day detail, season.
4. **Log the day** and read the system comment.
5. **Ask the AI coach** (`/coach`): conversation with context; attach a photo of an injury or a record.
6. **A change decision**: the coach sets `proposeReview`; the opt-in opens the bounded review; a stored decision
   message links the review; the runner accepts/declines/defers.
7. **Admin** (`/admin/programs`, operator token): read profile, plan, entries, reviews for a runner id.

## Boundaries kept on purpose

- The planner stays pure; the AI coach never writes a distance, pace or threshold.
- Safety can only subtract; the conversation cannot override a hard stop.
- Admin mode has no write path and no impersonation.
- Real-time talk is turn-by-turn today; streaming is a UI improvement, not a new contract.

## Honest gaps

- Voice input/output is not built.
- Streaming tokens are not built.
- The demo model is text-only; vision plumbing exists but needs a vision model.
- A weekly-note record is still the one buildable backlog item outside this revamp.
