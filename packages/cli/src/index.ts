#!/usr/bin/env node
/**
 * planner gen | diff | explain - the smallest surface that exercises the whole engine.
 *
 * A CLI exists before a UI on purpose: it is the only consumer that can run in CI, and it makes the
 * planner's output diffable in review. Implemented in M1 against the frozen signature.
 */
console.error("planner: not implemented yet (M1 in progress)");
console.error("usage: planner gen --fixture <eval/golden-plans/*.json> | diff | explain");
process.exit(1);
