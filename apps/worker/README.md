# apps\worker

Scheduled and queued jobs: nightly plan generation for the next 14 days, signal recomputation at the
training-day boundary, the 72 h backfill window close, review-expiry sweep, and the LLM narration call
(which receives a fact object and returns language only).

Every job passes the knowledge bundle version and a fixed clock into planner-core, so a rerun of an
older night reproduces the plan that night produced.
