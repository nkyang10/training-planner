/**
 * The season package's public surface.
 *
 * `seasonSummary` is pure: plan version in, weekly planned-versus-done out. The API route and the page both
 * call it, so the number on screen and the number in JSON cannot disagree.
 */
export { seasonSummary } from "./summary";
export type { SeasonInput, SeasonSummary, SeasonTotals, SeasonWeek } from "./summary";
