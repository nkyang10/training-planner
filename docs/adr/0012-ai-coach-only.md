# ADR-0012 — There is no human coach: the AI coach is the product, admin mode is read-only

- **Status:** accepted (2026-11-05)
- **Supersedes:** the parts of the earlier IA that implied a human coach handing work to a runner
- **Context:** the product owner reframed the app: no real coach exists in it. The runner reads the programme from the
  AI coach, asks for a programme on demand, and talks to the AI coach in real time. The AI coach may decide that a
  change is needed and tell the runner. At most, an administrator may review a runner's programme.

## Decision

1. **The AI coach is the only coach.** Navigation, copy and surfaces say "AI Coach". There is no roster, no assignment,
   no inbox, no human hand-off. The word "coach" alone means the AI.
2. **A programme is requested, not scheduled.** `Request a program` asks for 7, 14, 21 or 28 days. The deterministic
   planner generates the block from the stored profile and the runner's own recent kilometres; the web lands on the
   first week. The model never chooses a distance, even when the runner asks in chat.
3. **The conversation is the product's front door.** `Ask AI Coach` is a real conversation with context (100 turns /
   100,000 characters), photos, references and a rolling summary. It exists to understand the runner's need, not only
   to edit the programme.
4. **A change decision is announced, then decided by the runner.** When the coach decides a change is needed it sets
   `proposeReview`; with the opt-in the bounded review opens and the coach posts a stored decision message carrying the
   review id. The runner accepts, declines or defers; only acceptance activates a plan version. The AI may decide
   *that* something must change; it may not write *what* the new distance is.
5. **Admin mode is read-only.** `/admin/programs` (operator token) lets an administrator look up a runner's profile,
   plan, entries and reviews. There is no edit path, no impersonation and no cross-user read without the operator token.

## Consequences

- The runner's mental model is simple: ask for a programme, read it, talk to the coach, accept or decline changes.
- The audit chain survives the reframing: the plan still comes from the deterministic planner; the conversation still
  cannot invent a number; the admin can see but not rewrite.
- "Real-time talk" currently means turn-by-turn conversation, not token streaming; a streaming port is a UI change, not
  a contract change.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| A human-coach inbox / assignment | the product has no human coach; it would invent a role and a permission model |
| Let the AI write the programme numbers | violates ADR-0009 and destroys the golden-plan guarantee |
| Admin can edit a runner's plan | destroys consent and the audit row; read-only review is the boundary |
| Auto-accept every coach decision | removes the runner's decision; opt-in auto-**open** keeps the decision intact |
