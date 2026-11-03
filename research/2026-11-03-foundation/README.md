---
status: draft
last_reviewed: 2026-11-03
drop: 2026-11-03-foundation
immutable: true
---

# Research drop: foundation (2026-11-03)

The first pass of evidence gathering behind `knowledge/`. This drop is **immutable**
(`AGENTS.md` Conventions): a wrong finding stays here, and the correction goes into a newer drop with
a forward link. Nothing in this directory is a deliverable — it is the audit trail that lets a reader
check a knob two years from now.

## How the sources were gathered

- PubMed E-utilities: `esearch.fcgi` for candidate PMIDs, then `efetch.fcgi` with all PMIDs in **one**
  request (`rettype=docsum` for titles, `rettype=abstract` where a number had to be read). Rate kept
  under 3 calls/second; 429 responses were handled by batching rather than retrying.
- Europe PMC REST for title searches where PubMed's ranking returned reviews only.
- `web_fetch` on publisher landing pages to confirm a title, journal, and year. Abstract text is the
  deepest level reached for most entries; full texts were **not** obtained.
- Grade-C practice texts (Daniels, Hansons, Pfitzinger, Magness) were cited from their published
  coaching frameworks. They supply *shape* — a week's structure, a session's purpose — and are never
  the source of a measured number in `heuristics/`.

## What each id means

`PHYS-S*` physiology and metrics, `PLAN-S*` plan construction, `FB-S*` feedback and autoregulation.
Definitions, grades (A meta/systematic, B RCT or strong cohort, C practice text, D vendor or blog),
and verification method live in `../../knowledge/sources/bibliography.md`. `sources:` in a heuristics
file lists ids only — the audit tool (`../../../tools/audit-links.ps1`) rejects an id that is not in
the bibliography, which is how the three invented ids found in an earlier draft were caught.

## Known defects in this drop — read before trusting a number

1. **`FB-S8` is a knowingly-fake placeholder.** It was written into `missed-session-rules.yaml` and
   then caught. It remains in the bibliography marked as such, and the rules citing it are capped at
   `confidence: medium` with the placeholder named in a comment. Do not silently "fix" the citation:
   replace it with a real source or lower the rule.
2. **`FB-S9` is marked "citation to verify"**, and `PLAN-S6` (an individual-participant-data meta
   analysis) was never read — it is recorded at `confidence: low` as a lead, not as support.
3. **21 `PHYS-S` entries are author+year+journal with a query URL, and are labelled "primary record not
   abstract-verified on 2026-11-03".** They are leads. Anything that depends on one is capped at
   `confidence: medium` and the cap is written in the knob.
4. Search coverage was English-language and road-marathon-weighted. Trail/ultra, masters, and
   postpartum material is thinner than the rest, and `knowledge/personas/` says so where it shows.

## Next drop should

- Abstract-verify the 21 unverified `PHYS-S` ids and upgrade or delete each.
- Find a real source for every rule currently capped by `FB-S8`/`FB-S9`.
- Add heat and altitude dosing numbers (today `heuristics/context.yaml` only states direction).
- Add the detraining curve at *under* 90 days: `PHYS-S22` covers the plateau, not the first weeks.
- Pull grade-A material on postpartum return-to-running, which is the weakest area of the corpus.
