import { CsvFormatError, parseCsv } from "../../commerce/shopify-import/csv.js";
import { slugify } from "../../entries/slugs.js";
import { fieldHandle } from "../imported-fields.js";
import type {
  SourceContentType,
  SourceEntry,
  SourceField,
  SourceFieldKind,
  SourceMedia,
  SourceValue,
} from "../source-site.js";

/**
 * A CMS collection exported as CSV (Webflow's and Framer's "Export" buttons): one row per
 * item, one column per field. CSV says nothing about what kind of field a column was, so
 * each is worked out from its values: all "true"/"false" is a switch, picture addresses
 * are pictures (several, separated by ";", a list of pictures), HTML is rich text, and so
 * on. People can change any of it on the mapping screen.
 */
export interface CsvCollectionOptions {
  /** Columns the system adds that aren't fields, by name. */
  systemColumns: readonly string[];
  /** Where the old site showed an item, from the collection's slug and the item's: "/blog/x". */
  oldPath: (collectionSlug: string, itemSlug: string) => string;
}

export interface CsvCollection {
  contentType: SourceContentType;
  entries: SourceEntry[];
  media: SourceMedia[];
}

const PICTURE = /^https?:\/\/[^\s;]+\.(?:jpe?g|png|gif|webp|avif|svg)(?:\?[^\s;]*)?$/i;
const VIDEO = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)\//i;

export function readCsvCollection(
  filename: string,
  text: string,
  options: CsvCollectionOptions,
): CsvCollection | { problem: string } {
  let table;
  try {
    table = parseCsv(text);
  } catch (error) {
    if (error instanceof CsvFormatError) return { problem: `${filename}: ${error.message}` };
    throw error;
  }
  const titleColumn = ["Name", "Title", "name", "title"].find((column) =>
    table.columns.includes(column),
  );
  const slugColumn = ["Slug", "slug"].find((column) => table.columns.includes(column));
  if (!titleColumn || !slugColumn) {
    return { problem: `${filename} has no Name (or Title) and Slug columns` };
  }
  const name = collectionName(filename);
  const typeKey = slugify(name) || "items";
  const skip = new Set([titleColumn, slugColumn, ...options.systemColumns]);
  const fieldColumns = table.columns.filter((column) => column && !skip.has(column));
  const fields: SourceField[] = fieldColumns.map((column) => ({
    key: column,
    label: column,
    ...guessKind(table.rows.map((row) => row[column] ?? "")),
  }));
  const media = new Map<string, SourceMedia>();
  const dateColumn = ["Published On", "Created On", "Date", "Published"].find((column) =>
    table.columns.includes(column),
  );

  const entries: SourceEntry[] = table.rows.map((row, index) => {
    const slug = row[slugColumn] ?? "";
    const values: Record<string, SourceValue> = {};
    for (const field of fields) {
      values[field.key] = valueOf(row[field.key] ?? "", field.kind, media);
    }
    const isDraft = truthy(row.Draft) || truthy(row.Archived);
    const date = dateColumn ? readDate(row[dateColumn] ?? "") : null;
    return {
      key: `${typeKey}/${row["Item ID"] || row.ID || slug || index}`,
      typeKey,
      title: row[titleColumn] ?? "",
      slug,
      parentKey: null,
      order: index,
      published: !isDraft,
      date,
      oldPath: slug ? options.oldPath(typeKey, slug) : null,
      values,
    };
  });

  return {
    contentType: {
      key: typeKey,
      name,
      handle: fieldHandle(name),
      structure: dateColumn ? "dated" : "flat",
      routePrefix: `/${typeKey}`,
      fields,
    },
    entries,
    media: [...media.values()],
  };
}

/**
 * "Fernleaf - Blog Posts - 64f1c2a9e7.csv" (Webflow) or "Blog Posts.csv" (Framer) is the
 * Blog Posts collection.
 */
export function collectionName(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, "").replace(/\.csv$/i, "");
  const parts = base.split(" - ").map((part) => part.trim());
  if (parts.length > 1 && /^[0-9a-f]{8,}$/i.test(parts.at(-1) ?? "")) parts.pop();
  return parts.at(-1) || "Items";
}

function guessKind(values: readonly string[]): Pick<SourceField, "kind" | "choices"> {
  const filled = values.map((value) => value.trim()).filter((value) => value !== "");
  if (filled.length === 0) return { kind: "text" };
  const all = (test: (value: string) => boolean) => filled.every(test);
  if (all((value) => /^(true|false)$/i.test(value))) return { kind: "toggle" };
  if (all((value) => /^-?\d+(\.\d+)?$/.test(value))) return { kind: "number" };
  if (all((value) => /^#[0-9a-f]{6}$/i.test(value))) return { kind: "colour" };
  if (all((value) => value.split(";").every((part) => PICTURE.test(part.trim())))) {
    return { kind: filled.some((value) => value.includes(";")) ? "images" : "image" };
  }
  if (filled.some((value) => /<[a-z][^>]*>/i.test(value))) return { kind: "richText" };
  if (all((value) => VIDEO.test(value))) return { kind: "video" };
  if (all((value) => /^https?:\/\/\S+$/i.test(value))) return { kind: "url" };
  if (all((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) return { kind: "email" };
  if (all((value) => readDate(value) !== null && /\d{4}/.test(value))) return { kind: "date" };
  const distinct = [...new Set(filled)];
  if (filled.length >= 4 && distinct.length <= 8 && distinct.length * 2 <= filled.length) {
    return { kind: "select", choices: distinct };
  }
  return {
    kind: filled.some((value) => value.length > 200 || value.includes("\n")) ? "textarea" : "text",
  };
}

function valueOf(raw: string, kind: SourceFieldKind, media: Map<string, SourceMedia>): SourceValue {
  const value = raw.trim();
  if (value === "") return null;
  switch (kind) {
    case "image":
    case "images": {
      const keys = value.split(";").map((part) => rememberPicture(part.trim(), media));
      return kind === "image" ? (keys[0] ?? null) : keys;
    }
    case "richText":
      for (const match of value.matchAll(/<img[^>]+src="([^"]+)"/gi)) {
        if (match[1] && PICTURE.test(match[1])) rememberPicture(match[1], media);
      }
      return value;
    case "toggle":
      return /^true$/i.test(value);
    case "number":
      return Number(value);
    default:
      return value;
  }
}

/** A picture to bring in, by its address; the address is its key. */
export function rememberPicture(url: string, media: Map<string, SourceMedia>): string {
  if (!media.has(url)) {
    const filename = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") || "picture";
    // Webflow puts an id in front of every file name: "64f1c2a9e7_loaf.png".
    media.set(url, { key: url, filename: filename.replace(/^[0-9a-f]{20,}_/i, ""), alt: "", url });
  }
  return url;
}

function truthy(value: string | undefined): boolean {
  return /^true$/i.test(value?.trim() ?? "");
}

function readDate(value: string): string | null {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
