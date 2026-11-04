/**
 * packages/i18n: the words, and the formatter that fills them. No decisions, no guardrails that need to know
 * what a fact means - those live in packages/narrator.
 */
export { catalogues, messagesFor, weekdayName, format, formatNumber, placeholdersOf } from "./format";
export type { SlotValue } from "./format";
export { LOCALES, isLocale } from "./types";
export type { Locale, Messages, ExplainTemplate } from "./types";
export { en } from "./catalogues/en";
export { zhHant } from "./catalogues/zh-Hant";
