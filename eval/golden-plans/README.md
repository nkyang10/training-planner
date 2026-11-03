# eval/golden-plans

The planner's specification in fixtures. Pending M1 (backlog row 1): one fixture per persona
(`competitive-amateur-marathon`, `masters-40plus`, `time-poor-3-days`, `returning-after-layoff`,
`trail-ultra`, plus `regression/` and `safety/`), each a frozen input bundle with coach-annotated
expectations: which days are hard, where the gap sits, what must be refused.

A fixture records the knowledge bundle version it was produced with. A golden plan that fails is a bug
or a deliberate decision, never a rebaselined expectation.
