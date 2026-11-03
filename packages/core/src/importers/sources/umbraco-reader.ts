import { posix } from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { ZipArchiveReader } from "../../archives/zip-reader.js";
import { slugify } from "../../entries/slugs.js";
import { fieldHandle } from "../imported-fields.js";
import { listArchiveFiles, readArchiveText } from "../import-archives.js";
import { NotAnExportError } from "../site-import.errors.js";
import {
  emptySourceSite,
  type SourceContentType,
  type SourceEntry,
  type SourceField,
  type SourceSite,
} from "../source-site.js";
import { readUmbracoDeliveryApi } from "./umbraco-delivery-reader.js";
import type { SourceFiles } from "./source-reader.js";
import { normaliseKey, readUmbracoValue, umbracoFilePath, umbracoKind } from "./umbraco-fields.js";

/**
 * Umbraco, from a uSync export (Settings → uSync → Export, then zip the uSync folder) or
 * the Content Delivery API's JSON (see umbraco-delivery-reader.ts).
 *
 *   ContentTypes/*.config   document types → content types, with which may sit under which
 *   Content/*.config        the content tree, keeping each node's parent and sort order
 *   Media/*.config          media items; their files come from the zip (a copy of
 *                           wwwroot/media) when it has them
 *   Dictionary/*.config     dictionary items → a "Dictionary" global set, one field each
 *
 * The parser never fetches anything the files refer to and doesn't expand entities.
 */
type Node = Record<string, unknown>;
const ROOT_KEY = "00000000000000000000000000000000";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  trimValues: true,
  isArray: (name) => ["GenericProperty", "ContentType", "Translation"].includes(name),
});

export async function readUmbracoExport(input: SourceFiles): Promise<SourceSite> {
  const json = input.files.find((file) => /\.json$/i.test(file.filename));
  if (json) return readUmbracoDeliveryApi(json.text);
  if (!input.archive) {
    throw new NotAnExportError(
      "umbraco",
      "upload the uSync folder as a .zip, or the Delivery API's answer as .json",
    );
  }
  const files = listArchiveFiles(input.archive);
  const configs = async (folder: string) => {
    const documents: Node[] = [];
    for (const [logical, real] of files) {
      if (!new RegExp(`(^|/)${folder}/[^/]+\\.config$`, "i").test(logical)) continue;
      const text = await readArchiveText(input.archive as ZipArchiveReader, real);
      if (text) documents.push(parser.parse(text) as Node);
    }
    return documents;
  };
  const documentTypes = await configs("ContentTypes");
  if (documentTypes.length === 0) {
    throw new NotAnExportError("umbraco", "there's no uSync ContentTypes folder in the zip");
  }
  const site = emptySourceSite("Umbraco site");
  const leftOut = new Set<string>();
  const typesByAlias = new Map<string, SourceContentType>();
  for (const document of documentTypes) {
    const type = readDocumentType(document.ContentType, leftOut);
    if (type) typesByAlias.set(type.key, type);
  }

  const mediaByKey = new Map<string, string>();
  for (const document of await configs("Media")) {
    const media = asNode(document.Media);
    const key = normaliseKey(attribute(media, "Key"));
    const filePath = umbracoFilePath(propertyText(media, "umbracoFile"));
    const archivePath = filePath ? findFile(files, filePath) : undefined;
    if (!filePath || !archivePath) continue;
    mediaByKey.set(key, `media:${key}`);
    site.media.push({
      key: `media:${key}`,
      filename: posix.basename(filePath),
      alt: attribute(media, "Alias"),
      archivePath,
    });
  }
  const missingMedia = (await configs("Media")).length - mediaByKey.size;
  if (missingMedia > 0) {
    site.notes.push(
      `${missingMedia} media items have no file in the zip. Add a copy of wwwroot/media (or the site's media folder) to the zip to bring them in.`,
    );
  }

  for (const document of await configs("Content")) {
    const entry = readContent(
      asNode(document.Content),
      typesByAlias,
      (key) => mediaByKey.get(key) ?? null,
    );
    if (entry) site.entries.push(entry);
  }
  placeAddresses(site.entries);
  // Types allowed at the top first, as the content tree shows them.
  site.contentTypes = [...typesByAlias.values()]
    .filter((type) => site.entries.some((entry) => entry.typeKey === type.key))
    .sort((first, second) => Number(second.allowedAtRoot) - Number(first.allowedAtRoot));

  const dictionary = await configs("Dictionary");
  if (dictionary.length > 0) site.globals.push(readDictionary(dictionary));
  if (leftOut.size > 0) {
    site.notes.push(
      `These properties use editors with no equal in Lintel, so they weren't brought in: ${[...leftOut].join(", ")}.`,
    );
  }
  site.notes.push(
    "Templates (Razor views), members, forms and content in other languages than the default don't come across.",
  );
  return site;
}

