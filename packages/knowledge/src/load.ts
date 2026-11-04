/**
 * The knowledge bundle: knowledge/heuristics/*.yaml, parsed once, frozen, and identified by a hash.
 *
 * This is the only place in the codebase that reads the knowledge corpus, and it is deliberately
 * outside packages/planner-core: the planner receives the bundle as an argument (AGENTS rule 1), so the
 * same bundle object produces the same plan, and a plan version can name the knowledge that made it.
 *
 * Knobs are not all scalars. Measured over the 34 files on 2026-11-04: 129 have `range: [min, max]`,
 * 75 have `range: null` (formulas and text), and 41 are compound - the value is a record whose members
 * each carry their own range (`altitude_mode: {threshold_m: [500, 2000]}`), or an enum whose range is
 * the list of allowed names (`variant: [ewma_7_28, ra_7_28_coupled, ra_7_28_uncoupled]`). A loader that
 * assumes "one knob, one number" would have rejected the corpus it was written for.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { hashOf } from "./canonical";

export type KnobValue = number | string | boolean | (string | number)[] | Record<string, unknown>;

export interface Knob {
  /** `file.yaml#knob_id` - the same spelling the knowledge prose and the audit use. */
  anchor: string;
  file: string;
  id: string;
  value: KnobValue;
  /** The bounds the engine clamps to. Set only for a numeric scalar; null for every other shape. */
  range: [number, number] | null;
  unit: string | null;
  confidence: "low" | "medium" | "high";
  personaOverridable: boolean;
}

export interface KnowledgeBundle {
  /** `sha256:<64 hex>` over the canonical form of every file's parsed content. */
  hash: string;
  files: string[];
  knobs: Map<string, Knob>;
  /** The knob, or a thrown error: a planner that silently defaults is a planner that lies. */
  knob(anchor: string): Knob;
  /** The numeric knob value, with the range checked at load time. */
  number(anchor: string): number;
}

const CONFIDENCE = new Set(["low", "medium", "high"]);

const isPair = (range: unknown): range is [number, number] =>
  Array.isArray(range) && range.length === 2 && range.every((bound) => typeof bound === "number");

const isKnobValue = (value: unknown): value is KnobValue =>
  typeof value === "number" ||
  typeof value === "string" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((entry) => typeof entry === "string" || typeof entry === "number")) ||
  (typeof value === "object" && value !== null && !Array.isArray(value));

export function loadKnowledge(directory: string): KnowledgeBundle {
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".yaml"))
    .sort();
  if (files.length === 0) throw new Error(`loadKnowledge: no *.yaml under ${directory}`);

  const parsed = new Map<string, unknown>();
  const knobs = new Map<string, Knob>();

  for (const file of files) {
    const document = parse(readFileSync(join(directory, file), "utf8")) as Record<string, unknown> | null;
    if (!document || typeof document !== "object") throw new Error(`loadKnowledge: ${file} is not a mapping`);
    parsed.set(file, document);
    if (document.schema_version !== 1) throw new Error(`loadKnowledge: ${file} schema_version is not 1`);

    const fileKnobs = (document.knobs ?? {}) as Record<string, Record<string, unknown>>;
    for (const [id, knob] of Object.entries(fileKnobs)) {
      const value = knob.value;
      if (!isKnobValue(value)) throw new Error(`loadKnowledge: ${file}#${id} has no scalar, list or record value`);
      const range = isPair(knob.range) ? knob.range : null;
      // docs/engine/planner-engine.md section 3: an out-of-range knob is a build error, not a silent
      // mis-generation. This is the build error.
      if (typeof value === "number" && range !== null && (value < range[0] || value > range[1])) {
        throw new Error(`loadKnowledge: ${file}#${id} value ${value} outside range [${range[0]}, ${range[1]}]`);
      }
      const confidence = String(knob.confidence ?? "low");
      if (!CONFIDENCE.has(confidence)) throw new Error(`loadKnowledge: ${file}#${id} confidence '${confidence}' is not low|medium|high`);
      knobs.set(`${file}#${id}`, {
        anchor: `${file}#${id}`,
        file,
        id,
        value,
        range,
        unit: typeof knob.unit === "string" ? knob.unit : null,
        confidence: confidence as Knob["confidence"],
        personaOverridable: knob.persona_overridable === true,
      });
    }
  }

  const content: Record<string, unknown> = {};
  for (const file of files) content[file] = parsed.get(file);

  return {
    hash: hashOf(content),
    files,
    knobs,
    knob(anchor) {
      const found = knobs.get(anchor);
      if (!found) throw new Error(`knowledge knob not found: ${anchor}`);
      return found;
    },
    number(anchor) {
      const found = this.knob(anchor);
      if (typeof found.value !== "number") throw new Error(`knowledge knob ${anchor} is not a number`);
      return found.value;
    },
  };
}
