import { XMLParser, XMLValidator } from "fast-xml-parser";
import { decodeEntities } from "./wordpress-content.js";
import { NotAWordPressExportError } from "./wordpress-import.errors.js";

/**
 * Reads a WordPress export file (WXR: "WordPress eXtended RSS", made by Tools → Export in
 * WordPress) into plain objects. Only what the importer uses is kept. The parser never
 * fetches anything the file refers to and doesn't expand external entities.
 */
export interface WordPressAuthor {
  login: string;
  email: string;
  displayName: string;
}

export interface WordPressTerm {
  slug: string;
  name: string;
  parentSlug: string;
}

export const wordpressItemTypes = ["post", "page", "attachment"] as const;
export type WordPressItemType = (typeof wordpressItemTypes)[number];

export interface WordPressItem {
  id: string;
  type: WordPressItemType;
  title: string;
  slug: string;
  link: string;
  /** publish, draft, pending, private, future, trash or inherit (for attachments). */
  status: string;
  /** In UTC, or null when WordPress never set one (some drafts). */
  date: string | null;
  parentId: string;
  menuOrder: number;
  authorLogin: string;
  content: string;
  excerpt: string;
  categories: string[];
  tags: string[];
  featuredImageId: string | null;
  attachmentUrl: string | null;
  /** An attachment's alternative text, for people who can't see the image. */
  altText: string;
}

export interface WordPressSite {
  title: string;
  link: string;
  language: string;
  authors: WordPressAuthor[];
  categories: WordPressTerm[];
  tags: WordPressTerm[];
  items: WordPressItem[];
  /** Menus, revisions, custom post types and the like: counted, not imported. */
  ignoredItemTypes: Record<string, number>;
}

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) =>
    ["item", "wp:author", "wp:category", "wp:tag", "category", "wp:postmeta"].includes(name),
});

export function parseWordPressExport(xml: string): WordPressSite {
  if (XMLValidator.validate(xml) !== true) {
    throw new NotAWordPressExportError("it isn't a well-formed XML file");
  }
  const document = parser.parse(xml) as XmlNode;
  const channel = (document.rss as XmlNode | undefined)?.channel as XmlNode | undefined;
  if (!channel || channel["wp:wxr_version"] === undefined) {
    throw new NotAWordPressExportError("it has no WordPress export details (wxr_version)");
  }

  const ignoredItemTypes: Record<string, number> = {};
  const items: WordPressItem[] = [];
  for (const node of nodes(channel.item)) {
    const type = text(node["wp:post_type"]);
    if ((wordpressItemTypes as readonly string[]).includes(type)) {
      items.push(readItem(node, type as WordPressItemType));
    } else {
      ignoredItemTypes[type || "unknown"] = (ignoredItemTypes[type || "unknown"] ?? 0) + 1;
    }
  }

  return {
    title: text(channel.title),
    link: text(channel.link),
    language: text(channel.language),
    authors: nodes(channel["wp:author"]).map((node) => ({
      login: text(node["wp:author_login"]),
      email: text(node["wp:author_email"]).toLowerCase(),
      displayName:
        decodeEntities(text(node["wp:author_display_name"])) || text(node["wp:author_login"]),
    })),
    categories: nodes(channel["wp:category"]).map((node) => ({
      slug: text(node["wp:category_nicename"]),
      name: decodeEntities(text(node["wp:cat_name"])),
      parentSlug: text(node["wp:category_parent"]),
    })),
    tags: nodes(channel["wp:tag"]).map((node) => ({
      slug: text(node["wp:tag_slug"]),
      name: decodeEntities(text(node["wp:tag_name"])),
      parentSlug: "",
    })),
    items,
    ignoredItemTypes,
  };
}

function readItem(node: XmlNode, type: WordPressItemType): WordPressItem {
  const categories = nodes(node.category);
  const meta = new Map(
    nodes(node["wp:postmeta"]).map((entry) => [
      text(entry["wp:meta_key"]),
      text(entry["wp:meta_value"]),
    ]),
  );
  const slugsIn = (domain: string) =>
    categories
      .filter((category) => category["@_domain"] === domain)
      .map((category) => text(category["@_nicename"]));

  return {
    id: text(node["wp:post_id"]),
    type,
    title: decodeEntities(text(node.title)),
    slug: text(node["wp:post_name"]),
    link: text(node.link),
    status: text(node["wp:status"]),
    date: readDate(text(node["wp:post_date_gmt"])),
    parentId: text(node["wp:post_parent"]) || "0",
    menuOrder: Number.parseInt(text(node["wp:menu_order"]) || "0", 10) || 0,
    authorLogin: text(node["dc:creator"]),
    content: text(node["content:encoded"]),
    excerpt: text(node["excerpt:encoded"]),
    categories: slugsIn("category"),
    tags: slugsIn("post_tag"),
    featuredImageId: meta.get("_thumbnail_id") || null,
    attachmentUrl: text(node["wp:attachment_url"]) || null,
    altText: meta.get("_wp_attachment_image_alt") ?? "",
  };
}

/** "2024-03-02 10:30:00" in UTC; WordPress writes "0000-00-00 00:00:00" for never. */
function readDate(value: string): string | null {
  if (!value || value.startsWith("0000")) {
    return null;
  }
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function nodes(value: unknown): XmlNode[] {
  return Array.isArray(value)
    ? value.filter((item): item is XmlNode => typeof item === "object" && item !== null)
    : [];
}

function text(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "#text" in value) {
    return text((value as XmlNode)["#text"]);
  }
  return "";
}
