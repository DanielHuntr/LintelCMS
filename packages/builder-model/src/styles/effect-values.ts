/**
 * Small readers and writers for values the Style panel builds from separate controls:
 * filters (`blur(4px) grayscale(100%)`), skews, and fluid type sizes that grow with the
 * screen. Each reader returns null for a value it didn't write, so hand-written CSS is left
 * alone and shown as text instead.
 */

export const filterNames = [
  "blur",
  "grayscale",
  "brightness",
  "contrast",
  "saturate",
  "hue-rotate",
  "drop-shadow",
] as const;

export type FilterName = (typeof filterNames)[number];
export type FilterValues = Partial<Record<FilterName, string>>;

/** What each filter is when it changes nothing, so a control can start there. */
export const neutralFilterValues: Record<FilterName, string> = {
  blur: "0px",
  grayscale: "0%",
  brightness: "100%",
  contrast: "100%",
  saturate: "100%",
  "hue-rotate": "0deg",
  "drop-shadow": "0 0 0 transparent",
};

export function parseFilters(value: string | undefined): FilterValues | null {
  if (!value || value.trim() === "none") return {};
  const found: FilterValues = {};
  const calls = [...value.matchAll(/([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/g)];
  const rebuilt = calls.map((call) => call[0]).join(" ");
  if (rebuilt.replace(/\s+/g, "") !== value.replace(/\s+/g, "")) return null;
  for (const call of calls) {
    const name = call[1] as FilterName;
    if (!filterNames.includes(name)) return null;
    found[name] = (call[2] ?? "").trim();
  }
  return found;
}

/** Filters in a fixed order, leaving out the ones that change nothing; undefined for none. */
export function filterValue(values: FilterValues): string | undefined {
  const parts = filterNames.flatMap((name) => {
    const amount = values[name];
    return amount === undefined || amount === neutralFilterValues[name]
      ? []
      : [`${name}(${amount})`];
  });
  return parts.length === 0 ? undefined : parts.join(" ");
}

/** `skew(10deg, 0deg)` as its two angles, or null. */
export function parseSkew(value: string | undefined): { x: number; y: number } | null {
  if (!value) return { x: 0, y: 0 };
  const match = /^skew\(\s*(-?[\d.]+)deg(?:\s*,\s*(-?[\d.]+)deg)?\s*\)$/.exec(value.trim());
  return match ? { x: Number(match[1]), y: Number(match[2] ?? 0) } : null;
}

export function skewValue(x: number, y: number): string | undefined {
  return x === 0 && y === 0 ? undefined : `skew(${x}deg, ${y}deg)`;
}

/** The narrowest and widest screens fluid sizes scale between, in pixels. */
export const fluidScreenRange = { smallest: 390, largest: 1440 } as const;

/**
 * A font size that grows from `smallest` (in rem) on a phone to `largest` on a wide screen,
 * smoothly in between: `clamp(2rem, 1.26rem + 3.05vw, 4rem)`.
 */
export function fluidSize(smallest: number, largest: number): string {
  const { smallest: narrow, largest: wide } = fluidScreenRange;
  const slope = ((largest - smallest) * 16) / (wide - narrow);
  const intercept = smallest - (slope * narrow) / 16;
  const round = (value: number) => Math.round(value * 100) / 100;
  return `clamp(${round(smallest)}rem, ${round(intercept)}rem + ${round(slope * 100)}vw, ${round(largest)}rem)`;
}

/** The smallest and largest sizes of a fluid size, or null when the value isn't one. */
export function readFluidSize(
  value: string | undefined,
): { smallest: number; largest: number } | null {
  const match = value
    ? /^clamp\(\s*([\d.]+)rem\s*,[^,]+,\s*([\d.]+)rem\s*\)$/.exec(value.trim())
    : null;
  return match ? { smallest: Number(match[1]), largest: Number(match[2]) } : null;
}
