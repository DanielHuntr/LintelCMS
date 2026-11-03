import { XMLParser, XMLValidator } from "fast-xml-parser";
import { decodeEntities } from "./wordpress-content.js";
import { NotAWordPressExportError } from "./wordpress-import.errors.js";
import { readWooCommerceProducts, type WooCommerceProduct } from "./woocommerce-reader.js";
import { nodes, readMeta, termSlugsIn, text, type XmlNode } from "./wxr-nodes.js";

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
  /**
   * The post's own custom fields (from plugins such as Advanced Custom Fields), by key.
   * WordPress's hidden ones, whose keys start with "_", are left out.
   */
  customFields: Record<string, string>;
  /** The custom fields Advanced Custom Fields made (it keeps a "_key" twin for each). */
  acfKeys: string[];
}

/** One link in a WordPress menu (Appearance → Menus). */
export interface WordPressMenuLink {
  id: string;
  /** The link this one sits under in the menu, or "0" at the top. */
  parentId: string;
  order: number;
  /** Empty when the link uses the linked page's own title. */
  label: string;
  /** "post_type" for a page or post, "custom" for a typed address, "taxonomy" for a category. */
  linkType: string;
  /** The id of the page or post it links to, for "post_type" links. */
  linkedId: string;
  url: string;
}

export interface WordPressMenu {
  slug: string;
  name: string;
  links: WordPressMenuLink[];
}

export interface WordPressSite {
  title: string;
  link: string;
  language: string;
  authors: WordPressAuthor[];
  categories: WordPressTerm[];
  tags: WordPressTerm[];
  items: WordPressItem[];
  menus: WordPressMenu[];
  products: WooCommerceProduct[];
  /** Revisions, custom post types and the like: counted, not imported. */
  ignoredItemTypes: Record<string, number>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
  isArray: (name) =>
    ["item", "wp:author", "wp:category", "wp:tag", "wp:term", "category", "wp:postmeta"].includes(
      name,
    ),
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
  const menuLinks: XmlNode[] = [];
  const productNodes: XmlNode[] = [];
  const variationNodes: XmlNode[] = [];
  for (const node of nodes(channel.item)) {
    const type = text(node["wp:post_type"]);
    if ((wordpressItemTypes as readonly string[]).includes(type)) {
      items.push(readItem(node, type as WordPressItemType));
    } else if (type === "nav_menu_item") {
      menuLinks.push(node);
    } else if (type === "product") {
      productNodes.push(node);
    } else if (type === "product_variation") {
      variationNodes.push(node);
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
    menus: readMenus(nodes(channel["wp:term"]), menuLinks),
    products: readWooCommerceProducts(productNodes, variationNodes),
    ignoredItemTypes,
  };
}

function readItem(node: XmlNode, type: WordPressItemType): WordPressItem {
  const meta = readMeta(node);
  const slugsIn = (domain: string) => termSlugsIn(node, domain);

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
    customFields: Object.fromEntries(
      [...meta].filter(([key]) => key !== "" && !key.startsWith("_")),
    ),
    acfKeys: [...meta]
      .filter(([key, value]) => key.startsWith("_") && value.startsWith("field_"))
      .map(([key]) => key.slice(1)),
  };
}

/**
 * Menus are "nav_menu" terms; each link is a nav_menu_item post that names its menu the
 * way a post names its category, with what it links to in its hidden fields.
 */
function readMenus(terms: XmlNode[], links: XmlNode[]): WordPressMenu[] {
  const menus = new Map<string, WordPressMenu>();
  for (const term of terms) {
    if (text(term["wp:term_taxonomy"]) !== "nav_menu") {
      continue;
    }
    const slug = text(term["wp:term_slug"]);
    menus.set(slug, { slug, name: decodeEntities(text(term["wp:term_name"])) || slug, links: [] });
  }
  for (const node of links) {
    const meta = readMeta(node);
    for (const slug of termSlugsIn(node, "nav_menu")) {
      const menu = menus.get(slug) ?? { slug, name: slug, links: [] };
      menus.set(slug, menu);
      menu.links.push({
        id: text(node["wp:post_id"]),
        parentId: meta.get("_menu_item_menu_item_parent") || "0",
        order: Number.parseInt(text(node["wp:menu_order"]) || "0", 10) || 0,
        label: decodeEntities(text(node.title)),
        linkType: meta.get("_menu_item_type") ?? "custom",
        linkedId: meta.get("_menu_item_object_id") ?? "",
        url: meta.get("_menu_item_url") ?? "",
      });
    }
  }
  return [...menus.values()];
}

/** "2024-03-02 10:30:00" in UTC; WordPress writes "0000-00-00 00:00:00" for never. */
function readDate(value: string): string | null {
  if (!value || value.startsWith("0000")) {
    return null;
  }
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
