import type { FontCategory } from "@lintel/builder-model";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createAssetLookup, uploadAsset } from "../media/index.js";
import type { Site } from "../sites/sites.table.js";
import type { GoogleFont } from "./google-fonts-client.js";
import { GoogleFontNotFoundError } from "./site-fonts.errors.js";
import { findSiteFontRowByFamily, updateSiteFontRow } from "./site-fonts.repository.js";
import type {
  AddGoogleFontRequest,
  GoogleFontSummary,
  GoogleFontsSearchResponse,
  SiteFontResponse,
} from "./site-fonts.schema.js";
import {
  checkFamilyIsFree,
  deleteUnusedFontFiles,
  describeSiteFont,
  insertNewSiteFont,
  mergeFiles,
  type SiteFontsContext,
} from "./site-fonts.service.js";
import type { SiteFontRow, StoredFontFile } from "./site-fonts.table.js";

/** How many files are downloaded at once when a family is added. */
const DOWNLOADS_AT_ONCE = 4;

/**
 * Runs `work` on every item, `limit` at a time, keeping the order. An item whose work fails
 * gives its error in its place, so the caller can tidy up after the ones that worked.
 */
export async function mapWithConcurrency<Item, Result>(
  items: readonly Item[],
  limit: number,
  work: (item: Item) => Promise<Result>,
): Promise<(Result | Error)[]> {
  const results: (Result | Error)[] = new Array<Result | Error>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index] as Item;
      results[index] = await work(item).catch((error: unknown) =>
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Google Fonts: search the whole library, and add a family by downloading its files into
 * the media library, so the website serves them itself (no request to Google from visitors'
 * browsers, which matters under European privacy law). Every family is open-licence.
 */

/** Well-liked families to show before anything is typed, in this order. */
const popularFamilies = [
  "roboto",
  "open-sans",
  "montserrat",
  "lato",
  "poppins",
  "inter",
  "raleway",
  "nunito",
  "playfair-display",
  "merriweather",
  "lora",
  "source-sans-3",
  "work-sans",
  "rubik",
  "dm-sans",
  "libre-baskerville",
  "eb-garamond",
  "cormorant-garamond",
  "josefin-sans",
  "karla",
  "barlow",
  "ibm-plex-sans",
  "crimson-text",
  "quicksand",
  "space-grotesk",
];

const SHOWN_RESULTS = 30;

/** Alphabets downloaded with each family: Latin, and the extra letters many European languages need. */
const wantedSubsets = ["latin", "latin-ext"];

export async function searchGoogleFonts(
  context: SiteFontsContext,
  query: { search?: string; category?: FontCategory },
): Promise<GoogleFontsSearchResponse> {
  const all = await context.google.listFonts();
  const search = query.search?.toLowerCase() ?? "";
  const inCategory = all.filter((font) => !query.category || font.category === query.category);
  const matches = search
    ? inCategory
        .filter((font) => font.family.toLowerCase().includes(search))
        .sort((a, b) => rank(a, search) - rank(b, search) || a.family.localeCompare(b.family))
    : [
        ...popularFamilies.flatMap((id) => inCategory.filter((font) => font.id === id)),
        ...inCategory.filter((font) => !popularFamilies.includes(font.id)),
      ];
  return { fonts: matches.slice(0, SHOWN_RESULTS).map(summarise), total: matches.length };
}

function rank(font: GoogleFont, search: string): number {
  const family = font.family.toLowerCase();
  if (family === search) return 0;
  return family.startsWith(search) ? 1 : 2;
}

function summarise(font: GoogleFont): GoogleFontSummary {
  return {
    id: font.id,
    family: font.family,
    category: font.category,
    weights: font.weights,
    hasItalic: font.hasItalic,
  };
}

/**
 * A small file to preview the family in the admin: its regular (or first) weight, Latin
 * letters only. It comes through Lintel, so the admin never talks to another service.
 */
export async function findGoogleFontPreview(
  context: SiteFontsContext,
  id: string,
): Promise<Buffer> {
  const font = await context.google.findFont(id);
  if (!font) throw new GoogleFontNotFoundError();
  const subset = font.subsets.includes("latin") ? "latin" : font.defaultSubset;
  const weight = font.weights.includes("400") ? "400" : (font.weights[0] ?? "400");
  // A few families only come in italic.
  const file =
    (await context.google.downloadFile(id, subset, weight, "normal")) ??
    (font.hasItalic ? await context.google.downloadFile(id, subset, weight, "italic") : null);
  if (!file) throw new GoogleFontNotFoundError();
  return file;
}

/**
 * Downloads the chosen weights (and italics, if asked for and the family has them) for the
 * Latin alphabets, into the media library, and adds the family to the site. Adding a family
 * again adds any new weights to it.
 */
export async function addGoogleFont(
  context: SiteFontsContext,
  site: Site,
  request: AddGoogleFontRequest,
  addedBy: string,
): Promise<SiteFontResponse> {
  const font = await context.google.findFont(request.id);
  if (!font) throw new GoogleFontNotFoundError();
  await checkFamilyIsFree(context.database, site, font.family, font.id);

  const weights = request.weights.filter((weight) => font.weights.includes(weight));
  const styles = request.italic && font.hasItalic ? ["normal", "italic"] : ["normal"];
  const subsets = wantedSubsets.filter((subset) => font.subsets.includes(subset));
  const alphabets = subsets.length > 0 ? subsets : [font.defaultSubset];

  const wanted = weights.flatMap((weight) =>
    styles.flatMap((style) => alphabets.map((subset) => ({ weight, style, subset }))),
  );
  // A few at a time: quicker than one by one, without asking the font service for 50 at once.
  const downloaded = await mapWithConcurrency(
    wanted,
    DOWNLOADS_AT_ONCE,
    async ({ weight, style, subset }): Promise<StoredFontFile | null> => {
      const contents = await context.google.downloadFile(font.id, subset, weight, style);
      if (!contents) return null;
      const { asset } = await uploadAsset(
        context.media,
        { filename: `${font.id}-${subset}-${weight}-${style}.woff2`, contents },
        addedBy,
      );
      const unicodeRange = font.unicodeRanges[subset];
      return {
        assetId: asset.id,
        weight,
        style: style === "italic" ? "italic" : "normal",
        format: "woff2",
        ...(unicodeRange ? { unicodeRange } : {}),
      };
    },
  );
  const files = downloaded.flatMap((file) => (file && "assetId" in file ? [file] : []));
  const failure = downloaded.find((file) => file instanceof Error);

  const existing = await findSiteFontRowByFamily(
    context.database,
    DEFAULT_TENANT_ID,
    site.id,
    font.family,
  );
  let row: SiteFontRow;
  try {
    if (failure) throw failure;
    if (files.length === 0) throw new GoogleFontNotFoundError();
    row = existing
      ? await updateSiteFontRow(context.database, DEFAULT_TENANT_ID, existing.id, {
          files: mergeFiles(existing.files, files),
        })
      : await insertNewSiteFont(context.database, {
          tenantId: DEFAULT_TENANT_ID,
          siteId: site.id,
          family: font.family,
          category: font.category,
          source: "google",
          sourceId: font.id,
          files,
        });
  } catch (error) {
    // Nothing was added, so the files downloaded for it go again.
    await deleteUnusedFontFiles(
      context,
      files.map((file) => file.assetId),
    );
    throw error;
  }
  // Files the new ones replaced (the same weight and style, downloaded again) go too.
  if (existing) {
    const kept = new Set(row.files.map((file) => file.assetId));
    await deleteUnusedFontFiles(
      context,
      existing.files.map((file) => file.assetId).filter((assetId) => !kept.has(assetId)),
    );
  }
  const assets = await createAssetLookup(context.media).findAssetsByIds(
    row.files.map((file) => file.assetId),
  );
  return describeSiteFont(row, new Map([...assets].map(([id, asset]) => [id, asset.url])));
}
