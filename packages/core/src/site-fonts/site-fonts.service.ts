import type { Readable } from "node:stream";
import {
  adobeStylesheetUrl,
  type FontFormat,
  fontFamilyNameSchema,
  guessFontFromFileName,
  type ResolvedSiteFont,
} from "@lintel/builder-model";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { isUniqueViolation } from "../database/database-errors.js";
import {
  AssetNotFoundError,
  type AssetUsage,
  createAssetLookup,
  deleteAsset,
  findAssetFile,
  type MediaContext,
} from "../media/index.js";
import type { Site } from "../sites/sites.table.js";
import type { AdobeFontsClient } from "./adobe-fonts-client.js";
import { readFontFileDetails } from "./font-file-names.js";
import type { GoogleFontsClient } from "./google-fonts-client.js";
import {
  FontFileNotUsableError,
  SiteFontNameTakenError,
  SiteFontNotFoundError,
  TooManySiteFontsError,
} from "./site-fonts.errors.js";
import {
  countSiteFontRows,
  deleteSiteFontRow,
  findSiteFontRow,
  findSiteFontRowByFamily,
  insertSiteFontRow,
  listAllSiteFontRows,
  listSiteFontRows,
  updateSiteFontRow,
} from "./site-fonts.repository.js";
import type {
  AddUploadedFontRequest,
  InspectedFontFile,
  SiteFontResponse,
  SiteFontsResponse,
} from "./site-fonts.schema.js";
import { MAX_FONTS_PER_SITE } from "./site-fonts.schema.js";
import type { NewSiteFontRow, SiteFontRow, StoredFontFile } from "./site-fonts.table.js";

/**
 * Site fonts: the families a whole site can use (see README.md). This file lists them,
 * adds uploaded ones, and turns them into what the website needs; google-fonts.service.ts
 * and adobe-fonts.service.ts add the other two kinds.
 */
export interface SiteFontsContext {
  database: DatabaseOrTransaction;
  media: MediaContext;
  google: GoogleFontsClient;
  adobe: AdobeFontsClient;
}

const formatsByMimeType: Record<string, FontFormat> = {
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "truetype",
  "font/otf": "opentype",
};

/** Font files are small; anything bigger than this isn't read to find its name. */
const MAX_INSPECTED_BYTES = 10 * 1024 * 1024;

export async function listSiteFonts(
  context: SiteFontsContext,
  site: Site,
): Promise<SiteFontsResponse> {
  const rows = await listSiteFontRows(context.database, DEFAULT_TENANT_ID, site.id);
  const urls = await fileUrls(createAssetLookup(context.media), rows);
  const projects = new Map<string, string[]>();
  for (const row of rows) {
    if (row.source === "adobe" && row.sourceId) {
      projects.set(row.sourceId, [...(projects.get(row.sourceId) ?? []), row.family]);
    }
  }
  return {
    fonts: rows.map((row) => describeSiteFont(row, urls)),
    adobeProjects: [...projects].map(([projectId, families]) => ({
      projectId,
      stylesheetUrl: adobeStylesheetUrl(projectId),
      families,
    })),
  };
}

export function describeSiteFont(row: SiteFontRow, urls: Map<string, string>): SiteFontResponse {
  // Extra alphabets are the same weight and style again; the admin shows each face once.
  const faces = new Map<string, StoredFontFile>();
  for (const file of row.files)
    faces.set(`${file.weight}-${file.style}`, faces.get(`${file.weight}-${file.style}`) ?? file);
  return {
    id: row.id,
    family: row.family,
    category: row.category,
    source: row.source,
    sourceId: row.sourceId,
    files: [...faces.values()].map((file) => ({
      assetId: file.assetId,
      url: urls.get(file.assetId) ?? "",
      weight: file.weight,
      style: file.style,
      format: file.format,
    })),
    weights: [...new Set(row.files.map((file) => file.weight))].sort(),
    hasItalic: row.files.some((file) => file.style === "italic"),
  };
}

/** Anything that finds media items' addresses by id: the media library, or the website's lookup. */
export interface FileAddressLookup {
  findAssetsByIds(assetIds: readonly string[]): Promise<Map<string, { url: string }>>;
}

async function fileUrls(lookup: FileAddressLookup, rows: readonly SiteFontRow[]) {
  const assets = await lookup.findAssetsByIds(
    rows.flatMap((row) => row.files.map((file) => file.assetId)),
  );
  return new Map([...assets].map(([assetId, asset]) => [assetId, asset.url]));
}

/** A font file from the media library: its bytes, name and format, or a plain refusal. */
export async function readFontAsset(media: MediaContext, assetId: string) {
  const { file, format } = await findFontAsset(media, assetId);
  const { body } = await file.read();
  return { filename: file.filename, format, contents: await toBuffer(body) };
}

