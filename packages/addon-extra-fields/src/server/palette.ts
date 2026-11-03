import { defineFieldtype, escapeHtml } from "@lintel/core/plugin";
import { z } from "zod";
import { HEX_COLOUR, normaliseHex, readableTextColour, slugForColour } from "../shared/colours.js";

/**
 * The Colour palette field: a short, ordered list of named colours, such as a brand's
 * colours or a product's colourways. Stored as rows of `[name, "#rrggbb"]`, the shape the
 * admin's editors already pass around; delivered as `{ name, hex, slug, textColour }`, with
 * black or white as the text colour that reads on each.
 */

const colourSchema = z.object({
  name: z.string().trim().min(1).max(40),
  hex: z.string().transform((hex, context) => {
    const normalised = normaliseHex(hex);
    if (!normalised) {
      context.addIssue({ code: "custom", message: "should be a colour like #1a7f5a" });
      return z.NEVER;
    }
    return normalised;
  }),
});

export const paletteOptionsSchema = z.object({
  /** The most colours editors can add. */
  maxColours: z
    .number({ error: "The most colours should be a number" })
    .int({ error: "The most colours should be a whole number" })
    .min(1, { error: "Allow at least one colour" })
    .max(24, { error: "A palette can have at most 24 colours" })
    .default(12),
  /** When set, editors choose from these colours only, such as the brand's own. */
  choices: z
    .array(colourSchema, { error: "The colours to choose from should be a list" })
    .max(48, { error: "Offer at most 48 colours to choose from" })
    .default([]),
});
export type PaletteOptions = z.output<typeof paletteOptionsSchema>;

/** One colour as stored: its name and "#rrggbb". */
export type StoredColour = [name: string, hex: string];

export interface DeliveredColour {
  name: string;
  hex: string;
  /** "forest-green", for CSS variables and class names. */
  slug: string;
  /** Black or white, whichever reads better on the colour. */
  textColour: "#000000" | "#ffffff";
}

export const paletteFieldtype = defineFieldtype({
  type: "extra-fields.palette",
  name: "Colour palette",
  description: "A few named colours in order, such as your brand colours or a product's range.",
  category: "media",
  keywords: ["color", "colour", "palette", "swatches", "brand", "colourway"],
  optionsSchema: paletteOptionsSchema,
  buildValueSchema: (options, label) => {
    const allowed = new Set(options.choices.map((choice) => choice.hex));
    const colour = z
      .union(
        [
          z.tuple([z.string(), z.string()]),
          z
            .object({ name: z.string(), hex: z.string() })
            .transform(({ name, hex }): [string, string] => [name, hex]),
        ],
        { error: `Each colour in ${label} needs a name and a colour` },
      )
      .transform(([name, hex], context): StoredColour => {
        const trimmed = name.trim();
        const normalised = normaliseHex(hex);
        if (trimmed === "") {
          context.addIssue({ code: "custom", message: `Give every colour in ${label} a name` });
        } else if (trimmed.length > 40) {
          context.addIssue({
            code: "custom",
            message: `Keep colour names in ${label} under 40 characters`,
          });
        }
        if (!normalised) {
          context.addIssue({
            code: "custom",
            message: `${hex} in ${label} should be a colour like #1a7f5a`,
          });
        } else if (allowed.size > 0 && !allowed.has(normalised)) {
          context.addIssue({
            code: "custom",
            message: `${label} can only use the colours offered for it`,
          });
        }
        return [trimmed, normalised ?? hex];
      });
    return z
      .array(colour, { error: `${label} should be a list of colours` })
      .max(options.maxColours, {
        error: `${label} can have at most ${options.maxColours} colours`,
      });
  },
  deliver: (value): DeliveredColour[] => readPalette(value),
});

/** A palette as stored (rows) or as delivered (objects); colours that aren't are skipped. */
export function readPalette(value: unknown): DeliveredColour[] {
  if (!Array.isArray(value)) return [];
  const colours: DeliveredColour[] = [];
  for (const item of value) {
    const [name, hex] = Array.isArray(item)
      ? [item[0], item[1]]
      : typeof item === "object" && item !== null
        ? [(item as { name?: unknown }).name, (item as { hex?: unknown }).hex]
        : [undefined, undefined];
    if (typeof name !== "string" || typeof hex !== "string") continue;
    const normalised = normaliseHex(hex);
    if (!normalised || !HEX_COLOUR.test(normalised)) continue;
    colours.push({
      name,
      hex: normalised,
      slug: slugForColour(name),
      textColour: readableTextColour(normalised),
    });
  }
  return colours;
}

/** `{{ brand | extra_fields_swatches }}`: each colour as a chip with its name and code. */
export function renderSwatches(value: unknown): string {
  const colours = readPalette(value);
  if (colours.length === 0) return "";
  const items = colours
    .map(
      (colour) =>
        `<li class="extra-fields-swatch" style="background:${colour.hex};color:${colour.textColour};padding:0.75em 1em;border-radius:10px;box-shadow:inset 0 0 0 1px rgb(0 0 0 / 0.12);min-width:8em">` +
        `<span style="display:block;font-weight:600">${escapeHtml(colour.name)}</span>` +
        `<span style="display:block;font-size:0.85em;opacity:0.85">${colour.hex}</span></li>`,
    )
    .join("");
  return `<ul class="extra-fields-swatches" role="list" style="list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:0.5em">${items}</ul>`;
}

/**
 * `{{ brand | extra_fields_css_variables }}`: "--palette-forest-green: #1a7f5a;" for each
 * colour, for a `<style>` block or a `style` attribute. `| extra_fields_css_variables: "brand"`
 * names them "--brand-…" instead. Names that come out the same get a number.
 */
export function renderCssVariables(value: unknown, prefix?: unknown): string {
  const start =
    typeof prefix === "string" && prefix.trim() !== "" ? slugForColour(prefix) : "palette";
  const used = new Map<string, number>();
  return readPalette(value)
    .map((colour) => {
      const count = (used.get(colour.slug) ?? 0) + 1;
      used.set(colour.slug, count);
      const name = count === 1 ? colour.slug : `${colour.slug}-${count}`;
      return `--${start}-${name}: ${colour.hex};`;
    })
    .join(" ");
}