function readDocumentType(value: unknown, leftOut: Set<string>): SourceContentType | null {
  const node = asNode(Array.isArray(value) ? value[0] : value);
  const alias = attribute(node, "Alias");
  if (!alias) return null;
  const info = asNode(node.Info);
  if (text(info.IsElement) === "true") return null;
  const properties = asList(asNode(node.GenericProperties).GenericProperty);
  const fields: SourceField[] = [];
  for (const property of properties.map(asNode)) {
    const editor = text(property.Type);
    const kind = umbracoKind(editor);
    const name = text(property.Name) || text(property.Alias);
    if (!kind) {
      leftOut.add(`${name} (${editor || "unknown editor"})`);
      continue;
    }
    fields.push({ key: text(property.Alias), label: name, kind });
  }
  const children = asList(asNode(node.Structure).ContentType).map(text).filter(Boolean);
  return {
    key: alias,
    name: text(info.Name) || alias,
    handle: fieldHandle(alias),
    structure: "tree",
    routePrefix: "",
    fields,
    allowedChildren: children,
    allowedAtRoot: text(info.AllowAtRoot ?? info.AllowedAsRoot) !== "false",
  };
}

function readContent(
  node: Node,
  types: Map<string, SourceContentType>,
  media: (key: string) => string | null,
): SourceEntry | null {
  const info = asNode(node.Info);
  if (text(info.Trashed) === "true") return null;
  // "ContentType" is read as a list everywhere, since document types list their children.
  const type = types.get(text(asList(info.ContentType)[0]));
  if (!type) return null;
  const name = attribute(asNode(info.NodeName), "Default") || attribute(node, "Alias");
  const parent = normaliseKey(attribute(asNode(info.Parent), "Key"));
  const values: SourceEntry["values"] = {};
  for (const field of type.fields) {
    values[field.key] = readUmbracoValue(propertyText(node, field.key), field, media);
  }
  const created = text(info.CreateDate);
  return {
    key: normaliseKey(attribute(node, "Key")),
    typeKey: type.key,
    title: name,
    slug: slugify(name),
    parentKey: parent && parent !== ROOT_KEY ? parent : null,
    order: Number.parseInt(text(info.SortOrder) || "0", 10) || 0,
    published: attribute(asNode(info.Published), "Default") !== "false",
    date: created && !Number.isNaN(Date.parse(created)) ? new Date(created).toISOString() : null,
    oldPath: null,
    values,
  };
}

/**
 * Umbraco's addresses come from node names: the first page at the top is the site's "/",
 * and pages under it start from there ("/about-us", "/about-us/our-team").
 */
function placeAddresses(entries: SourceEntry[]) {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const roots = entries.filter((entry) => !entry.parentKey).sort((a, b) => a.order - b.order);
  const home = roots[0]?.key;
  for (const entry of entries) {
    const segments: string[] = [];
    for (let current: SourceEntry | undefined = entry; current;) {
      if (current.key !== home) segments.unshift(current.slug);
      current = current.parentKey ? byKey.get(current.parentKey) : undefined;
    }
    entry.oldPath = `/${segments.join("/")}`;
  }
}

function readDictionary(documents: Node[]) {
  const fields: SourceField[] = [];
  const values: Record<string, string> = {};
  for (const document of documents) {
    const item = asNode(document.Dictionary);
    const alias = attribute(item, "Alias");
    const translation = asList(asNode(item.Translations).Translation)[0];
    if (!alias) continue;
    const handle = fieldHandle(alias);
    fields.push({ key: handle, label: alias, kind: "text" });
    values[handle] = text(translation);
  }
  return { key: "dictionary", name: "Dictionary", handle: "dictionary", fields, values };
}

function findFile(files: Map<string, string>, path: string): string | undefined {
  const clean = decodeURIComponent(path.split("?")[0] ?? "").replace(/^\/+/, "");
  return [...files.entries()].find(
    ([logical]) => logical === clean || logical.endsWith(`/${clean}`),
  )?.[1];
}

function propertyText(node: Node, alias: string): string {
  const property = asNode(asNode(node.Properties)[alias]);
  return text(property.Value);
}

function attribute(node: Node, name: string): string {
  const value = node[`@_${name}`];
  return typeof value === "string" ? value : "";
}

function asNode(value: unknown): Node {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Node)
    : {};
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined ? [] : [value];
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && value !== null && "#text" in value) {
    return text((value as Node)["#text"]);
  }
  return "";
}
