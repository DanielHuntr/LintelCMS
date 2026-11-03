import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Text colours against the backgrounds they sit on, read from styles.css, in both colour
 * schemes. WCAG asks for 4.5:1 for normal text. Secondary text on the grey fill of
 * segmented controls was 4.38:1 in light and 4.29:1 in dark (LINTEL-A11Y-005). Tertiary
 * text (hints, counts, placeholders) was 3.16:1 in light and 4.0:1 in dark (LINTEL-A11Y-022);
 * it is held to 4.5:1 on the page and cards. Focus rings need 3:1 (WCAG 1.4.11; LINTEL-A11Y-025).
 */

const styles = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../styles.css"), "utf8");
const baseLayer = styles.slice(styles.indexOf("@layer base"));
const darkStart = baseLayer.indexOf("@variant scheme-dark");

function tokens(block: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of block.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    if (name && value && !found.has(name)) found.set(name, value.trim());
  }
  return found;
}

const schemes = {
  light: tokens(baseLayer.slice(0, darkStart)),
  dark: tokens(baseLayer.slice(darkStart)),
};

type Rgb = [number, number, number];

function parse(colour: string, below: Rgb): Rgb {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour);
  if (hex?.[1]) {
    const value = hex[1];
    return [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16)) as Rgb;
  }
  const rgb = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(colour);
  if (!rgb) throw new Error(`Can't read the colour ${colour}`);
  const alpha = Number(rgb[4] ?? 1);
  return [1, 2, 3].map(
    (index) => alpha * Number(rgb[index]) + (1 - alpha) * (below[index - 1] ?? 0),
  ) as Rgb;
}

function mixed(colour: Rgb, below: Rgb, share: number): Rgb {
  return colour.map((channel, index) => share * channel + (1 - share) * (below[index] ?? 0)) as Rgb;
}

/** How much of the colour each focus ring utility mixes in, read from styles.css. */
function ringShare(utility: string): { token: string; share: number } {
  const start = styles.indexOf(`@utility ${utility} {`);
  const body = start < 0 ? "" : styles.slice(start, styles.indexOf("}", start));
  const ring = /color-mix\(in srgb, var\(--color-([\w-]+)\) (\d+)%/.exec(body);
  if (!ring?.[1] || !ring[2]) throw new Error(`No ${utility} in styles.css`);
  return { token: ring[1], share: Number(ring[2]) / 100 };
}

function luminance([red, green, blue]: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: Rgb, second: Rgb): number {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

describe("text colour contrast", () => {
  for (const [scheme, colours] of Object.entries(schemes)) {
    const colour = (name: string) => {
      const value = colours.get(name);
      if (!value) throw new Error(`No --color-${name} in the ${scheme} scheme`);
      return value;
    };
    const surfaces = ["background", "surface", "surface-raised"].map((name) =>
      parse(colour(name), [0, 0, 0]),
    );
    // The fill is see-through, so it is measured on each surface it can sit on.
    const backgrounds = [...surfaces, ...surfaces.map((surface) => parse(colour("fill"), surface))];

    for (const text of ["label", "label-secondary"]) {
      it(`keeps ${text} at 4.5:1 or more on every background, in ${scheme}`, () => {
        const lowest = Math.min(
          ...backgrounds.map((background) => contrast(parse(colour(text), background), background)),
        );
        expect(lowest).toBeGreaterThanOrEqual(4.5);
      });
    }

    it(`keeps label-tertiary at 4.5:1 or more on the page and cards, in ${scheme}`, () => {
      const lowest = Math.min(
        ...surfaces.map((surface) => contrast(parse(colour("label-tertiary"), surface), surface)),
      );
      expect(lowest).toBeGreaterThanOrEqual(4.5);
    });

    it(`keeps success badge text at 4.5:1 or more on its tint, in ${scheme}`, () => {
      // Badge.tsx: "bg-success/14 text-success", 12px text.
      const success = parse(colour("success"), [0, 0, 0]);
      const lowest = Math.min(
        ...surfaces.map((surface) => contrast(success, mixed(success, surface, 0.14))),
      );
      expect(lowest).toBeGreaterThanOrEqual(4.5);
    });

    for (const utility of ["focus-ring", "focus-ring-inset", "focus-ring-danger"]) {
      it(`keeps ${utility} at 3:1 or more against the page and cards, in ${scheme}`, () => {
        const { token, share } = ringShare(utility);
        const ring = parse(colour(token), [0, 0, 0]);
        const lowest = Math.min(
          ...surfaces.map((surface) => contrast(mixed(ring, surface, share), surface)),
        );
        expect(lowest).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
