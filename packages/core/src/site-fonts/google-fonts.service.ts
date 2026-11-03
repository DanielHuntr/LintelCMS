import type { FontCategory } from "@lintel/builder-model";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createAssetLookup, uploadAsset } from "../media/index.js";
import type { Site } from "../sites/sites.table.js";
import type { GoogleFont } from "./google-fonts-client.js";
import { GoogleFontNotFoundError } from "./site-fonts.errors.js";
import {
  findSiteFontRowByFamily,
  insertSiteFontRow,
  updateSiteFontRow,
} from "./site-fonts.repository.js";
import type {
  AddGoogleFontRequest,
  GoogleFontSummary,
  GoogleFontsSearchResponse,
  SiteFontResponse,
} from "./site-fonts.schema.js";
import {
  checkFamilyIsFree,
  describeSiteFont,
  mergeFiles,
  type SiteFontsContext,
} from "./site-fonts.service.js";
import type { StoredFontFile } from "./site-fonts.table.js";

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

  const files: StoredFontFile[] = [];
  for (const weight of weights) {
    for (const style of styles) {
      for (const subset of alphabets) {
        const contents = await context.google.downloadFile(font.id, subset, weight, style);
        if (!contents) continue;
        const { asset } = await uploadAsset(
          context.media,
          { filename: `${font.id}-${subset}-${weight}-${style}.woff2`, contents },
          addedBy,
        );
        const unicodeRange = font.unicodeRanges[subset];
        files.push({
          assetId: asset.id,
          weight,
          style: style === "italic" ? "italic" : "normal",
          format: "woff2",
          ...(unicodeRange ? { unicodeRange } : {}),
        });
      }
    }
  }
  if (files.length === 0) throw new GoogleFontNotFoundError();

  const existing = await findSiteFontRowByFamily(
    context.database,
    DEFAULT_TENANT_ID,
    site.id,
    font.family,
  );
  const row = existing
    ? await updateSiteFontRow(context.database, DEFAULT_TENANT_ID, existing.id, {
        files: mergeFiles(existing.files, files),
      })
    : await insertSiteFontRow(context.database, {
        tenantId: DEFAULT_TENANT_ID,
        siteId: site.id,
        family: font.family,
        category: font.category,
        source: "google",
        sourceId: font.id,
        files,
      });
  const assets = await createAssetLookup(context.media).findAssetsByIds(
    row.files.map((file) => file.assetId),
  );
  return describeSiteFont(row, new Map([...assets].map(([id, asset]) => [id, asset.url])));
}
