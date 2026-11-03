import { defineFieldtype, escapeHtml } from "@lintel/core/plugin";
import { z } from "zod";

/**
 * The Colour swatch field: a colour picked from the site's own palette (set per field), or
 * any colour when the field has none. Stored as "#rrggbb"; delivered with a name and the
 * text colour that reads on it, so a template or website doesn't have to work those out.
 */

const HEX = /^#[0-9a-f]{6}$/;

export const swatchOptionsSchema = z.object({
  /** The colours editors choose from, as "#rrggbb". Empty means any colour. */
  palette: z.array(z.string().toLowerCase().regex(HEX)).default([]),
});

export interface DeliveredSwatch {
  hex: string;
  name: string;
  /** Black or white, whichever reads better on the colour. */
  textColour: "#000000" | "#ffffff";
}

export const swatchFieldtype = defineFieldtype({
  type: "example.swatch",
  name: "Colour swatch",
  description: "A colour picked from your palette, such as a product's colour.",
  category: "choices",
  keywords: ["color", "colour", "palette", "swatch"],
  optionsSchema: swatchOptionsSchema,
  buildValueSchema: (options, label) =>
    z
      .string({ error: `${label} should be a colour` })
      .toLowerCase()
      .regex(HEX, { error: `${label} should be a colour like #1a7f5a` })
      .refine((hex) => options.palette.length === 0 || options.palette.includes(hex), {
        error: `${label} should be one of the palette's colours`,
      }),
  deliver: (value): DeliveredSwatch | null =>
    typeof value === "string" && HEX.test(value) ? describeSwatch(value) : null,
});

/** A few names people know, matched to the nearest; the rest are named by their hex. */
const NAMED: ReadonlyArray<[string, [number, number, number]]> = [
  ["Black", [0, 0, 0]],
  ["White", [255, 255, 255]],
  ["Grey", [128, 128, 128]],
  ["Red", [200, 30, 30]],
  ["Orange", [240, 130, 20]],
  ["Yellow", [240, 210, 40]],
  ["Green", [30, 140, 70]],
  ["Teal", [20, 128, 128]],
  ["Blue", [30, 90, 200]],
  ["Navy", [20, 30, 90]],
  ["Purple", [120, 50, 160]],
  ["Pink", [240, 130, 170]],
  ["Brown", [120, 70, 30]],
];

export function describeSwatch(hex: string): DeliveredSwatch {
  const rgb = toRgb(hex);
  let best = NAMED[0] as (typeof NAMED)[number];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const named of NAMED) {
    const distance = named[1].reduce(
      (sum, part, index) => sum + (part - (rgb[index] ?? 0)) ** 2,
      0,
    );
    if (distance < bestDistance) {
      best = named;
      bestDistance = distance;
    }
  }
  return { hex, name: best[0], textColour: luminance(rgb) > 0.45 ? "#000000" : "#ffffff" };
}

/** A small chip of the colour with its name, for `{{ value | example_swatch }}`. */
export function renderSwatchChip(value: unknown): string {
  const swatch = readSwatch(value);
  if (!swatch) return "";
  return `<span class="example-swatch" style="background:${swatch.hex};color:${swatch.textColour}">${escapeHtml(swatch.name)}</span>`;
}

/** A swatch as stored ("#1a7f5a") or as delivered ({ hex, name, textColour }). */
export function readSwatch(value: unknown): DeliveredSwatch | null {
  if (typeof value === "string") return HEX.test(value) ? describeSwatch(value) : null;
  if (
    typeof value === "object" &&
    value !== null &&
    "hex" in value &&
    typeof value.hex === "string"
  ) {
    return HEX.test(value.hex) ? describeSwatch(value.hex) : null;
  }
  return null;
}

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

/** Relative luminance, 0 (black) to 1 (white), as WCAG works it out. */
function luminance([red, green, blue]: [number, number, number]): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}
