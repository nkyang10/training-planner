/**
 * packages/worker: the nightly sweep's decisions, pure and testable. The scheduler and the writes are deployment
 * work; the rules about which day closed and what the system believed at that moment are not.
 */
export { runNightlySweep } from "./sweep";
export type { ClosedDay, CloseStatus, NightlyInput, NightlyResult, SignalCacheEntry } from "./types";
