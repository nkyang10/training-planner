/**
 * The narrator's guardrails, each one a check that can fail on purpose (see test/narrator.test.ts).
 *
 * These implement docs/ux/feedback-microcopy.md#never-say and
 * docs/ux/feedback-microcopy.md#rules-the-narrator-enforces-mechanically, and they hold in both locales:
 * language-guardrails.yaml#locale says a rule enforced only in English leaks through the other.
 */
import type { Locale } from "@training-planner/i18n";

export interface BannedCategory {
  id: string;
  why: string;
  pattern: RegExp;
}

/**
 * The banned set. Categories are named so a failure says which promise was broken, not just "blocked".
 * The patterns are deliberately narrow: a guardrail that fires on good copy gets switched off, and then it
 * protects nothing.
 */
export const BANNED: BannedCategory[] = [
  {
    id: "diagnosis",
    why: "we triage and refer; a wrong label changes what a runner tells their doctor",
    pattern:
      /(\b(you have|diagnosed with|looks like|it is|that's)\b[^.]{0,40}\b(syndrome|stress fracture|fracture|tendinopathy|fasciitis|ITBS)\b)|(確診|診斷為|看起來像|應該是)[^。]{0,20}(症|骨折|發炎|筋膜炎)/i,
  },
  {
    id: "guarantee",
    why: "we cannot promise; promising manufactures blame later",
    pattern: /(\b(will get you|guarantee[sd]?|ensures?|promise[sd]?|you will qualify|won't get injured)\b)|(保證|一定會|承諾|絕對不會受傷)/i,
  },
  {
    id: "energy-or-weight",
    why: "RED-S risk profile; weight and calorie framing is banned at the guardrail layer",
    pattern: /(\b(weight|calories?|kcal|cutting (weight|fat)|clean eating|fasted to burn)\b)|(體重|卡路里|熱量|減重|斷食|燃脂)/i,
  },
  {
    id: "shame",
    why: "shame is the fastest way to end logging, and unlogged days are the days we need",
    pattern: /(\b(skipped again|no excuses|champions? don't|you failed|lazy)\b)|(又跳過|藉口|冠軍不會|你失敗|懶惰)/i,
  },
  {
    id: "fake-precision",
    why: "precision without evidence is a lie with a decimal point",
    pattern: /(\b(VDOT|readiness score|recovery percentage|recovered)\b)|(恢復率|準備度分數|VDOT)/i,
  },
  {
    id: "streak-pressure",
    why: "streak pressure turns sick days into runs",
    pattern: /(\b(streak|don't break)\b)|(連續.{0,4}天|破了.{0,4}紀錄)/i,
  },
  {
    id: "toxic-positivity",
    why: "it contradicts our own safety model",
    pattern: /(push through|listen to your body[^.]{0,30}push)|(撐過去|硬撐)/i,
  },
  {
    id: "comparison-to-others",
    why: "comparisons are only to this runner's own recorded history",
    pattern: /(\b(runners like you|other runners|most runners)\b)|(像你這樣的跑者|其他跑者|大多數跑者)/i,
  },
  {
    id: "emoji",
    why: "glyphs belong to UI states, never to a comment",
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u,
  },
];

const EXCLAMATION_LIMITS: Record<Locale, number> = { en: 1, "zh-Hant": 0 };

/** Words that may legitimately appear in capitals; everything else in capitals is shouting. */
const ACRONYMS = new Set(["RPE", "VDOT", "HRMAX", "MP", "KM", "HR"]);

export function numbersIn(text: string): number[] {
  const found = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.map((value) => Number(value)))].sort((a, b) => a - b);
}

export function isCjk(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

export class NarratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NarratorError";
  }
}

/** Throws on the first banned category, naming it. */
export function assertNoBannedLanguage(text: string, locale: Locale): void {
  for (const category of BANNED) {
    if (category.pattern.test(text)) {
      throw new NarratorError(`${locale}: banned language (${category.id}): ${category.why}`);
    }
  }
}

export function assertTone(text: string, locale: Locale): void {
  const limit = EXCLAMATION_LIMITS[locale];
  const exclamations = text.split("!").length - 1;
  if (exclamations > limit) {
    throw new NarratorError(`${locale}: ${exclamations} exclamation marks, the limit is ${limit}`);
  }
  const shouting = (text.match(/\b[A-Z]{5,}\b/g) ?? []).filter((word) => !ACRONYMS.has(word));
  if (shouting.length > 0) {
    throw new NarratorError(`${locale}: shouting in capitals: ${shouting.join(", ")}`);
  }
}

export function assertScript(text: string, locale: Locale): void {
  const cjk = isCjk(text);
  if (locale === "en" && cjk) throw new NarratorError("en: the comment contains CJK text");
  if (locale === "zh-Hant" && !cjk) throw new NarratorError("zh-Hant: the comment contains no CJK text");
}

/**
 * Rule 2's guardrail: every number the narrator injects must be one the fact object allowed. Numbers that
 * are part of the fixed copy (`literal`) are copy, not data - the stop sentence's "48 hours" is a rule, not
 * a measurement, and a guardrail that rejected it would force the copy to become data.
 */
export function assertGrounded(text: string, literal: string, allowedNumbers: readonly number[]): void {
  const allowed = new Set([...allowedNumbers, ...numbersIn(literal)]);
  for (const value of numbersIn(text)) {
    if (!allowed.has(value)) {
      throw new NarratorError(`number ${value} is not in the fact object's allowedNumbers`);
    }
  }
}
