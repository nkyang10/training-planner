---
status: draft
last_reviewed: 2026-11-04
---

# Phase control

The narrative of each milestone — why it exists, what ships, how long it takes — lives in
[../../roadmap/milestones.md](../../roadmap/milestones.md). This folder owns the part a document
usually leaves to memory: **state, order, and the evidence that closes a phase.**

One file per phase, `M0.md` … `M6.md`. The YAML front matter is the contract; the prose below it is the
reason. [`tools/check-phases.py`](../../../tools/check-phases.py) reads the front matter and enforces
everything below, so none of these rules is etiquette.

## The contract

```yaml
phase: M1                 # must equal the file name
title: Headless planner
status: active            # done | active | planned | blocked
depends_on: [M0]          # must be done before this phase can be active or done
owner: lead
last_reviewed: 2026-11-04
closed_on: 2026-11-04     # required when status is done
exit_criteria:
  - id: golden-plans      # unique within the phase
    requirement: 6/6 golden plans pass, and a rule change breaks exactly the fixtures it should
    evidence: manual:eval/golden-plans     # gate:<name> | ci:<job> | manual:<path>
    state: open           # done | open
```

## The six rules the gate enforces

1. **One active phase.** Exactly one `active`; every phase before it `done`, every phase after it
   `planned` or `blocked`.
2. **Dependencies first.** A phase may not be `active` or `done` while a phase it `depends_on` is not
   `done`.
3. **Done means closed.** `status: done` requires `closed_on` and every criterion `done`.
4. **Active means unfinished.** `status: active` requires at least one criterion `open` — a phase whose
   criteria are all done is lying about where the work is.
5. **Planned claims nothing.** A `planned` phase may not have a criterion marked `done`.
6. **A done claim is run, not read.** For `gate:<name>` the tool runs the gate and the claim fails with
   it. Names come from a registry inside the tool, so a phase file cannot ask it to run anything.

## Evidence kinds, and what each one actually proves

| Evidence | Proves | Does not prove |
|---|---|---|
| `gate:<name>` | the check ran here and passed | that the criterion is *sufficient*; a gate is a floor |
| `ci:<job>` | the job exists in `.github/workflows/ci.yml` | that its last run passed — the job's own check is that |
| `manual:<path>` | the reference exists (when the state is `done`) | that the sentence is true. That is a reviewer's job |

Being explicit about the third row is the point. A checklist that pretends to verify a coach's sign-off
is worse than one that says: a human signed this, and here is where they wrote it down.

## Closing a phase, and opening the next

One commit, because the gate allows exactly one active phase: mark every criterion `done`, set
`status: done` and `closed_on`, set the next file to `status: active`, run
`python tools/check-phases.py`, then merge through the spine as usual. Split the flip and there is a
moment on `main` where the control says the project is in no phase, or in two.

## What is not checked, and should not be pretended

A phase file names its spine branch in prose only; the tool does not talk to the remote, so "the spine
exists" is a claim for a human. Same for whether a manual reference says what the criterion asked.
