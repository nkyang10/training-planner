/**
 * packages/advisor: the AI reviewer's request builder and the deterministic gates on its proposal (ADR-0009).
 *
 * The model decides whether a change is needed; it never applies one. This package builds what it may see, hashes
 * the call for the audit trail, parses what comes back, and refuses anything the engine cannot stand behind.
 */
export { buildAdvisorRequest, effectiveGuidelines, planFactsOf, REQUEST_RULES } from "./request";
export { validateProposal, firstEditableDay, requestRulesOf } from "./validate";
export type { AdvisorVerdict, ValidateProposalInput } from "./validate";
export { ADVISOR_DECISIONS, ADVISOR_REASON_CODES, advisorChangeSchema, advisorProposalSchema } from "./proposal";
export type { AdvisorChange, AdvisorProposal } from "./proposal";
export type {
  AdvisorCall,
  AdvisorHashes,
  AdvisorInput,
  AdvisorRequest,
  AdvisorSettings,
  GuidelineDigestRow,
  ModelPort,
  WizardAnswer,
} from "./types";