/** A font file in the media library and its format, from its type: nothing is read. */
async function findFontAsset(media: MediaContext, assetId: string) {
  const file = await findAssetFile(media, assetId, { fit: "cover" }).catch((error: unknown) => {
    if (error instanceof AssetNotFoundError) throw new FontFileNotUsableError("That file");
    throw error;
  });
  const format = formatsByMimeType[file.mimeType];
  if (!format) throw new FontFileNotUsableError(file.filename);
  return { file, format };
}

async function toBuffer(body: Buffer | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(body)) return body.subarray(0, MAX_INSPECTED_BYTES);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    chunks.push(piece);
    size += piece.length;
    if (size >= MAX_INSPECTED_BYTES) break;
  }
  return Buffer.concat(chunks);
}

/**
 * What each uploaded file says it is (family, weight, style), read from inside the file, or
 * guessed from its name when the file doesn't say. Shown to the maker, who can change it.
 */
export async function inspectFontFiles(
  context: SiteFontsContext,
  assetIds: readonly string[],
): Promise<InspectedFontFile[]> {
  // One at a time: each file is read into memory (up to 18 of them at a few MB each).
  const inspected: InspectedFontFile[] = [];
  for (const assetId of assetIds) {
    const file = await readFontAsset(context.media, assetId);
    const guess = guessFontFromFileName(file.filename);
    const details = readFontFileDetails(file.contents);
    const family = fontFamilyNameSchema.safeParse(
      details.family
        ?.replace(/[^A-Za-z0-9 -]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
    inspected.push({
      assetId,
      filename: file.filename,
      family: family.success ? family.data : guess.family,
      weight: details.weight ?? guess.weight,
      style: details.style ?? guess.style,
      readFromFile: family.success,
    });
  }
  return inspected;
}

/**
 * Adds a family from uploaded files, or more files to one already uploaded under that name
 * (a new file for a weight and style it has replaces the old one). The maker must say their
 * licence allows web use; who said so, and when, is kept.
 */
export async function addUploadedFont(
  context: SiteFontsContext,
  site: Site,
  request: AddUploadedFontRequest,
  confirmedBy: string,
): Promise<SiteFontResponse> {
  const files: StoredFontFile[] = [];
  for (const file of request.files) {
    // The format comes from the file's type; there is no need to read the file itself.
    const { format } = await findFontAsset(context.media, file.assetId);
    files.push({ assetId: file.assetId, weight: file.weight, style: file.style, format });
  }
  const existing = await findSiteFontRowByFamily(
    context.database,
    DEFAULT_TENANT_ID,
    site.id,
    request.family,
  );
  if (existing && existing.source !== "upload") throw new SiteFontNameTakenError(existing.family);
  const licence = { licenceConfirmedAt: new Date(), licenceConfirmedBy: confirmedBy };
  const row = existing
    ? await updateSiteFontRow(context.database, DEFAULT_TENANT_ID, existing.id, {
        ...licence,
        category: request.category,
        files: mergeFiles(existing.files, files),
      })
    : await insertNewSiteFont(context.database, {
        tenantId: DEFAULT_TENANT_ID,
        siteId: site.id,
        family: request.family,
        category: request.category,
        source: "upload",
        files: mergeFiles([], files),
        ...licence,
      });
  return describeSiteFont(row, await fileUrls(createAssetLookup(context.media), [row]));
}

/**
 * Adds a font to a site, at most MAX_FONTS_PER_SITE of them. The count and the insert are
 * one transaction, and a family added by someone else a moment earlier is refused as
 * "already has a font called…" rather than a database error.
 */
export async function insertNewSiteFont(
  database: DatabaseOrTransaction,
  row: NewSiteFontRow,
): Promise<SiteFontRow> {
  try {
    return await database.transaction(async (transaction) => {
      const tenantId = row.tenantId ?? DEFAULT_TENANT_ID;
      const total = await countSiteFontRows(transaction, tenantId, row.siteId);
      if (total >= MAX_FONTS_PER_SITE) throw new TooManySiteFontsError(MAX_FONTS_PER_SITE);
      return insertSiteFontRow(transaction, row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new SiteFontNameTakenError(row.family);
    throw error;
  }
}

/**
 * Deletes files Lintel downloaded for fonts (from Google Fonts) that no font on any site
 * uses any more. One that has already gone, or is in use elsewhere, is left.
 */
export async function deleteUnusedFontFiles(
  context: SiteFontsContext,
  assetIds: Iterable<string>,
): Promise<void> {
  const stillUsed = new Set(
    (await listAllSiteFontRows(context.database, DEFAULT_TENANT_ID)).flatMap((other) =>
      other.files.map((file) => file.assetId),
    ),
  );
  for (const assetId of new Set(assetIds)) {
    if (stillUsed.has(assetId)) continue;
    await deleteAsset(context.media, assetId).catch(() => undefined);
  }
}

/**
 * The site fonts (on any site) made from a file, so the media library won't delete a file a
 * font needs: the font would stop showing on every page with no warning.
 */
export async function findSiteFontsUsingAsset(
  database: DatabaseOrTransaction,
  assetId: string,
): Promise<AssetUsage[]> {
  return (await listAllSiteFontRows(database, DEFAULT_TENANT_ID))
    .filter((row) => row.files.some((file) => file.assetId === assetId))
    .map((row) => ({ entryId: row.id, title: row.family, place: "siteFonts" as const }));
}

/** Later files win for the same weight and style; the list is kept tidy, lightest first. */
export function mergeFiles(
  current: readonly StoredFontFile[],
  added: readonly StoredFontFile[],
): StoredFontFile[] {
  const key = (file: StoredFontFile) => `${file.weight}-${file.style}-${file.unicodeRange ?? ""}`;
  const replaced = new Set(added.map((file) => `${file.weight}-${file.style}`));
  return [...current.filter((file) => !replaced.has(`${file.weight}-${file.style}`)), ...added]
    .filter((file, index, all) => all.findIndex((other) => key(other) === key(file)) === index)
    .sort((a, b) => a.weight.localeCompare(b.weight) || a.style.localeCompare(b.style));
}

export async function updateSiteFont(
  context: SiteFontsContext,
  site: Site,
  fontId: string,
  changes: { category: SiteFontRow["category"] },
): Promise<SiteFontResponse> {
  await findSiteFontOrFail(context.database, site, fontId);
  const row = await updateSiteFontRow(context.database, DEFAULT_TENANT_ID, fontId, changes);
  return describeSiteFont(row, await fileUrls(createAssetLookup(context.media), [row]));
}

/**
 * Takes a font off the site. Files Lintel downloaded from Google Fonts go too, unless another
 * site still uses them; files the maker uploaded stay in the media library.
 */
export async function removeSiteFont(
  context: SiteFontsContext,
  site: Site,
  fontId: string,
): Promise<void> {
  const row = await findSiteFontOrFail(context.database, site, fontId);
  await deleteSiteFontRow(context.database, DEFAULT_TENANT_ID, row.id);
  if (row.source !== "google") return;
  await deleteUnusedFontFiles(
    context,
    row.files.map((file) => file.assetId),
  );
}

async function findSiteFontOrFail(database: DatabaseOrTransaction, site: Site, fontId: string) {
  const row = await findSiteFontRow(database, DEFAULT_TENANT_ID, site.id, fontId);
  if (!row) throw new SiteFontNotFoundError();
  return row;
}

/** Refuses a family name another font on the site already has. */
export async function checkFamilyIsFree(
  database: DatabaseOrTransaction,
  site: Site,
  family: string,
  unlessSourceId?: string,
): Promise<void> {
  const existing = await findSiteFontRowByFamily(database, DEFAULT_TENANT_ID, site.id, family);
  if (existing && (unlessSourceId === undefined || existing.sourceId !== unlessSourceId)) {
    throw new SiteFontNameTakenError(existing.family);
  }
}

/** What the website draws with: each font's files with their addresses, and Adobe's links. */
export interface WebsiteFonts {
  fonts: ResolvedSiteFont[];
  stylesheetUrls: string[];
}

export async function readWebsiteFonts(
  database: DatabaseOrTransaction,
  site: Site,
  assetLookup: FileAddressLookup,
): Promise<WebsiteFonts> {
  const rows = await listSiteFontRows(database, DEFAULT_TENANT_ID, site.id);
  const urls = await fileUrls(assetLookup, rows);
  return {
    fonts: rows.map((row) => ({
      family: row.family,
      category: row.category,
      source: row.source,
      faces: row.files.flatMap((file) => {
        const src = urls.get(file.assetId);
        return src
          ? [
              {
                src,
                weight: file.weight,
                style: file.style,
                format: file.format,
                ...(file.unicodeRange ? { unicodeRange: file.unicodeRange } : {}),
              },
            ]
          : [];
      }),
    })),
    stylesheetUrls: [
      ...new Set(
        rows.flatMap((row) =>
          row.source === "adobe" && row.sourceId ? [adobeStylesheetUrl(row.sourceId)] : [],
        ),
      ),
    ],
  };
}
