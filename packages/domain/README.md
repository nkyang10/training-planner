# packages/domain

The zod mirrors of the contracts in `schemas/json/`, and the frozen TypeScript shapes the planner reads.

## Generated, not hand-written

`src/schemas.ts` is written by [`tools/gen-domain-schemas.mjs`](../../tools/gen-domain-schemas.mjs) from
the JSON contracts:

    pnpm gen:domain

**Never edit `src/schemas.ts` by hand.** A hand-written mirror of seven contracts is 300 lines of
transcription whose only reviewable property is "it looked right", and this repository has already paid
for that mistake twice: the wire and the DDL shared no value names for change kinds, and a day-entry
field existed that no column could store (see
[contract-vocabulary.md](../../docs/engineering/contract-vocabulary.md)). `schemas/README.md` rule 7
says the mirror is mechanical and codegen owns the spelling; this package is that rule made real.

When a contract changes: edit the JSON, run `pnpm gen:domain`, run `pnpm test`. The generator throws on a
JSON Schema keyword it does not implement rather than skipping it, because an unenforced constraint is
the exact failure mode this package exists to remove.

## Two kinds of type, and why both exist

- `src/schemas.ts` — the generated zod schemas and `z.infer` types. These follow the contract, including
  fields the planner does not read yet.
- `src/types.ts` and `src/entries.ts` — hand-written, **frozen** shapes the planner is written against.
  They are narrower on purpose: a rename in either direction is a compile error, and the compile error is
  the cheapest place to find out that a contract moved.

## The three gates that prove it

1. `test/fixtures.test.ts` — the 20 instances in `eval/contract-fixtures/` (8 valid, 12 deliberately
   invalid) must behave: valid ones parse, invalid ones do not, every contract has fixtures, and each
   parsed value is assignable to the frozen types (a compile-time assertion, not a runtime one).
2. `test/generated.test.ts` — regenerating must produce the committed file byte for byte, and parsing a
   valid fixture must not drop a key (the `.strict()`/`.passthrough()` failure mode that a round-trip test
   alone cannot see).
3. `pnpm typecheck` — the assignability above is enforced by the compiler, so a disagreement cannot be
   ignored.
