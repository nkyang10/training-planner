import { describe, expect, it } from "vitest";

import { renderSparkline } from "../src/sparkline";

function pointsOf(svg: string, tag: "polyline" | "polygon"): string[] {
  const match = new RegExp(`<${tag}[^>]*points="([^"]*)"`).exec(svg);
  const raw = match?.[1];
  if (raw === undefined) throw new Error(`no <${tag}> in ${svg}`);
  return raw.trim().split(/\s+/);
}

describe("renderSparkline", () => {
  it("returns an empty string when there are no values", () => {
    expect(renderSparkline({ values: [] })).toBe("");
  });

  it("returns an empty string for a single value", () => {
    expect(renderSparkline({ values: [50] })).toBe("");
  });

  it("renders one polyline, one area polygon and one pair per point", () => {
    const svg = renderSparkline({ values: [10, 50, 90] });
    expect(svg.match(/<polyline/g)).toHaveLength(1);
    expect(svg.match(/<polygon/g)).toHaveLength(1);
    expect(pointsOf(svg, "polyline")).toHaveLength(3);
    expect(pointsOf(svg, "polygon")).toHaveLength(5);
    expect(pointsOf(svg, "polyline").length + pointsOf(svg, "polygon").length).toBe(8);
  });

  it("uses the default viewBox and honours a custom width and height", () => {
    expect(renderSparkline({ values: [10, 90] })).toContain('viewBox="0 0 240 56"');
    const custom = renderSparkline({ values: [10, 90], width: 120, height: 40 });
    expect(custom).toContain('viewBox="0 0 120 40"');
    expect(custom).toContain('width="120"');
    expect(custom).toContain('height="40"');
  });

  it("spaces points evenly across the width", () => {
    const svg = renderSparkline({ values: [0, 50, 100], width: 240, height: 56 });
    expect(pointsOf(svg, "polyline")).toEqual(["0,50", "120,28", "240,6"]);
  });

  it("clamps values into 0..100", () => {
    const svg = renderSparkline({ values: [150, -5] });
    expect(pointsOf(svg, "polyline")).toEqual(["0,6", "240,50"]);
    expect(svg).toContain("last 0, min 0, max 100");
  });

  it("summarises min, max and last in the aria-label and title", () => {
    const svg = renderSparkline({ values: [25, 88, 42] });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Adherence trend: last 42, min 25, max 88"');
    expect(svg).toContain("<title>Adherence trend: last 42, min 25, max 88</title>");
  });

  it("is deterministic for the same input", () => {
    const input = { values: [12, 80, 33, 55], labels: ["a", "b", "c", "d"] };
    expect(renderSparkline(input)).toBe(renderSparkline(input));
    expect(renderSparkline({ values: [12, 80, 33, 55] })).toBe(renderSparkline({ values: [12, 80, 33, 55] }));
  });

  it("escapes label text instead of interpolating it raw", () => {
    const svg = renderSparkline({ values: [10, 90], labels: ['a"<b>&', "ok"] });
    expect(svg).toContain("a&quot;&lt;b&gt;&amp;");
    expect(svg).not.toContain('a"<b>&');
  });

  it("lets CSS own the colour via currentColor", () => {
    const svg = renderSparkline({ values: [10, 90] });
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain('vector-effect="non-scaling-stroke"');
  });
});
