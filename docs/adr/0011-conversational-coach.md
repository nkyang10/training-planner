# ADR-0011 — A conversational coach that keeps context but cannot edit the plan

- **Status:** accepted (2026-11-05)
- **Supersedes:** none; it extends ADR-0009 (the LLM only produces language) and ADR-0010 (changes are reviewable)
- **Context:** the runner asked to talk to the coach in a conversation, with the coach keeping context and giving
  opinions, and — when warranted — updating the programme.

## Decision

1. **A conversation is a first-class surface.** Messages are stored per runner (`coach_messages`) with role, text,
   creation instant and the hash of the fact snapshot the coach answered from. The last 12 turns are the context window;
   older turns stay stored but are not sent.
2. **The coach still may not choose numbers.** A reply is accepted only if every number in it appears in the fact
   snapshot or the question (`ungrounded-number`). The plan, the entries and the references are the only facts.
3. **The coach cannot edit the plan.** When a change is warranted the coach sets `proposeReview: true` with a reason
   code; the API opens the same bounded review the deterministic path opens. The runner accepts, declines or defers in
   the review sheet; only acceptance activates a plan version. "Immediately update the programme" therefore means
   *the coach opens the change now*, not *the model writes a distance*.
4. **Safety outranks training, in the conversation too.** Safety references are injected first; a medical topic ends
   with a clinician referral, and the reply may not diagnose.
5. **No links, no invented citations.** The reply validator rejects URLs; references travel with ids the audit row can
   verify.
6. **Budget and consent apply.** The conversation uses the same model port, the same consent switch and the same daily
   budget as the advisor. A missing consent means no model call, and the page says so.
7. **Retention:** messages are per-user and are deleted with the user; the snapshot hash is kept so a past reply can be
   explained, but the raw facts are re-derived from the plan and entries, not copied into the message row.

## Consequences

- The runner gets continuity ("last time you said the knee was 3/10") without a vector database: the facts are rebuilt
  from the plan and entries on every turn, and the hash proves which snapshot the reply used.
- The coach's "opinion" is language over facts; its "update" is a review the runner decides. There is no path where a
  chat message silently rewrites a future day, and no path where it touches a past day.
- A free-form model that writes distances would still fail the validator, so the product cannot regress into an
  ungrounded planner by prompt drift.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| Let the model apply changes directly | violates ADR-0009/0010, destroys the audit row and the ≤2-change budget |
| Embed the whole plan in every prompt | cost and leakage; the snapshot + hash is smaller and explainable |
| A vector store of past chats | the facts are structured and re-derivable; embeddings add a second, unauditable source |
| Allow links in replies | the model would cite pages it never read; references must be repository ids |
