#!/usr/bin/env node
/**
 * Generate packages/domain/src/schemas.ts from schemas/json/*.schema.json.
 *
 * Why codegen instead of hand-written mirrors: schemas/README.md rule 7 says the camelCase/snake_case
 * mirror is mechanical and codegen owns the spelling. A hand-written zod mirror of seven contracts is
 * 300 lines of transcription whose only reviewable property is "it looked right", and this repository has
 * already paid for that mistake twice - once with a wire/DDL vocabulary that shared no value names, once
 * with a day-entry field no column could store. Generating the mirror makes the JSON contract the only
 * source, and the fixture round-trip test (packages/domain/test/fixtures.test.ts) proves the generator.
 *
 * Supported on purpose: exactly the keywords these contracts use. A keyword this generator does not
 * understand is an error, not a silent skip - an unenforced constraint is the failure mode we are
 * removing, so `throw` is the correct behaviour when a contract grows one.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SCHEMA_DIR = join(ROOT, "schemas", "json");
const OUT = join(ROOT, "packages", "domain", "src", "schemas.ts");

const CONTRACTS = [
  ["athlete-profile", "athleteProfile"],
  ["day-entry", "dayEntry"],
  ["plan-version", "planVersion"],
  ["plan-diff", "planDiff"],
  ["review", "review"],
  ["signal", "signal"],
  ["events", "event"],
  ["prompt-delivery", "promptDelivery"],
  ["guideline", "guideline"],
];

const IGNORED = new Set([
  "$schema", "$id", "title", "description", "default", "examples", "deprecated", "readOnly", "writeOnly",
  // repository annotation, not a JSON Schema keyword: "health-sensitive" marks a field that must not
  // leave the tenant (docs/data/data-model.md). It is documentation, so the generator ignores it.
  "classification",
]);
const isExtension = (key) => key.startsWith("x-");

const camel = (value) => value.replace(/[-_ ]+([a-z0-9])/g, (_, c) => c.toUpperCase());
const pascal = (value) => camel(value).replace(/^[a-z]/, (c) => c.toUpperCase());

class Generator {
  constructor() {
    this.lines = [];
    this.counter = 0;
  }

  unique(prefix) {
    this.counter += 1;
    return `${prefix}${this.counter}`;
  }

  unsupported(node, keyword) {
    throw new Error(`gen-domain-schemas: unsupported keyword '${keyword}' in ${JSON.stringify(node).slice(0, 120)}`);
  }

  /** A zod expression for one JSON Schema node. */
  expr(node, defIdents) {
    if (typeof node !== "object" || node === null) throw new Error("gen-domain-schemas: schema node is not an object");

    if (node.$ref) {
      const name = node.$ref.replace(/^#\/\$defs\//, "");
      const ident = defIdents.get(name);
      if (!ident) throw new Error(`gen-domain-schemas: unresolved $ref ${node.$ref}`);
      return ident;
    }

    if ("const" in node) return node.const === null ? "z.null()" : `z.literal(${JSON.stringify(node.const)})`;

    if (node.enum) {
      const parts = node.enum.map((value) => (value === null ? "z.null()" : `z.literal(${JSON.stringify(value)})`));
      return parts.length === 1 ? parts[0] : `z.union([${parts.join(", ")}])`;
    }

    if (node.anyOf) return `z.union([${node.anyOf.map((part) => this.expr(part, defIdents)).join(", ")}])`;

    // JSON Schema allows keywords without `type` (`{ "pattern": "^safety\\." }` is a string). Inferring
    // the type from the keyword is the difference between mirroring the contract and accepting anything:
    // the safety-event rule in events.schema.json was a pattern with no type, and a record accepts it.
    const inferred = node.type
      ? []
      : node.properties !== undefined || node.required !== undefined
        ? ["object"]
        : node.items !== undefined
          ? ["array"]
          : node.pattern || node.format || node.minLength !== undefined || node.maxLength !== undefined
            ? ["string"]
            : node.minimum !== undefined || node.maximum !== undefined || node.multipleOf !== undefined
              ? ["number"]
              : [];
    const types = Array.isArray(node.type) ? node.type : node.type ? [node.type] : inferred;
    const nonNull = types.filter((t) => t !== "null");
    const nullable = types.includes("null");

    let base;
    if (nonNull.length === 0 && node.properties === undefined) {
      if (nullable) return "z.null()";
      // no type and no properties: an object with unknown members
      base = "z.record(z.unknown())";
    } else if (nonNull.length > 1) {
      base = `z.union([${nonNull.map((t) => this.expr({ ...node, type: t }, defIdents)).join(", ")}])`;
    } else {
      base = this.byType(node, nonNull[0], defIdents);
    }
    if (nullable) base = `${base}.nullable()`;

    if (node.allOf) {
      for (const part of node.allOf) {
        if (part.if) {
          const cond = this.expr(part.if, defIdents);
          const consequence = this.expr(part.then ?? {}, defIdents);
          const message =
            typeof part.description === "string" ? part.description : "the object does not satisfy the contract's if/then rule";
          base = `whenThen(${base}, ${cond}, ${consequence}, ${JSON.stringify(message)})`;
        } else {
          base = `(${base}).and(${this.expr(part, defIdents)})`;
        }
      }
    }
    if (node.if) {
      const cond = this.expr(node.if, defIdents);
      const consequence = this.expr(node.then ?? {}, defIdents);
      const message = `the object does not satisfy the contract's if/then rule`;
      base = `whenThen(${base}, ${cond}, ${consequence}, ${JSON.stringify(message)})`;
    }
    return base;
  }

  byType(node, type, defIdents) {
    const unsupported = Object.keys(node).filter(
      (key) => !IGNORED.has(key) && !isExtension(key) && ![
        "type", "enum", "const", "anyOf", "allOf", "if", "then", "properties", "required",
        "additionalProperties", "$defs", "items", "pattern", "format", "minimum", "maximum",
        "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength", "minItems", "maxItems",
        "uniqueItems", "multipleOf", "patternProperties",
      ].includes(key),
    );
    if (unsupported.length > 0) this.unsupported(node, unsupported[0]);

    if (type === "string") {
      let out = "z.string()";
      if (node.format === "date") out += ".regex(/^\\d{4}-\\d{2}-\\d{2}$/)";
      else if (node.format === "date-time") out += ".datetime({ offset: true })";
      else if (node.format === "uuid") out += ".uuid()";
      else if (node.format === "uri") out += ".url()";
      else if (node.format) this.unsupported(node, `format:${node.format}`);
      if (node.pattern) out += `.regex(new RegExp(${JSON.stringify(node.pattern)}))`;
      if (typeof node.minLength === "number") out += `.min(${node.minLength})`;
      if (typeof node.maxLength === "number") out += `.max(${node.maxLength})`;
      return out;
    }
    if (type === "integer" || type === "number") {
      let out = type === "integer" ? "z.number().int()" : "z.number()";
      if (typeof node.minimum === "number") out += `.min(${node.minimum})`;
      if (typeof node.maximum === "number") out += `.max(${node.maximum})`;
      if (typeof node.exclusiveMinimum === "number") out += `.gt(${node.exclusiveMinimum})`;
      if (typeof node.exclusiveMaximum === "number") out += `.lt(${node.exclusiveMaximum})`;
      if (typeof node.multipleOf === "number") out += `.multipleOf(${node.multipleOf})`;
      return out;
    }
    if (type === "boolean") return "z.boolean()";
    if (type === "null") return "z.null()";
    if (type === "array") {
      let out = `z.array(${this.expr(node.items ?? {}, defIdents)})`;
      if (typeof node.minItems === "number") out += `.min(${node.minItems})`;
      if (typeof node.maxItems === "number") out += `.max(${node.maxItems})`;
      return out;
    }
    if (type === "object" || node.properties) {
      const properties = node.properties ?? {};
      const required = new Set(node.required ?? []);
      const entries = Object.entries(properties).map(([key, value]) => {
        const optional = required.has(key) ? "" : ".optional()";
        return `    ${JSON.stringify(key)}: ${this.expr(value, defIdents)}${optional},`;
      });
      // JSON Schema can require a property it does not describe (events: causationId). Dropping those
      // was a real bug here: the contract said "a safety event without a cause chain must never be
      // possible" and the mirror quietly accepted one.
      for (const key of required) {
        if (!(key in properties)) entries.push(`    ${JSON.stringify(key)}: requiredAny,`);
      }
      const shape = entries.length > 0 ? `{\n${entries.join("\n")}\n  }` : "{}";
      let out = `z.object(${shape})`;
      if (node.additionalProperties === false) out += ".strict()";
      else if (node.additionalProperties === true || node.additionalProperties === undefined) out += ".passthrough()";
      else if (typeof node.additionalProperties === "object") out += `.passthrough()`;
      return out;
    }
    this.unsupported(node, `type:${String(type)}`);
    return "z.unknown()";
  }
}

