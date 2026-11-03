/**
 * The fonts that come with Lintel: open-licence (SIL OFL) families from Google Fonts, as
 * Latin WOFF2 files in `packages/builder-model/fonts`, fetched once from the `@fontsource`
 * packages by `scripts/fetch-fonts.mjs` and served by the website from `/_lintel/fonts/`.
 * They are on the site's own server, so visitors' browsers never ask Google for anything.
 *
 * Each family lists the weights and styles it ships with; the stylesheet declares them all
 * and browsers only download the ones a page uses.
 */

export type FontCategory = "sans" | "display" | "serif" | "script" | "mono";

export interface CatalogueFont {
  /** As in the file names: "bebas-neue". */
  id: string;
  family: string;
  category: FontCategory;
  /** One plain sentence for the font list. */
  description: string;
  weights: readonly number[];
  /** The weights that also come in italic. */
  italicWeights: readonly number[];
}

export const fontFilesFolder = "/_lintel/fonts";

/** What a page falls back to while the font loads, or if it can't. */
export const fallbackFamilies: Record<FontCategory, string> = {
  sans: "system-ui, sans-serif",
  display: "Impact, 'Arial Narrow', sans-serif",
  serif: "Georgia, serif",
  script: "cursive",
  mono: "ui-monospace, monospace",
};

function font(
  id: string,
  family: string,
  category: FontCategory,
  description: string,
  weights: readonly number[],
  italicWeights: readonly number[] = [],
): CatalogueFont {
  return { id, family, category, description, weights, italicWeights };
}

export const fontCatalogue: readonly CatalogueFont[] = [
  font("inter", "Inter", "sans", "Clear and neutral, for any text.", [400, 700], [400]),
  font("dm-sans", "DM Sans", "sans", "Friendly and round, good at small sizes.", [400, 700], [400]),
  font("space-grotesk", "Space Grotesk", "sans", "Quirky, technical headlines.", [400, 500, 700]),
  font("manrope", "Manrope", "sans", "Modern and open.", [400, 700]),
  font("work-sans", "Work Sans", "sans", "Plain and sturdy.", [400, 700], [400]),
  font(
    "archivo",
    "Archivo",
    "sans",
    "A grotesque for bold editorial pages.",
    [400, 700, 900],
    [400],
  ),
  font("syne", "Syne", "display", "Wide and arty.", [400, 700, 800]),
  font("unbounded", "Unbounded", "display", "Round, wide and loud.", [400, 700]),
  font("bebas-neue", "Bebas Neue", "display", "Tall capitals for big headlines.", [400]),
  font("anton", "Anton", "display", "Heavy, condensed display type.", [400]),
  font("oswald", "Oswald", "display", "Condensed, for headlines and labels.", [400, 700]),
  font(
    "big-shoulders-display",
    "Big Shoulders Display",
    "display",
    "Very condensed and industrial.",
    [700, 900],
  ),
  font("archivo-black", "Archivo Black", "display", "Black and wide, for posters.", [400]),
  font(
    "playfair-display",
    "Playfair Display",
    "serif",
    "High-contrast, elegant headlines.",
    [400, 700],
    [400],
  ),
  font("dm-serif-display", "DM Serif Display", "serif", "Soft, classic headlines.", [400], [400]),
  font("fraunces", "Fraunces", "serif", "A warm, old-style serif.", [400, 700], [400]),
  font("instrument-serif", "Instrument Serif", "serif", "Narrow and refined.", [400], [400]),
  font("lora", "Lora", "serif", "A readable serif for long text.", [400, 700], [400]),
  font("yellowtail", "Yellowtail", "script", "A retro brush script, for stickers.", [400]),
  font("pacifico", "Pacifico", "script", "A playful surf-style script.", [400]),
  font("kaushan-script", "Kaushan Script", "script", "An energetic brush script.", [400]),
  font("caveat", "Caveat", "script", "Handwriting.", [400, 700]),
  font("space-mono", "Space Mono", "mono", "A characterful monospace.", [400, 700], [400]),
];

export function findCatalogueFont(id: string): CatalogueFont | undefined {
  return fontCatalogue.find((candidate) => candidate.id === id);
}

export interface FontFace {
  family: string;
  weight: string;
  style: "normal" | "italic";
  src: string;
  format: FontFormat;
  /** Which characters the file covers, for fonts split by alphabet: "U+0000-00FF, U+0131". */
  unicodeRange?: string;
}

/** One `@font-face` rule. `font-display: swap` shows the text straight away in the fallback. */
export function fontFaceRule(face: FontFace): string {
  const lines = [
    `  font-family: '${face.family}';`,
    `  src: url("${face.src}") format("${face.format}");`,
    `  font-weight: ${face.weight};`,
    `  font-style: ${face.style};`,
    "  font-display: swap;",
    ...(face.unicodeRange ? [`  unicode-range: ${face.unicodeRange};`] : []),
  ];
  return `@font-face {\n${lines.join("\n")}\n}`;
}

export type FontFormat = "woff2" | "woff" | "truetype" | "opentype";

/** Every file of a catalogue family, as font faces. */
export function catalogueFontFaces(entry: CatalogueFont): FontFace[] {
  const face = (weight: number, style: "normal" | "italic"): FontFace => ({
    family: entry.family,
    weight: String(weight),
    style,
    src: `${fontFilesFolder}/${catalogueFontFile(entry.id, weight, style)}`,
    format: "woff2",
  });
  return [
    ...entry.weights.map((weight) => face(weight, "normal")),
    ...entry.italicWeights.map((weight) => face(weight, "italic")),
  ];
}

export function catalogueFontFile(id: string, weight: number, style: "normal" | "italic"): string {
  return `${id}-latin-${weight}-${style}.woff2`;
}

/** Whether a file name is one of the catalogue's font files, so the website may serve it. */
export function isCatalogueFontFile(fileName: string): boolean {
  return fontCatalogue.some((entry) =>
    catalogueFontFaces(entry).some((face) => face.src.endsWith(`/${fileName}`)),
  );
}
