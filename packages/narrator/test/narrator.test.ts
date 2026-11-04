/**
 * The narrator's tests are mostly about what it refuses.
 *
 * A template renderer that produces sentences is easy to believe; the interesting claims are the guardrails:
 * every number comes from the fact object, no banned category survives, the tone rules hold in both
 * languages, and each check can be shown failing on purpose.
 */
import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "@training-planner/policy";
import type { CommentFacts, FactLine, FactTemplate, PolicyHistory, PolicyInput } from "@training-planner/policy";
import { FACT_TEMPLATES } from "@training-planner/policy";
import { messagesFor } from "@training-planner/i18n";
import { LOCALES } from "@training-planner/i18n";
import {
  BANNED,
  NarratorError,
  assertGrounded,
  assertNoBannedLanguage,
  assertScript,
  assertTone,
  numbersIn,
  renderAdjustment,
  renderComment,
  renderDailyCost,
} from "../src/index";
import { knowledge, makeEntry, makePlan, weekPlan } from "../../policy/test/helpers";

/** A rule that can own a sentence in a test fixture; every one of these is registered. */
const OWNER: Record<FactTemplate, string> = {
  "acknowledge.completed": "comment-contract",
  "acknowledge.partial": "comment-contract",
  "acknowledge.alternate": "alternate-counts-as-met",
  "acknowledge.rest": "comment-contract",
  "acknowledge.skipped": "missed-easy-delete",
  "interpret.effort-gap": "readiness-subtracts-only",
  "interpret.legs-heavy": "readiness-subtracts-only",
  "interpret.sleep-short": "readiness-subtracts-only",
  "interpret.extra-subtracts": "extra-activity-subtracts",
  "interpret.pain-reported": "readiness-subtracts-only",
  "redirect.tomorrow-kept": "comment-contract",
  "redirect.tomorrow-downgraded": "readiness-subtracts-only",
  "redirect.tomorrow-swapped": "missed-quality-swap-if-legal",
  "redirect.safety-instruction": "safety-text-first",
  "redirect.review-offered": "plan-too-big",
  "redirect.nudge-unlogged": "unlogged-is-not-zero",
};

const SLOTS: Record<string, Record<string, string | number>> = {
  "acknowledge.completed": { km: 12 },
  "acknowledge.skipped": { kind: "tempo" },
  "interpret.effort-gap": { gap: 2.5 },
  "interpret.legs-heavy": { legs: 4, scale: 5 },
  "interpret.pain-reported": { site: "knee", intensity: 4, scale: 10 },
  "redirect.tomorrow-downgraded": { day: "2026-11-05" },
  "redirect.tomorrow-swapped": { day: "2026-11-07" },
  "redirect.safety-instruction": { instruction: "chest-urgent" },
  "redirect.nudge-unlogged": { days: 2 },
};

const line = (template: FactTemplate): FactLine => ({
  template,
  slots: SLOTS[template] ?? {},
  ruleId: OWNER[template],
  anchor: `test#${OWNER[template]}`,
});

const factsOf = (lines: FactLine[], overrides: Partial<CommentFacts> = {}): CommentFacts => ({
  day: "2026-11-04",
  outcome: "completed",
  acknowledge: lines.filter((item) => item.template.startsWith("acknowledge.")),
  interpret: lines.filter((item) => item.template.startsWith("interpret.")),
  redirect: lines.filter((item) => item.template.startsWith("redirect.")),
  allowedNumbers: [...new Set(lines.flatMap((item) => Object.values(item.slots).filter((value): value is number => typeof value === "number")))],
  tone: { register: "coach-to-runner", safetyFirst: false, praiseSuppressed: false },
  silence: false,
  suppressed: [],
  ...overrides,
});

describe("every template the engine can emit renders in both languages", () => {
  for (const locale of LOCALES) {
    for (const template of FACT_TEMPLATES) {
      it(`${locale} ${template}`, () => {
        const facts = factsOf([line(template)]);
        const rendered = renderComment(facts, { locale });
        expect(rendered.sentences).toHaveLength(1);
        expect(rendered.text.length).toBeGreaterThan(0);
        expect(rendered.text).not.toMatch(/[{}]/);
        if (locale === "zh-Hant") expect(rendered.text).toMatch(/[\u4e00-\u9fff]/);
      });
    }
  }
});

