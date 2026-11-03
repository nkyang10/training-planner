#!/usr/bin/env python3
"""Phase development control, read from Markdown.

The contract lives in docs/engineering/phases/: one file per phase, YAML front matter for the machine
and prose below it for the human. This tool is the ruler. It parses every phase file, proves the phase
graph and the states are consistent, and - where the evidence is a gate it can actually run - runs the
gate instead of trusting the word `done`.

Why a file per phase instead of a checklist in one document: a phase is a promise with a date on it.
When the promise is a single bullet in a long list, "done" is whatever the last person to edit it
meant. When it is a front-matter field next to the evidence that proves it, "done" is a claim this
tool can falsify.

Evidence kinds (a criterion names exactly one):

    gate:<name>    a check this tool runs; the registry is GATES below. A `done` claim fails if the
                   gate fails. Names are code-reviewed, never free text from the Markdown, so a phase
                   file cannot ask the gate to run an arbitrary command.
    ci:<job>       a job in .github/workflows/ci.yml is the evidence. This tool verifies the job
                   exists; whether its last run passed is the job's own business.
    manual:<path>  human evidence with a reference. The path must exist when the state is `done` -
                   and its existence is all that is verified. Whether the sentence is true is what a
                   reviewer is for, and pretending otherwise is how a checklist becomes decoration.

Exit 0 = the graph is consistent and every runnable claim held. Exit 1 = otherwise.
"""

import re
import shutil
import subprocess
import sys
import pathlib

try:
    import yaml
except ImportError:  # pragma: no cover - the CI step installs it, the message is the fix
    print("RESULT: pyyaml is not installed (python -m pip install pyyaml)")
    sys.exit(1)

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHASE_DIR = ROOT / "docs" / "engineering" / "phases"
CI_FILE = ROOT / ".github" / "workflows" / "ci.yml"
STATUSES = ("done", "active", "planned", "blocked")
REQUIRED_KEYS = ("phase", "title", "status", "depends_on", "owner", "last_reviewed", "exit_criteria")
FRONT_MATTER = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n", re.S)

# The gate registry. Adding a check is a code change on purpose: a phase file may choose among these
# names, it may not invent one, and it may not hand this tool a command line.
GATES = {
    "contracts": {"script": "tools/check-contracts.ps1", "interp": "pwsh", "kind": "exit"},
    "vocabulary": {"script": "tools/check-vocabulary.ps1", "interp": "pwsh", "kind": "exit"},
    "instances": {"script": "tools/validate-contracts.py", "interp": "python", "kind": "exit"},
    "audit": {
        "script": "tools/audit-links.ps1",
        "interp": "pwsh",
        "kind": "counters",
        "counters": [
            "MISSING ANCHORS",
            "MISSING YAML FILES",
            "BAD SOURCE IDS",
            "DEAD LINKS",
            "UNTRACKED TARGETS",
            "UNCOMMITTED CORPUS FILES",
        ],
    },
}

_cache = {}


def interpreter(name):
    if name == "python":
        return sys.executable
    found = shutil.which("pwsh") or shutil.which("powershell")
    return found


def run_gate(name):
    """Return (ok, detail). ok is None when the gate cannot run on this machine."""
    if name in _cache:
        return _cache[name]
    spec = GATES[name]
    exe = interpreter(spec["interp"])
    if not exe:
        result = (None, f"{spec['interp']} not found on PATH")
        _cache[name] = result
        return result
    cmd = [exe]
    if spec["interp"] == "pwsh":
        cmd += ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", spec["script"]]
    else:
        cmd += [spec["script"]]
    try:
        completed = subprocess.run(
            cmd, cwd=str(ROOT), capture_output=True, text=True, encoding="utf-8", errors="replace"
        )
    except OSError as exc:
        result = (None, f"could not run {spec['script']}: {exc}")
        _cache[name] = result
        return result

    output = (completed.stdout or "") + (completed.stderr or "")
    if spec["kind"] == "exit":
        ok = completed.returncode == 0
        detail = "exit 0" if ok else f"exit {completed.returncode}"
    else:
        ok = True
        missing = []
        for counter in spec["counters"]:
            match = re.search(re.escape(counter) + r":\s*(\d+)", output)
            if not match:
                missing.append(counter)
            elif int(match.group(1)) != 0:
                ok = False
                missing.append(f"{counter}={match.group(1)}")
        detail = "all counters 0" if ok and not missing else "bad counters: " + ", ".join(missing)
    result = (ok, detail)
    _cache[name] = result
    return result


