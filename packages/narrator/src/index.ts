/**
 * packages/narrator: the fact object to sentences, and the guardrails that make the words safe.
 *
 * No LLM is reachable from here on purpose. When one is added it rewrites the template text under the same
 * guardrails and falls back to these sentences on any failure; the deterministic path stays the baseline.
 */
export { renderComment, renderAdjustment, nudgeLabel } from "./render";
export type { RenderOptions, RenderedComment } from "./render";
export {
  BANNED,
  NarratorError,
  assertGrounded,
  assertNoBannedLanguage,
  assertScript,
  assertTone,
  isCjk,
  numbersIn,
} from "./guardrails";
export type { BannedCategory } from "./guardrails";
