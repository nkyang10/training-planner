import { describe, expect, it } from "vitest";
import {
  COACH_CHAT_RULES,
  MAX_HISTORY_TURNS,
  buildCoachChatRequest,
  validateCoachReply,
} from "../src/index";
import type { CoachChatTurn, CoachFactSnapshot } from "../src/index";

const facts: CoachFactSnapshot = {
  today: "2026-11-05",
  planSummary: "4 weeks, 71.4 km planned, 16 sessions",
  recentEntries: ["2026-11-03 completed 4.2 km, knee pain 3/10"],
  comment: "Keep the effort easy while the knee settles.",
  references: [{ id: "ref-safety-knee", text: "Knee pain at rest warrants a clinician.", tier: "safety" }],
};

const turn = (role: "user" | "coach", text: string): CoachChatTurn => ({ role, text });

describe("buildCoachChatRequest", () => {
  it("is deterministic for the same input", () => {
    const input = {
      facts,
      history: [turn("user", "How is my knee?"), turn("coach", "It is settling.")],
      question: "What should I do today?",
    };
    const first = buildCoachChatRequest(input);
    const second = buildCoachChatRequest(input);
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.system.rules).toEqual([...COACH_CHAT_RULES]);
    expect(first.system.rules).toHaveLength(5);
  });

  it("caps history at the last 100 turns", () => {
    const history = Array.from({ length: 150 }, (_, index) => turn(index % 2 === 0 ? "user" : "coach", `turn-${index}`));
    const request = buildCoachChatRequest({ facts, history, question: "Still on track?" });
    expect(request.history).toHaveLength(MAX_HISTORY_TURNS);
    expect(request.history[0]).toEqual({ role: "user", text: "turn-50" });
    expect(request.history.at(-1)).toEqual({ role: "coach", text: "turn-149" });
  });

  it("keeps the newest turns under the character budget and never drops the question", () => {
    const history = Array.from({ length: 120 }, (_, index) => turn("user", `${index}-${"x".repeat(1000)}`));
    const request = buildCoachChatRequest({ facts, history, question: "Still on track?" });
    const total = request.history.reduce((sum, item) => sum + item.text.length, 0) + request.question.length;
    expect(total).toBeLessThanOrEqual(100_000);
    expect(request.history.at(-1)?.text.startsWith("119-")).toBe(true);
    expect(request.question).toBe("Still on track?");
  });

  it("trims the question and drops an empty one", () => {
    const trimmed = buildCoachChatRequest({ facts, history: [], question: "  How is my knee?  " });
    expect(trimmed.question).toBe("How is my knee?");
    const empty = buildCoachChatRequest({ facts, history: [], question: "   " });
    expect(empty.question).toBe("");
    expect(empty.history).toEqual([]);
  });

  it("keeps prior turns in history and the question separate", () => {
    const request = buildCoachChatRequest({
      facts,
      history: [turn("user", "How is my knee?")],
      question: "What should I do today?",
    });
    expect(request.history).toEqual([{ role: "user", text: "How is my knee?" }]);
    expect(request.question).toBe("What should I do today?");
  });
});

describe("validateCoachReply", () => {
  it("accepts a grounded reply", () => {
    const verdict = validateCoachReply(
      { reply: "Your knee report was 3/10.", proposeReview: false, reasonCode: null },
      facts,
      "How is my knee?",
    );
    expect(verdict).toEqual({
      ok: true,
      reply: { reply: "Your knee report was 3/10.", proposeReview: false, reasonCode: null },
    });
  });

  it("accepts proposeReview=false with a null reasonCode", () => {
    const verdict = validateCoachReply(
      { reply: "Keep it easy today.", proposeReview: false, reasonCode: null },
      facts,
      "What should I do today?",
    );
    expect(verdict.ok).toBe(true);
  });

  it("rejects an invented number", () => {
    const verdict = validateCoachReply(
      { reply: "You should run 12 km tomorrow.", proposeReview: false, reasonCode: null },
      facts,
      "What should I do today?",
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("expected a rejection");
    expect(verdict.code).toBe("ungrounded-number");
    expect(verdict.detail).toContain("12");
  });

  it("rejects extra keys", () => {
    const verdict = validateCoachReply(
      { reply: "Your knee report was 3/10.", proposeReview: false, reasonCode: null, confidence: "high" },
      facts,
      "How is my knee?",
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("expected a rejection");
    expect(verdict.code).toBe("extra-keys");
    expect(verdict.detail).toContain("confidence");
  });

  it("rejects links", () => {
    const verdict = validateCoachReply(
      { reply: "See https://example.com for the plan.", proposeReview: false, reasonCode: null },
      facts,
      "Where can I read more?",
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("expected a rejection");
    expect(verdict.code).toBe("no-links");
  });

  it("rejects proposeReview=true with a null reasonCode", () => {
    const verdict = validateCoachReply(
      { reply: "Your knee report was 3/10, so a review may help.", proposeReview: true, reasonCode: null },
      facts,
      "How is my knee?",
    );
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("expected a rejection");
    expect(verdict.code).toBe("reason-required");
  });

  it("rejects a reply longer than 600 characters", () => {
    const longReply = "gentle effort. ".repeat(45);
    expect(longReply.length).toBeGreaterThan(600);
    const verdict = validateCoachReply({ reply: longReply, proposeReview: false, reasonCode: null }, facts, "");
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error("expected a rejection");
    expect(verdict.code).toBe("reply-too-long");
  });
});
