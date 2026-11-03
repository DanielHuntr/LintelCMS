import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * Text colours against the backgrounds they sit on, read from styles.css, in both colour
 * schemes. WCAG asks for 4.5:1 for normal text. Secondary text on the grey fill of
 * segmented controls was 4.38:1 in light and 4.29:1 in dark (LINTEL-A11Y-005). Tertiary
 * text is for placeholders and hints that repeat something said elsewhere, so it isn't held
 * to this.
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
  }
});