function generate() {
  const files = readdirSync(SCHEMA_DIR).filter((name) => name.endsWith(".schema.json"));
  const known = new Set(CONTRACTS.map(([file]) => `${file}.schema.json`));
  for (const file of files) {
    if (!known.has(file)) throw new Error(`gen-domain-schemas: ${file} has no export name in CONTRACTS`);
  }

  const body = [];
  const exports = [];
  for (const [file, exportName] of CONTRACTS) {
    const schema = JSON.parse(readFileSync(join(SCHEMA_DIR, `${file}.schema.json`), "utf8"));
    const generator = new Generator();
    const defIdents = new Map();
    for (const [name, node] of Object.entries(schema.$defs ?? {})) {
      const ident = `${exportName}${pascal(name)}`;
      defIdents.set(name, ident);
      body.push(`const ${ident} = ${generator.expr(node, defIdents)};`);
      body.push("");
    }
    body.push(`export const ${exportName}Schema = ${generator.expr(schema, defIdents)};`);
    body.push("");
    exports.push(`export type ${pascal(exportName)}Contract = z.infer<typeof ${exportName}Schema>;`);
  }

  const header = [
    "// GENERATED FILE - do not edit by hand.",
    "// Source: schemas/json/*.schema.json. Regenerate with `pnpm gen:domain`.",
    "// The fixture round-trip test in packages/domain/test proves this output against eval/contract-fixtures.",
    'import { z } from "zod";',
    "",
    "/** A required property with no declared shape: presence is the requirement, not a type. */",
    "const requiredAny = z.custom<unknown>((value) => value !== undefined, { message: \"required\" });",
    "",
    "/** if/then from JSON Schema: the consequence is only required when the condition matches. */",
    "const whenThen = <T extends z.ZodTypeAny>(base: T, cond: z.ZodTypeAny, consequence: z.ZodTypeAny, message: string): T =>",
    "  base.superRefine((value, ctx) => {",
    "    if (!cond.safeParse(value).success) return;",
    "    if (!consequence.safeParse(value).success) ctx.addIssue({ code: z.ZodIssueCode.custom, message });",
    "  }) as unknown as T;",
    "",
  ];
  return [...header, ...body, ...exports, ""].join("\n");
}

writeFileSync(OUT, generate(), "utf8");
console.log(`gen-domain-schemas: wrote ${OUT.replace(ROOT, ".")} from ${CONTRACTS.length} contracts`);
