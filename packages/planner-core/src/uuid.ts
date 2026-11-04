import { hashOf } from "@training-planner/knowledge/canonical";

/**
 * A UUID-shaped identifier derived from content: same inputs, same id, no randomness.
 *
 * `crypto.randomUUID` is not available to the planner (AGENTS rule 1: no randomness), and a plan version
 * id that changes between two identical generations would break the byte-identical guarantee this whole
 * milestone is measured by. Version 4 and variant bits are set so the value is a legal UUID as well as a
 * stable one.
 */
export function uuidFrom(seed: unknown): string {
  const chars = hashOf(seed).slice("sha256:".length).slice(0, 32).split("");
  chars[12] = "4";
  const variant = Number.parseInt(chars[16] ?? "0", 16);
  chars[16] = ((variant & 0x3) | 0x8).toString(16);
  const joined = chars.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20, 32)}`;
}
