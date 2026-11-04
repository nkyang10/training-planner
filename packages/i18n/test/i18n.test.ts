/**
 * Catalogue parity is a compile-time property (the catalogues are typed by the engine's own key unions) and a
 * runtime property (the key sets must match what the engine can emit). Both are checked here, because the two
 * failures look different in production: a missing translation is a crash, and a stale key is dead copy that
 * nobody notices is dead.
 */
import { describe, expect, it } from "vitest";
import type { SessionKind } from "@training-planner/domain";
import {
  ADJUST_COST_KEYS,
  ADJUST_REASON_KEYS,
  FACT_TEMPLATES,
  STOP_INSTRUCTION_KEYS,
  TEMPLATE_LIST_IS_COMPLETE,
} from "@training-planner/policy";
import { catalogues, format, formatNumber, placeholdersOf, weekdayName } from "../src/index";
import type { ExplainTemplate } from "../src/types";
import { LOCALES } from "../src/types";
import type { Locale, Messages } from "../src/types";

const sorted = (values: readonly string[]): string[] => [...values].sort();

/** Slots a template can be rendered with; the values are only there to satisfy the formatter. */
const SAMPLE_SLOTS: Record<string, Record<string, string | number>> = {
  "acknowledge.completed": { km: 12 },
  "acknowledge.skipped": { kind: "tempo" },
  "interpret.effort-gap": { gap: 2.5 },
  "interpret.legs-heavy": { legs: 4, scale: 5 },
  "interpret.pain-reported": { site: "knee", intensity: 4, scale: 10 },
  "redirect.tomorrow-swapped": { weekday: "Saturday" },
  "redirect.safety-instruction": { instruction: "stop" },
};

const slotsFor = (template: string): Record<string, string | number> => SAMPLE_SLOTS[template] ?? {};

describe("both catalogues speak the engine's key set", () => {
  it("has a template list that covers the FactTemplate union", () => {
    expect(TEMPLATE_LIST_IS_COMPLETE).toBe(true);
  });

  for (const locale of LOCALES) {
    it(`${locale}: comment keys are exactly the templates the engine can emit`, () => {
      expect(sorted(Object.keys(catalogues[locale].comment))).toEqual(sorted(FACT_TEMPLATES));
    });

    it(`${locale}: reason, cost and stop keys are complete`, () => {
      expect(sorted(Object.keys(catalogues[locale].reason))).toEqual(sorted(ADJUST_REASON_KEYS));
      expect(sorted(Object.keys(catalogues[locale].cost))).toEqual(sorted(ADJUST_COST_KEYS));
      expect(sorted(Object.keys(catalogues[locale].stop))).toEqual(sorted(STOP_INSTRUCTION_KEYS));
    });

    it(`${locale}: every session kind is named`, () => {
      const kinds: SessionKind[] = [
        "rest", "recovery", "easy", "strides", "long", "hills", "tempo", "vo2max", "mp", "cross-training", "strength", "test", "race",
      ];
      for (const kind of kinds) expect(catalogues[locale].kind[kind].length).toBeGreaterThan(0);
    });

    it(`${locale}: every template renders with its sample slots`, () => {
      for (const template of FACT_TEMPLATES) {
        const text = format(catalogues[locale].comment[template], slotsFor(template));
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/[{}]/);
      }
    });
  }
});

const EXPLAIN_TEMPLATES: ExplainTemplate[] = [
  "explain.summary",
  "explain.week-one",
  "explain.week-many",
  "explain.partial",
  "explain.peak",
];

const EXPLAIN_SLOTS: Record<ExplainTemplate, Record<string, string | number>> = {
  "explain.summary": { sessions: 42, weeks: 7, km: 60 },
  "explain.week-one": { weekday: "Monday", km: 23.6, hard: 1 },
  "explain.week-many": { weekday: "Monday", km: 44.6, hard: 2 },
  "explain.partial": { km: 23.6, days: 4, rate: 41.3 },
  "explain.peak": { km: 52.1, long: 16.7 },
};

describe("both catalogues explain a plan in both languages", () => {
  for (const locale of LOCALES) {
    it(`${locale}: explanation keys are complete and render`, () => {
      for (const template of EXPLAIN_TEMPLATES) {
        expect(catalogues[locale].explain[template].length).toBeGreaterThan(0);
        const text = format(catalogues[locale].explain[template], EXPLAIN_SLOTS[template]);
        expect(text).not.toMatch(/[{}]/);
        if (locale === "zh-Hant") expect(text).toMatch(/[\\u4e00-\\u9fff]/);
      }
    });
  }
});

describe("the copy follows the tone contract", () => {
  const allStrings = (messages: Messages): string[] => [
    ...Object.values(messages.comment),
    ...Object.values(messages.explain),
    ...Object.values(messages.reason),
    ...Object.values(messages.cost),
    ...Object.values(messages.stop),
    ...Object.values(messages.label),
  ];

  it("English carries at most one exclamation mark in the whole catalogue", () => {
    const count = allStrings(catalogues.en).join(" ").split("!").length - 1;
    expect(count).toBeLessThanOrEqual(1);
  });

  it("Chinese carries no exclamation marks at all", () => {
    expect(allStrings(catalogues["zh-Hant"]).join(" ")).not.toContain("!");
  });

  it("Chinese comment copy is actually Chinese", () => {
    for (const template of FACT_TEMPLATES) {
      // The safety sentence is a placeholder by design: its copy is the fixed stop text, which is checked below.
      if (template === "redirect.safety-instruction") continue;
      expect(catalogues["zh-Hant"].comment[template]).toMatch(/[\u4e00-\u9fff]/);
    }
    for (const key of STOP_INSTRUCTION_KEYS) {
      expect(catalogues["zh-Hant"].stop[key]).toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it("English comment copy is actually English", () => {
    for (const template of FACT_TEMPLATES) {
      expect(catalogues.en.comment[template]).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });
});

describe("the formatter refuses to guess", () => {
  it("throws on a missing slot instead of printing a hole", () => {
    expect(() => format("{km} km logged", {})).toThrow(/missing slots: km/);
  });

  it("throws on an unknown placeholder", () => {
    expect(() => format("hello {nope}", {})).toThrow(/missing slots: nope/);
  });

  it("renders numbers without trailing zeros and with one decimal at most", () => {
    expect(formatNumber(12)).toBe("12");
    expect(formatNumber(12.04)).toBe("12");
    expect(formatNumber(2.5)).toBe("2.5");
    expect(formatNumber(2.46)).toBe("2.5");
  });

  it("collapses the spaces a missing optional word would leave", () => {
    expect(format("today {km} km", { km: 5 })).toBe("today 5 km");
  });

  it("lists the placeholders a template needs", () => {
    expect(placeholdersOf("{km} km at {rpe}/10")).toEqual(["km", "rpe"]);
    expect(placeholdersOf("no slots here")).toEqual([]);
  });
});

describe("weekday names never leak a date into a comment", () => {
  const cases: Array<[Locale, string, string]> = [
    ["en", "2026-11-05", "Thursday"],
    ["en", "2026-11-08", "Sunday"],
    ["zh-Hant", "2026-11-05", "週四"],
    ["zh-Hant", "2026-11-08", "週日"],
  ];
  for (const [locale, day, expected] of cases) {
    it(`${locale} ${day} -> ${expected}`, () => {
      expect(weekdayName(locale, day)).toBe(expected);
    });
  }
});