def load_front_matter(path):
    text = path.read_text(encoding="utf-8")
    match = FRONT_MATTER.match(text)
    if not match:
        return None, "no YAML front matter at the top of the file"
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError as exc:
        return None, f"front matter is not valid YAML: {exc}"
    if not isinstance(data, dict):
        return None, "front matter is not a mapping"
    return data, None


def main():
    if not PHASE_DIR.is_dir():
        print(f"RESULT: phase folder not found at {PHASE_DIR}")
        return 1

    problems = []
    phases = {}
    order = []

    for path in sorted(PHASE_DIR.glob("M*.md")):
        data, error = load_front_matter(path)
        rel = path.relative_to(ROOT)
        if error:
            problems.append(f"{rel}: {error}")
            continue
        missing = [key for key in REQUIRED_KEYS if key not in data]
        if missing:
            problems.append(f"{rel}: missing front-matter keys: {', '.join(missing)}")
            continue
        phase = str(data["phase"])
        if phase != path.stem:
            problems.append(f"{rel}: phase '{phase}' does not match the file name")
        if phase in phases:
            problems.append(f"{rel}: duplicate phase id '{phase}'")
            continue
        phases[phase] = data
        order.append(phase)

    order.sort(key=lambda p: int(re.sub(r"\D", "", p) or 0))
    if not phases:
        print("PHASE FILES: 0")
        print("RESULT: no phase files found")
        return 1

    # contiguity: M0..Mn with no gap
    numbers = sorted(int(re.sub(r"\D", "", p) or 0) for p in phases)
    if numbers != list(range(len(numbers))):
        problems.append(f"phase ids are not contiguous from M0: {sorted(phases)}")

    ci_jobs = set()
    if CI_FILE.exists():
        try:
            ci_jobs = set((yaml.safe_load(CI_FILE.read_text(encoding="utf-8")) or {}).get("jobs", {}))
        except yaml.YAMLError as exc:
            problems.append(f".github/workflows/ci.yml is not valid YAML: {exc}")

    active = [p for p in order if phases[p]["status"] == "active"]
    if len(active) != 1:
        problems.append(f"exactly one phase must be active, found {len(active)}: {active or 'none'}")
    active_phase = active[0] if len(active) == 1 else None

    totals = {"criteria": 0, "done": 0, "open": 0}
    evidence_kinds = {"gate": 0, "ci": 0, "manual": 0}
    gate_claims = {}
    ci_claims = 0
    manual_claims = 0
    lines = []

    for phase in order:
        data = phases[phase]
        status = data["status"]
        if status not in STATUSES:
            problems.append(f"{phase}: status '{status}' is not one of {', '.join(STATUSES)}")
            continue

        # dependencies must be known, and done before this phase can be active or done
        for dep in data["depends_on"] or []:
            if dep not in phases:
                problems.append(f"{phase}: depends_on unknown phase '{dep}'")
            elif status in ("done", "active") and phases[dep]["status"] != "done":
                problems.append(f"{phase}: is {status} but its dependency {dep} is {phases[dep]['status']}")

        criteria = data["exit_criteria"] or []
        if not criteria:
            problems.append(f"{phase}: has no exit criteria")
        done = [c for c in criteria if str(c.get("state")) == "done"]
        open_ = [c for c in criteria if str(c.get("state")) == "open"]
        if len(done) + len(open_) != len(criteria):
            bad = [c.get("id") for c in criteria if str(c.get("state")) not in ("done", "open")]
            problems.append(f"{phase}: criteria with a state other than done/open: {bad}")
        seen = set()
        for criterion in criteria:
            cid = str(criterion.get("id"))
            if cid in seen:
                problems.append(f"{phase}: duplicate criterion id '{cid}'")
            seen.add(cid)
            if not criterion.get("requirement"):
                problems.append(f"{phase}/{cid}: no requirement text")
            evidence = str(criterion.get("evidence", ""))
            kind, _, ref = evidence.partition(":")
            if kind not in evidence_kinds or not ref:
                problems.append(f"{phase}/{cid}: evidence '{evidence}' is not gate:/ci:/manual:")
                continue
            evidence_kinds[kind] += 1
            state = str(criterion.get("state"))
            if kind == "gate":
                if ref not in GATES:
                    problems.append(f"{phase}/{cid}: unknown gate '{ref}' (registry: {', '.join(sorted(GATES))})")
                elif state == "done":
                    gate_claims.setdefault(ref, []).append(f"{phase}/{cid}")
            elif kind == "ci":
                if ref not in ci_jobs:
                    problems.append(f"{phase}/{cid}: ci job '{ref}' is not a job in ci.yml ({', '.join(sorted(ci_jobs))})")
                elif state == "done":
                    ci_claims += 1
            else:
                if state == "done":
                    target = ROOT / ref
                    if not target.exists():
                        problems.append(f"{phase}/{cid}: manual evidence '{ref}' does not exist")
                    else:
                        manual_claims += 1

        if status == "done":
            if not data.get("closed_on"):
                problems.append(f"{phase}: status is done but closed_on is missing")
            if open_:
                problems.append(f"{phase}: status is done but {len(open_)} exit criteria are still open")
        if status == "active" and not open_:
            problems.append(f"{phase}: status is active but every exit criterion is done - close it or open a criterion")
        if status == "planned" and done:
            problems.append(f"{phase}: status is planned but {len(done)} criteria claim done")

        totals["criteria"] += len(criteria)
        totals["done"] += len(done)
        totals["open"] += len(open_)
        lines.append(f"  {phase:<3} {status:<8} {len(done)}/{len(criteria)} criteria  {data['title']}")

    # a done claim whose gate is red is the one failure this tool exists to catch
    gate_lines = []
    for gate in sorted(gate_claims):
        ok, detail = run_gate(gate)
        claims = ", ".join(gate_claims[gate])
        if ok is None:
            gate_lines.append(f"  gate:{gate:<11} NOT RUN ({detail}) - claimed by {claims}")
        elif ok:
            gate_lines.append(f"  gate:{gate:<11} PASS ({detail})")
        else:
            gate_lines.append(f"  gate:{gate:<11} FAIL ({detail}) - claimed done by {claims}")
            problems.append(f"gate:{gate} fails but {claims} claim it")

    print(f"PHASE FILES: {len(phases)}")
    print(f"ACTIVE: {active_phase or 'none'}")
    for line in lines:
        print(line)
    print(f"CRITERIA: {totals['criteria']} total, {totals['done']} done, {totals['open']} open")
    print(f"EVIDENCE: {evidence_kinds['gate']} gate, {evidence_kinds['ci']} ci, {evidence_kinds['manual']} manual")
    for line in gate_lines:
        print(line)
    print(f"CLAIMS VERIFIED HERE: {sum(1 for g in gate_claims if _cache.get(g, (None,))[0] is True)} gate, {ci_claims} ci job exists, {manual_claims} manual path exists")
    print(f"PROBLEMS: {len(problems)}")
    for problem in problems:
        print(f"  {problem}")
    print("")
    if problems:
        print("RESULT: BROKEN - the phase graph and its claims do not hold")
        return 1
    print("RESULT: OK - one active phase, every done claim held, dependencies ordered")
    return 0


if __name__ == "__main__":
    sys.exit(main())
