import { decodeEntities } from "./wordpress-content.js";
import { readMeta, termNamesIn, termSlugsIn, text, type XmlNode } from "./wxr-nodes.js";

/** A WooCommerce product, with its variations when it has options (Size, Colour...). */
export interface WooCommerceProduct {
  id: string;
  title: string;
  slug: string;
  link: string;
  status: string;
  content: string;
  excerpt: string;
  /** "simple", "variable", or another WooCommerce type. */
  productType: string;
  categories: string[];
  tags: string[];
  imageIds: string[];
  /** Option names in order, such as "Size", from the product's attributes. */
  optionNames: string[];
  stock: WooCommerceStock;
  variations: WooCommerceVariation[];
}

export interface WooCommerceStock {
  sku: string;
  regularPrice: string;
  salePrice: string;
  managed: boolean;
  quantity: number;
  weight: string;
}

export interface WooCommerceVariation extends WooCommerceStock {
  id: string;
  /** Option values in the product's option order, such as ["Large"]. */
  optionValues: string[];
}

/**
 * WooCommerce keeps a product's price and stock in hidden fields, its options as
 * "pa_size"-style attributes, and each option combination as a product_variation post
 * under the product.
 */
export function readWooCommerceProducts(
  productNodes: XmlNode[],
  variationNodes: XmlNode[],
): WooCommerceProduct[] {
  return productNodes.map((node) => {
    const id = text(node["wp:post_id"]);
    const meta = readMeta(node);
    const optionKeys = readAttributeKeys(meta.get("_product_attributes") ?? "");
    const variations = variationNodes
      .filter((variation) => text(variation["wp:post_parent"]) === id)
      .sort((first, second) => menuOrderOf(first) - menuOrderOf(second))
      .map((variation) => {
        const variationMeta = readMeta(variation);
        return {
          id: text(variation["wp:post_id"]),
          optionValues: optionKeys.map((key) =>
            optionValueLabel(variationMeta.get(`attribute_${key}`) ?? ""),
          ),
          ...readStock(variationMeta),
        };
      });
    const gallery = (meta.get("_product_image_gallery") ?? "").split(",").filter(Boolean);
    return {
      id,
      title: decodeEntities(text(node.title)),
      slug: text(node["wp:post_name"]),
      link: text(node.link),
      status: text(node["wp:status"]),
      content: text(node["content:encoded"]),
      excerpt: text(node["excerpt:encoded"]),
      productType: termSlugsIn(node, "product_type")[0] ?? "simple",
      categories: termNamesIn(node, "product_cat"),
      tags: termNamesIn(node, "product_tag"),
      imageIds: [meta.get("_thumbnail_id") ?? "", ...gallery].filter(Boolean),
      optionNames: optionKeys.map(optionNameLabel),
      stock: readStock(meta),
      variations,
    };
  });
}

function menuOrderOf(node: XmlNode): number {
  return Number.parseInt(text(node["wp:menu_order"]) || "0", 10) || 0;
}

function readStock(meta: Map<string, string>): WooCommerceStock {
  return {
    sku: meta.get("_sku") ?? "",
    regularPrice: meta.get("_regular_price") || meta.get("_price") || "",
    salePrice: meta.get("_sale_price") ?? "",
    managed: meta.get("_manage_stock") === "yes",
    quantity: Number.parseInt(meta.get("_stock") || "0", 10) || 0,
    weight: meta.get("_weight") ?? "",
  };
}

/**
 * The attribute keys in WooCommerce's `_product_attributes`, which PHP stores serialized:
 * `a:1:{s:7:"pa_size";a:6:{s:4:"name";s:7:"pa_size";...}}`. Only the outer keys matter.
 */
export function readAttributeKeys(serialized: string): string[] {
  const keys: string[] = [];
  for (const match of serialized.matchAll(/s:\d+:"name";s:\d+:"([^"]+)"/g)) {
    if (match[1] && !keys.includes(match[1])) {
      keys.push(match[1]);
    }
  }
  return keys.slice(0, 3);
}

/** "pa_shirt-size" is the Shirt size attribute. */
function optionNameLabel(key: string): string {
  const words = key.replace(/^pa_/, "").replace(/[-_]+/g, " ").trim();
  return words ? `${words[0]?.toUpperCase()}${words.slice(1)}` : "Option";
}

/** Variation values are stored as slugs ("extra-large"); shown as words. */
function optionValueLabel(value: string): string {
  const words = decodeEntities(value).replace(/-/g, " ").trim();
  return words ? `${words[0]?.toUpperCase()}${words.slice(1)}` : "Any";
}