describe("a decision renders as a comment, not as data", () => {
  const scenario = (entry: Partial<PolicyInput["entry"]>, history?: PolicyHistory): PolicyInput => ({
    entry: makeEntry(entry),
    plan: weekPlan(),
    today: entry.day ?? "2026-11-04",
    knowledge,
    ...(history === undefined ? {} : { history }),
  });

  const scenarios: Array<{ name: string; input: PolicyInput }> = [
    { name: "a plain completed day", input: scenario({ outcome: "completed" }) },
    { name: "heavy legs", input: scenario({ outcome: "completed", legs: 4 }) },
    { name: "a missed day", input: scenario({ outcome: "missed" }) },
    { name: "chest symptoms", input: scenario({ outcome: "rest", pain: [{ site: "chest", intensity: 2 }] }) },
    { name: "below-neck illness", input: scenario({ outcome: "completed", wellness: { illnessSymptoms: ["below-neck"] } }) },
    { name: "extra activity", input: scenario({ outcome: "completed", sessionTaken: "extra" }) },
    { name: "a review offer", input: scenario({ outcome: "completed" }, { completionRate14d: 0.5 }) },
    { name: "a partial day", input: scenario({ outcome: "partial", completedKm: 4 }) },
    { name: "a rest day", input: scenario({ outcome: "rest" }) },
  ];

  for (const item of scenarios) {
    it(`${item.name}: both languages render without breaking a guardrail`, () => {
      const decision = evaluatePolicy(item.input);
      for (const locale of LOCALES) {
        const rendered = renderComment(decision.commentFacts, { locale });
        expect(rendered.sentences.length).toBeLessThanOrEqual(4);
        for (const sentence of rendered.sentences) {
          expect(() => assertNoBannedLanguage(sentence, locale)).not.toThrow();
          expect(() => assertTone(sentence, locale)).not.toThrow();
        }
        if (decision.commentFacts.silence) {
          expect(rendered.text).toBe("");
        } else {
          expect(rendered.text.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it("opens with the fixed stop sentence when a safety rule fires", () => {
    const decision = evaluatePolicy(scenario({ outcome: "rest", pain: [{ site: "chest", intensity: 2 }] }));
    const rendered = renderComment(decision.commentFacts, { locale: "en" });
    expect(rendered.sentences[0]).toBe(messagesFor("en").stop["chest-urgent"]);
    expect(rendered.text).not.toMatch(/well done|great job|nice work/i);
  });

  it("keeps the nudge out of the comment when the day was not logged", () => {
    const decision = evaluatePolicy(scenario({ outcome: "missed" }));
    const rendered = renderComment(decision.commentFacts, { locale: "zh-Hant" });
    expect(rendered.silence).toBe(true);
    expect(rendered.text).toBe("");
    expect(rendered.nudge).toBeDefined();
    expect(rendered.nudge).toMatch(/[\u4e00-\u9fff]/);
  });

  it("is deterministic for the same facts", () => {
    const decision = evaluatePolicy(scenario({ outcome: "completed", legs: 4 }));
    const first = renderComment(decision.commentFacts, { locale: "en" });
    const second = renderComment(decision.commentFacts, { locale: "en" });
    expect(first.text).toBe(second.text);
  });
});

describe("the daily trade-off line is rendered, not composed", () => {
  it("fills the template with the locale's kind name and the corpus percentage", () => {
    const line = renderDailyCost({ key: "alternate-quality", slots: { kind: "tempo", pct: 35 } }, { locale: "en" });
    expect(line).toContain("tempo");
    expect(line).toContain("35");
    expect(line).not.toContain("{");
  });

  it("says the same thing in Chinese, without the English kind name leaking", () => {
    const line = renderDailyCost({ key: "alternate-quality", slots: { kind: "tempo", pct: 35 } }, { locale: "zh-Hant" });
    expect(line).toContain("35");
    expect(line).not.toContain("tempo");
  });

  it("keeps a volume cost to the number the fact object carries", () => {
    const line = renderDailyCost({ key: "alternate-volume", slots: { km: 6 } }, { locale: "en" });
    expect(line).toContain("6");
  });
});

describe("the chip states the change, the reason and the cost", () => {
  it("renders a readiness downgrade in both languages", () => {
    const input: PolicyInput = { entry: makeEntry({ outcome: "completed", legs: 4 }), plan: weekPlan(), today: "2026-11-04", knowledge };
    const decision = evaluatePolicy(input);
    if (!decision.adjustTomorrow) throw new Error("expected an adjustment");
    const en = renderAdjustment(decision.adjustTomorrow, { locale: "en" });
    expect(en).toContain("→");
    expect(en).toContain("changed because");
    expect(en).toContain("trade-off:");
    const zh = renderAdjustment(decision.adjustTomorrow, { locale: "zh-Hant" });
    expect(zh).toContain("→");
    expect(zh).toMatch(/[\u4e00-\u9fff]/);
  });

  it("names the weekday for a swap and never prints the date", () => {
    const plan = makePlan([
      { day: "2026-11-02", kind: "rest", km: 0 },
      { day: "2026-11-03", kind: "easy", km: 6 },
      { day: "2026-11-04", kind: "rest", km: 0 },
      { day: "2026-11-05", kind: "tempo", km: 10, hard: true, rpe: 7 },
      { day: "2026-11-06", kind: "rest", km: 0 },
      { day: "2026-11-07", kind: "easy", km: 5 },
      { day: "2026-11-08", kind: "rest", km: 0 },
      { day: "2026-11-09", kind: "easy", km: 6 },
    ]);
    const input: PolicyInput = {
      entry: makeEntry({ day: "2026-11-05", outcome: "skipped", outcomeDetail: "work" }),
      plan,
      today: "2026-11-05",
      knowledge,
    };
    const decision = evaluatePolicy(input);
    if (!decision.adjustTomorrow) throw new Error("expected a swap");
    const en = renderAdjustment(decision.adjustTomorrow, { locale: "en" });
    expect(en).toContain("Saturday");
    expect(en).not.toMatch(/2026-11-07/);
  });
});

describe("the guardrails can fail", () => {
  it("refuses a number the fact object did not allow", () => {
    const facts = factsOf([{ template: "acknowledge.completed", slots: { km: 99 }, ruleId: "comment-contract", anchor: "test" }], {
      allowedNumbers: [],
    });
    expect(() => renderComment(facts, { locale: "en" })).toThrow(/not in the fact object/);
  });

  it("refuses a slot the template does not have", () => {
    const facts = factsOf([{ template: "acknowledge.completed", slots: {}, ruleId: "comment-contract", anchor: "test" }]);
    expect(() => renderComment(facts, { locale: "en" })).toThrow(NarratorError);
  });

  const bannedSamples: Array<[string, string]> = [
    ["diagnosis", "you have ITB syndrome"],
    ["diagnosis", "你確診了足底筋膜炎"],
    ["guarantee", "this will get you to the finish"],
    ["guarantee", "保證你可以完賽"],
    ["energy-or-weight", "cutting weight will help"],
    ["energy-or-weight", "減重會讓你更快"],
    ["shame", "you skipped again"],
    ["shame", "又跳過了"],
    ["fake-precision", "your VDOT is 46"],
    ["fake-precision", "恢復率 68%"],
    ["streak-pressure", "don't break your streak"],
    ["streak-pressure", "連續 47 天"],
    ["toxic-positivity", "just push through it"],
    ["toxic-positivity", "撐過去就對了"],
    ["comparison-to-others", "runners like you improve fast"],
    ["comparison-to-others", "其他跑者都做得到"],
    ["emoji", "nice work 🔥"],
  ];
  for (const [category, sample] of bannedSamples) {
    it(`refuses ${category}: ${sample}`, () => {
      const locale = /[\u4e00-\u9fff]/.test(sample) ? "zh-Hant" : "en";
      expect(() => assertNoBannedLanguage(sample, locale)).toThrow(new RegExp(category));
    });
  }

  it("has a pattern for every category it names", () => {
    for (const category of BANNED) {
      expect(category.pattern).toBeInstanceOf(RegExp);
      expect(category.why.length).toBeGreaterThan(0);
    }
  });

  it("refuses the tone the copy contract forbids", () => {
    expect(() => assertTone("太好了!", "zh-Hant")).toThrow(/exclamation/);
    expect(() => assertTone("Great!!!", "en")).toThrow(/exclamation/);
    expect(() => assertTone("AMAZING session", "en")).toThrow(/capitals/);
    expect(() => assertTone("RPE 7 is fine", "en")).not.toThrow();
    expect(() => assertTone("Nice work!", "en")).not.toThrow();
  });

  it("refuses a language that does not match the locale", () => {
    expect(() => assertScript("很好", "en")).toThrow(/CJK/);
    expect(() => assertScript("good session", "zh-Hant")).toThrow(/no CJK/);
  });

  it("lets a fixed-copy number through and refuses a data number", () => {
    expect(() => assertGrounded("Rest until you are 48 hours symptom-free", "Rest until you are 48 hours symptom-free", [])).not.toThrow();
    expect(() => assertGrounded("Effort came in 3 points above", "", [2])).toThrow(/not in the fact object/);
    expect(() => assertGrounded("Effort came in 2 points above", "", [2])).not.toThrow();
  });
});

describe("the narrator never prints a number it was not given", () => {
  it("every number in a rendered decision is in allowedNumbers or in the fixed copy", () => {
    const input: PolicyInput = { entry: makeEntry({ outcome: "completed", legs: 4 }), plan: weekPlan(), today: "2026-11-04", knowledge };
    const decision = evaluatePolicy(input);
    const rendered = renderComment(decision.commentFacts, { locale: "en" });
    const literalNumbers = new Set<number>();
    for (const line of [...decision.commentFacts.acknowledge, ...decision.commentFacts.interpret, ...decision.commentFacts.redirect]) {
      const template = messagesFor("en").comment[line.template].replace(/\{[a-zA-Z][a-zA-Z0-9_-]*\}/g, "");
      for (const value of numbersIn(template)) literalNumbers.add(value);
    }
    const allowed = new Set([...decision.commentFacts.allowedNumbers, ...literalNumbers]);
    for (const value of numbersIn(rendered.text)) expect(allowed.has(value)).toBe(true);
  });
});
