/**
 * Canonical JSON and content hashing. Pure: no clock, no randomness, no I/O.
 *
 * The planner's byte-identical guarantee (AGENTS rule 1) and the knowledge hash on every plan version
 * both depend on one serialisation being the only serialisation. `JSON.stringify` is not it: object key
 * order is insertion order, so two objects with the same content can stringify differently and the same
 * inputs would produce two different hashes.
 */
import { createHash } from "node:crypto";

/** JSON with object keys sorted at every depth and no insignificant whitespace. */
export function canonicalJson(value: unknown): string {
  const seen = new Set<unknown>();
  const walk = (node: unknown): string => {
    if (node === null || typeof node !== "object") {
      if (typeof node === "number" && !Number.isFinite(node)) throw new Error(`canonicalJson: non-finite number ${node}`);
      if (typeof node === "undefined") throw new Error("canonicalJson: undefined is not JSON");
      return JSON.stringify(node);
    }
    if (seen.has(node)) throw new Error("canonicalJson: circular reference");
    seen.add(node);
    try {
      if (Array.isArray(node)) return `[${node.map(walk).join(",")}]`;
      const entries = Object.entries(node as Record<string, unknown>)
        .filter(([, v]) => typeof v !== "undefined")
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${walk(v)}`).join(",")}}`;
    } finally {
      seen.delete(node);
    }
  };
  return walk(value);
}

/** `sha256:<64 hex>` — the spelling every contract in schemas/json requires for a content hash. */
export function hashOf(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}
