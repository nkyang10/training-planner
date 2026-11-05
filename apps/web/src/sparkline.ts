/**
 * A pure SVG sparkline renderer for adherence percentages.
 *
 * No Date, no Math.random, no I/O: the same input always renders the same
 * string. Colour comes from `currentColor`, so CSS owns the palette and this
 * module owns only geometry.
 */

export interface SparklineInput {
  /** Adherence percentages in 0..100, oldest first. */
  values: readonly number[];
  /** Optional aria labels, one per point, used for the point markers. */
  labels?: readonly string[];
  /** Total width in CSS pixels. Defaults to 240. */
  width?: number;
  /** Total height in CSS pixels. Defaults to 56. */
  height?: number;
}

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 56;
/** Vertical breathing room so a 0% or 100% point is never clipped. */
const PADDING_Y = 6;

/** Local escape helper: labels are the only free text this renderer accepts. */
function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Trim float noise without changing the value's meaning. */
function formatCoordinate(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function formatValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function renderSparkline(input: SparklineInput): string {
  const { values } = input;
  if (values.length < 2) return "";

  const width = input.width ?? DEFAULT_WIDTH;
  const height = input.height ?? DEFAULT_HEIGHT;
  const clamped = values.map(clampPercent);
  const count = clamped.length;
  const [firstValue = 0] = clamped;
  let min = firstValue;
  let max = firstValue;
  let last = firstValue;
  for (const value of clamped) {
    if (value < min) min = value;
    if (value > max) max = value;
    last = value;
  }

  const innerHeight = Math.max(0, height - PADDING_Y * 2);
  const baseline = PADDING_Y + innerHeight;
  const step = width / (count - 1);
  const xOf = (index: number): string => formatCoordinate(index * step);
  const yOf = (value: number): string => formatCoordinate(baseline - (value / 100) * innerHeight);

  const linePoints = clamped.map((value, index) => `${xOf(index)},${yOf(value)}`);
  const areaPoints = [
    `0,${formatCoordinate(baseline)}`,
    ...linePoints,
    `${formatCoordinate(width)},${formatCoordinate(baseline)}`,
  ];

  const summary = `Adherence trend: last ${formatValue(last)}, min ${formatValue(min)}, max ${formatValue(max)}`;
  const ariaLabel = escapeText(summary);

  const markers =
    input.labels === undefined || input.labels.length === 0
      ? ""
      : clamped
          .map((value, index) => {
            const label = input.labels?.[index];
            if (label === undefined || label.length === 0) return "";
            return `<circle cx="${xOf(index)}" cy="${yOf(value)}" r="1.5" fill="currentColor"><title>${escapeText(label)}</title></circle>`;
          })
          .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${formatCoordinate(width)} ${formatCoordinate(height)}" width="${formatCoordinate(width)}" height="${formatCoordinate(height)}" role="img" aria-label="${ariaLabel}">`,
    `<title>${ariaLabel}</title>`,
    `<polygon points="${areaPoints.join(" ")}" fill="currentColor" fill-opacity="0.12" stroke="none" />`,
    `<polyline points="${linePoints.join(" ")}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />`,
    markers,
    `</svg>`,
  ].join("");
}
