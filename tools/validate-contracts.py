#!/usr/bin/env python3
"""Validate one instance per contract, and prove the contracts still reject bad ones.

Why this file exists: until 2026-11-04 nothing in this repository ever ran a contract. `schemas/`
was parsed by CI and compared by `tools/check-contracts.ps1` and `tools/check-vocabulary.ps1`, and
that is all - no machine had ever validated an instance against a schema, so a contract could be
"true" as a document and wrong as a gate (docs/engineering/contract-vocabulary.md item 23).

The fixtures live in eval/contract-fixtures/, one directory per contract, named after the schema
file without `.schema.json`. Inside a directory, every `*.json` file is an instance and the file name
decides the expectation:

    valid-*.json     must validate
    invalid-*.json   must NOT validate, and the rest of the file name says why
                     (invalid-outcome-done.json: the old wire word is no longer a value)

The ruler lives outside `schemas/` on purpose. So does the ratchet: every schema in schemas/json must
have a fixture directory, and every directory must hold at least one valid and one invalid instance,
because a gate that only ever sees valid input cannot tell "accepts everything" from "accepts what it
should". Missing coverage is a failure here, not a warning.

Exit 0 = every valid instance validated and every invalid instance was rejected. Exit 1 = otherwise,
and the mismatch is printed with the validator's own message.
"""

import json
import pathlib
import sys

try:
    from jsonschema import Draft202012Validator
except ImportError:  # pragma: no cover - the CI step installs it, the message is the fix
    print("RESULT: jsonschema is not installed (python -m pip install jsonschema)")
    sys.exit(1)

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT / "schemas" / "json"
FIXTURE_DIR = ROOT / "eval" / "contract-fixtures"


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def main():
    if not SCHEMA_DIR.is_dir():
        print(f"RESULT: schemas not found at {SCHEMA_DIR}")
        return 1
    if not FIXTURE_DIR.is_dir():
        print(f"RESULT: fixtures not found at {FIXTURE_DIR}")
        return 1

    contracts = sorted(p.stem.replace(".schema", "") for p in SCHEMA_DIR.glob("*.schema.json"))
    problems = []
    counts = {"valid": 0, "invalid": 0}

    for name in contracts:
        schema_path = SCHEMA_DIR / f"{name}.schema.json"
        directory = FIXTURE_DIR / name
        if not directory.is_dir():
            problems.append(f"NO FIXTURES      {name}: expected {directory.relative_to(ROOT)}/")
            continue

        schema = load(schema_path)
        validator = Draft202012Validator(schema)
        fixtures = sorted(directory.glob("*.json"))
        if not fixtures:
            problems.append(f"NO FIXTURES      {name}: directory is empty")
            continue

        kinds = set()
        for fixture in fixtures:
            expect_valid = not fixture.name.startswith("invalid")
            kinds.add("valid" if expect_valid else "invalid")
            instance = load(fixture)
            errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.path))
            got_valid = not errors
            counts["valid" if expect_valid else "invalid"] += 1
            rel = fixture.relative_to(ROOT)
            if expect_valid and not got_valid:
                detail = " | ".join(f"{'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}" for e in errors[:3])
                problems.append(f"SHOULD VALIDATE  {rel}: {detail}")
            elif not expect_valid and got_valid:
                problems.append(f"SHOULD REJECT    {rel}: the validator accepted it")
        for kind in ("valid", "invalid"):
            if kind not in kinds:
                problems.append(f"NO {kind.upper():<12} {name}: needs at least one {kind}-*.json fixture")

    print(f"CONTRACTS: {len(contracts)}")
    print(f"FIXTURES: {counts['valid']} expected-valid, {counts['invalid']} expected-invalid")
    print(f"MISMATCHES: {len(problems)}")
    for problem in problems:
        print(f"  {problem}")
    print("")
    if problems:
        print("RESULT: MISMATCH - a contract and an instance disagree, or the fixtures are incomplete")
        return 1
    print("RESULT: OK - every contract validated its good instance and rejected its bad ones")
    return 0


if __name__ == "__main__":
    sys.exit(main())
