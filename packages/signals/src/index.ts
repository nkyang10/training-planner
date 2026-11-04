/**
 * packages/signals: rollups and signals computed from the append-only log and the plan. Pure, so a season can be
 * re-explained months later exactly as it was read at the time.
 */
export { computeSignals, signalByKey } from "./signals";
export type { DayRollup, SignalInput, SignalOutput, UnavailableSignal } from "./types";
