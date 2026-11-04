/**
 * packages/triggers: the corpus rules that turn signals into review candidates. It fires and it names what it
 * cannot evaluate; suppression and opening belong to packages/review.
 */
export { evaluateTriggers } from "./evaluate";
export type { TriggerContext, TriggerFired, TriggerHistory, TriggerOutput, UnevaluableTrigger } from "./types";
