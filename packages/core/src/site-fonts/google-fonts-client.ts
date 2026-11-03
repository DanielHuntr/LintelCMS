import { categoryFromGoogle, type FontCategory } from "@lintel/builder-model";
import { z } from "zod";
import { TimedCache } from "../free-photos/timed-cache.js";
import type { FontNetwork } from "./font-network.js";
import { FontServiceUnreachableError } from "./site-fonts.errors.js";

/**
 * The Google Fonts library, read from Fontsource (fontsource.org), which republishes every
 * Google Fonts family, with its open licence, as ready-split WOFF2 files. Its API needs no
 * key or account. Lintel only ever downloads files here, on the server, and serves them
 * itself: visitors' browsers never ask Google or Fontsource for anything.
 *
 * The list (about 2,000 families, half a megabyte) is kept for a day; a family's details
 * and preview files for an hour.
 */
const LIST_URL = "https://api.fontsource.org/v1/fonts";
const detailsUrl = (id: string) => `https://api.fontsource.org/v1/fonts/${id}`;
const fileUrl = (id: string, subset: string, weight: string, style: string) =>
  `https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/${subset}-${weight}-${style}.woff2`;

const MAX_LIST_BYTES = 4 * 1024 * 1024;
const MAX_DETAILS_BYTES = 512 * 1024;
/** Fontsource's split files are small; a whole family's Latin file is rarely over 200 KB. */
export const MAX_FONT_FILE_BYTES = 2 * 1024 * 1024;

/** All the font files kept in memory at once, together: enough for a few families. */
export const MAX_CACHED_FONT_BYTES = 32 * 1024 * 1024;
const MAX_CACHED_FONT_ENTRIES = 1000;

/**
 * Font files kept for a while, so previewing and then adding a family downloads each file
 * once. Bounded by their total size rather than their number (a file can be 2 MB), forgetting
 * the oldest first. "There is no such file" (null) is kept too, at no cost.
 */
export class FontFileCache {
  private readonly entries = new Map<string, { value: Buffer | null; expiresAt: number }>();
  private totalBytes = 0;

  constructor(
    private readonly keepMilliseconds: number,
    private readonly maxBytes: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** The bytes kept now, for tests. */
  get size(): number {
    return this.totalBytes;
  }

  read(key: string): Buffer | null | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.forget(key);
      return undefined;
    }
    return entry.value;
  }

  write(key: string, value: Buffer | null): void {
    this.forget(key);
    const bytes = value?.length ?? 0;
    if (bytes > this.maxBytes) return;
    this.entries.set(key, { value, expiresAt: this.now() + this.keepMilliseconds });
    this.totalBytes += bytes;
    // A Map keeps insertion order, so the first key is the oldest.
    while (this.totalBytes > this.maxBytes || this.entries.size > MAX_CACHED_FONT_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.forget(oldest);
    }
  }

  private forget(key: string): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.totalBytes -= entry.value?.length ?? 0;
    this.entries.delete(key);
  }
}

export const googleFontIdSchema = z
  .string({ error: "Choose a font" })
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, { error: "That isn't a Google Fonts family" });

const listedFontSchema = z.object({
  id: z.string(),
  family: z.string(),
  category: z.string(),
  weights: z.array(z.number()),
  styles: z.array(z.string()),
  subsets: z.array(z.string()),
  defSubset: z.string().optional(),
  type: z.string(),
});

const detailsSchema = listedFontSchema.extend({
  unicodeRange: z.record(z.string(), z.string()).default({}),
});

export interface GoogleFont {
  id: string;
  family: string;
  category: FontCategory;
  weights: string[];
  hasItalic: boolean;
  subsets: string[];
  defaultSubset: string;
}

export interface GoogleFontDetails extends GoogleFont {
  /** Each alphabet's characters, for the `unicode-range` of its file. */
  unicodeRanges: Record<string, string>;
}

export interface GoogleFontsClient {
  listFonts(): Promise<GoogleFont[]>;
  /** Null when there is no such family. */
  findFont(id: string): Promise<GoogleFontDetails | null>;
  /** One WOFF2 file; null when that weight, style or alphabet doesn't exist. */
  downloadFile(id: string, subset: string, weight: string, style: string): Promise<Buffer | null>;
}

export function createGoogleFontsClient(network: FontNetwork): GoogleFontsClient {
  const lists = new TimedCache<GoogleFont[]>(24 * 60 * 60 * 1000, 1);
  const details = new TimedCache<GoogleFontDetails | null>(60 * 60 * 1000, 200);
  const files = new FontFileCache(60 * 60 * 1000, MAX_CACHED_FONT_BYTES);

  return {
    async listFonts() {
      const cached = lists.read("all");
      if (cached) return cached;
      const text = await network.readText(LIST_URL, "google", MAX_LIST_BYTES);
      const parsed = z.array(z.unknown()).safeParse(text === null ? null : parseJson(text));
      if (!parsed.success) throw new FontServiceUnreachableError("google");
      // Only Google Fonts' own families: Fontsource also lists a few from elsewhere.
      const fonts = parsed.data.flatMap((entry) => {
        const font = listedFontSchema.safeParse(entry);
        return font.success && font.data.type === "google" ? [describeFont(font.data)] : [];
      });
      lists.write("all", fonts);
      return fonts;
    },

    async findFont(id) {
      const cached = details.read(id);
      if (cached !== undefined) return cached;
      const text = await network.readText(detailsUrl(id), "google", MAX_DETAILS_BYTES);
      const parsed = text === null ? null : detailsSchema.safeParse(parseJson(text));
      if (parsed && !parsed.success) throw new FontServiceUnreachableError("google");
      const found =
        parsed?.success && parsed.data.type === "google"
          ? { ...describeFont(parsed.data), unicodeRanges: parsed.data.unicodeRange }
          : null;
      details.write(id, found);
      return found;
    },

    async downloadFile(id, subset, weight, style) {
      const key = `${id}/${subset}-${weight}-${style}`;
      const cached = files.read(key);
      if (cached !== undefined) return cached;
      const bytes = await network.readBytes(
        fileUrl(id, subset, weight, style),
        "google",
        MAX_FONT_FILE_BYTES,
      );
      files.write(key, bytes);
      return bytes;
    },
  };
}

function describeFont(font: z.output<typeof listedFontSchema>): GoogleFont {
  return {
    id: font.id,
    family: font.family,
    category: categoryFromGoogle(font.category),
    weights: font.weights.map(String),
    hasItalic: font.styles.includes("italic"),
    subsets: font.subsets,
    defaultSubset: font.defSubset ?? font.subsets[0] ?? "latin",
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
