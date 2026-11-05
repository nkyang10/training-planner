import { describe, expect, it } from "vitest";

import { renderCoachPanel } from "../src/coach-panel";

describe("renderCoachPanel", () => {
  it("posts the question to the day's coach route", () => {
    const html = renderCoachPanel({ locale: "en", day: "2026-11-09" });

    expect(html).toContain('action="/day/2026-11-09/coach"');
    expect(html).toContain('method="post"');
    expect(html).toContain('class="card coach-panel"');
  });

  it("has a bounded question box and a primary submit", () => {
    const html = renderCoachPanel({ locale: "en", day: "2026-11-09" });

    expect(html).toContain("<textarea");
    expect(html).toContain('name="question"');
    expect(html).toContain("required");
    expect(html).toContain('maxlength="500"');
    // The box carries an accessible name, and a placeholder that is never the only label.
    expect(html).toMatch(/<textarea[^>]*aria-label="[^"]+"/);
    expect(html).toMatch(/<textarea[^>]*placeholder="[^"]+"/);
    expect(html).toContain('<button class="btn btn-primary" type="submit">');
  });

  it("escapes a status and an error that carry a script tag", () => {
    const html = renderCoachPanel({
      locale: "en",
      day: "2026-11-09",
      status: '<script>alert("status")</script>',
      error: "<script>alert(1)</script>",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('<p class="chip done" role="status">');
    expect(html).toContain('<p class="error" role="alert">');
  });

  it("rejects a day that is not ISO instead of rendering a bad link", () => {
    expect(() => renderCoachPanel({ locale: "en", day: "not-a-day" })).toThrow("day must be ISO");
    expect(() => renderCoachPanel({ locale: "en", day: "2026-11-9" })).toThrow(/day must be ISO/);
  });

  it("renders in zh-Hant without crashing, catalogue or fallback copy alike", () => {
    const html = renderCoachPanel({ locale: "zh-Hant", day: "2026-11-09" });

    expect(html).toContain('class="card coach-panel"');
    expect(html).toContain('action="/day/2026-11-09/coach"');
    expect(html).toContain('name="question"');
    // No English fallback label leaks into the Chinese page.
    expect(html).not.toContain(">Question<");
    expect(html.trim().length).toBeGreaterThan(0);
  });
});
