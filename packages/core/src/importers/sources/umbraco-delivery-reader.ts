import { posix } from "node:path";
import { slugify } from "../../entries/slugs.js";
import { fieldHandle } from "../imported-fields.js";
import { NotAnExportError } from "../site-import.errors.js";
import {
  emptySourceSite,
  type SourceContentType,
  type SourceEntry,
  type SourceField,
  type SourceFieldKind,
  type SourceSite,
  type SourceValue,
} from "../source-site.js";

/**
 * Umbraco's Content Delivery API answer (`/umbraco/delivery/api/v2/content?take=...`,
 * saved as a .json file): published content only, with each item's route giving its place
 * in the tree. There are no document type definitions in it, so each content type's
 * fields are worked out from the values, as for CSV exports. Pictures are downloaded from
 * the site, so their addresses must be complete (the API's `expand` gives them).
 */
interface DeliveryItem {
  id?: unknown;
  name?: unknown;
  contentType?: unknown;
  createDate?: unknown;
  route?: { path?: unknown };
  properties?: Record<string, unknown>;
}

export function readUmbracoDeliveryApi(text: string): SourceSite {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new NotAnExportError("umbraco", "the .json file isn't valid JSON");
  }
  const items = (Array.isArray(parsed) ? parsed : (parsed as { items?: unknown }).items) as
    DeliveryItem[] | undefined;
  if (!Array.isArray(items) || !items.every((item) => typeof item?.contentType === "string")) {
    throw new NotAnExportError("umbraco", "it isn't an answer from the Content Delivery API");
  }
  const site = emptySourceSite("Umbraco site");
  const types = new Map<string, SourceContentType>();
  const byPath = new Map<string, string>();
  for (const item of items) {
    const typeKey = String(item.contentType);
    const type = types.get(typeKey) ?? {
      key: typeKey,
      name: typeKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()),
      handle: fieldHandle(typeKey),
      structure: "tree" as const,
      routePrefix: "",
      fields: [] as SourceField[],
    };
    types.set(typeKey, type);
    for (const [key, value] of Object.entries(item.properties ?? {})) {
      if (!type.fields.some((field) => field.key === key)) {
        const kind = kindOf(value);
        if (kind) type.fields.push({ key, label: key, kind });
      }
    }
    const path = normalisePath(String(item.route?.path ?? "/"));
    byPath.set(path, String(item.id));
  }

  for (const [index, item] of items.entries()) {
    const type = types.get(String(item.contentType));
    if (!type) continue;
    const path = normalisePath(String(item.route?.path ?? "/"));
    const values: Record<string, SourceValue> = {};
    for (const field of type.fields) {
      values[field.key] = valueOf(item.properties?.[field.key], field.kind, site);
    }
    const parentPath = path === "/" ? null : posix.dirname(path);
    const name = String(item.name ?? "");
    site.entries.push({
      key: String(item.id),
      typeKey: type.key,
      title: name,
      slug: path === "/" ? slugify(name) || "home" : posix.basename(path),
      parentKey: parentPath ? (byPath.get(parentPath) ?? null) : null,
      order: index,
      published: true,
      date: typeof item.createDate === "string" ? new Date(item.createDate).toISOString() : null,
      oldPath: path,
      values,
    } satisfies SourceEntry);
  }
  // The home page ("/") is every other page's parent on the old site.
  const home = byPath.get("/");
  for (const entry of site.entries) {
    if (entry.parentKey === null && entry.key !== home && home) entry.parentKey = home;
  }
  site.contentTypes = [...types.values()].map((type) => ({
    ...type,
    allowedChildren: [...types.keys()],
  }));
  // The pictures' addresses are on the site the answer came from; downloads stay guarded.
  site.mediaHosts = [
    ...new Set(site.media.flatMap((media) => (media.url ? [new URL(media.url).host] : []))),
  ];
  site.notes.push(
    "The Delivery API has only published content, without document type settings, so fields were worked out from their values. Block List and Block Grid content isn't brought in.",
  );
  return site;
}

function normalisePath(path: string): string {
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

function kindOf(value: unknown): SourceFieldKind | null {
  if (typeof value === "boolean") return "toggle";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return /<[a-z][^>]*>/i.test(value) ? "richText" : "text";
  if (isMarkup(value)) return "richText";
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return "list";
  if (Array.isArray(value) && value.some(isMedia)) return "image";
  return null;
}

function valueOf(value: unknown, kind: SourceFieldKind, site: SourceSite): SourceValue {
  if (value === null || value === undefined) return null;
  if (kind === "richText") return isMarkup(value) ? value.markup : String(value);
  if (kind === "image") {
    const media = Array.isArray(value) ? value.find(isMedia) : undefined;
    if (!media || !/^https?:\/\//.test(media.url)) return null;
    if (!site.media.some((item) => item.key === media.url)) {
      site.media.push({
        key: media.url,
        url: media.url,
        filename: posix.basename(new URL(media.url).pathname) || "picture",
        alt: typeof media.name === "string" ? media.name : "",
      });
    }
    return media.url;
  }
  if (kind === "list" && Array.isArray(value)) return value.map(String);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return null;
}

function isMarkup(value: unknown): value is { markup: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { markup?: unknown }).markup === "string"
  );
}

function isMedia(value: unknown): value is { url: string; name?: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { url?: unknown }).url === "string" &&
    "mediaType" in value
  );
}
