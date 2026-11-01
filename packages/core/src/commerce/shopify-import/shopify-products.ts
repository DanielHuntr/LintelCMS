import type { CsvTable } from "./csv.js";

/**
 * Reads Shopify's products export (Products → Export → "CSV for Excel, Numbers, or other
 * spreadsheet programs"). One product spans several rows with the same Handle: the first
 * has the product's details, every row with an option value or a price is a variant, and
 * rows with only an Image Src add photos.
 */

export interface ShopifyVariant {
  optionValues: string[];
  sku: string;
  barcode: string;
  grams: number;
  tracked: boolean;
  quantity: number;
  /** As Shopify writes it, "45.00", in the shop's currency. */
  price: string;
  compareAtPrice: string;
  imageSrc: string;
}

export interface ShopifyImage {
  src: string;
  alt: string;
}

export interface ShopifyProduct {
  handle: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: "active" | "draft" | "archived";
  options: Array<{ name: string; values: string[] }>;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  seoTitle: string;
  seoDescription: string;
  /** From a "Collection" column, which some exports and apps add. */
  collections: string[];
  giftCard: boolean;
}

/** Which Shopify column becomes which Lintel field; the rest are listed as not imported. */
export const PRODUCT_COLUMN_FIELDS: Record<string, string> = {
  Handle: "handle",
  Title: "title",
  "Body (HTML)": "description",
  Vendor: "vendor",
  Type: "productType",
  Tags: "tags",
  Published: "status",
  Status: "status",
  "Option1 Name": "options",
  "Option1 Value": "options",
  "Option2 Name": "options",
  "Option2 Value": "options",
  "Option3 Name": "options",
  "Option3 Value": "options",
  "Variant SKU": "sku",
  "Variant Grams": "weight",
  "Variant Inventory Tracker": "trackStock",
  "Variant Inventory Qty": "stock",
  "Variant Price": "price",
  "Variant Compare At Price": "compareAtPrice",
  "Variant Barcode": "barcode",
  "Image Src": "photos",
  "Image Alt Text": "photos",
  "Image Position": "photos",
  "Variant Image": "photos",
  "SEO Title": "seoTitle",
  "SEO Description": "seoDescription",
  Collection: "collections",
  "Gift Card": "giftCard",
};

export function readShopifyProducts(table: CsvTable): ShopifyProduct[] {
  const products = new Map<string, ShopifyProduct>();
  for (const row of table.rows) {
    const handle = cell(row, "Handle");
    if (!handle) continue;
    let product = products.get(handle);
    if (!product) {
      product = startProduct(handle, row);
      products.set(handle, product);
    }
    if (isVariantRow(row)) {
      product.variants.push(readVariant(row, product.options.length));
      product.options.forEach((option, index) => {
        const value = cell(row, `Option${index + 1} Value`);
        if (value && !option.values.includes(value)) option.values.push(value);
      });
    }
    const imageSrc = cell(row, "Image Src");
    if (imageSrc && !product.images.some((image) => image.src === imageSrc)) {
      product.images.push({ src: imageSrc, alt: cell(row, "Image Alt Text") });
    }
    const variantImage = cell(row, "Variant Image");
    if (variantImage && !product.images.some((image) => image.src === variantImage)) {
      product.images.push({ src: variantImage, alt: "" });
    }
  }
  return [...products.values()];
}

function startProduct(handle: string, row: Record<string, string>): ShopifyProduct {
  const optionNames = [1, 2, 3]
    .map((index) => cell(row, `Option${index} Name`))
    .filter((name) => name !== "");
  // A product without options has one variant called "Default Title" under an option "Title".
  const hasOptions = !(optionNames.length === 1 && cell(row, "Option1 Value") === "Default Title");
  return {
    handle,
    title: cell(row, "Title"),
    bodyHtml: cell(row, "Body (HTML)"),
    vendor: cell(row, "Vendor"),
    productType: cell(row, "Type"),
    tags: splitList(cell(row, "Tags")),
    status: readStatus(row),
    options: hasOptions ? optionNames.map((name) => ({ name, values: [] })) : [],
    variants: [],
    images: [],
    seoTitle: cell(row, "SEO Title"),
    seoDescription: cell(row, "SEO Description"),
    collections: splitList(cell(row, "Collection")),
    giftCard: cell(row, "Gift Card").toLowerCase() === "true",
  };
}

function isVariantRow(row: Record<string, string>): boolean {
  return cell(row, "Option1 Value") !== "" || cell(row, "Variant Price") !== "";
}

function readVariant(row: Record<string, string>, optionCount: number): ShopifyVariant {
  return {
    optionValues: Array.from({ length: optionCount }, (_, index) =>
      cell(row, `Option${index + 1} Value`),
    ),
    sku: cell(row, "Variant SKU"),
    barcode: cell(row, "Variant Barcode").replace(/^'/, ""),
    grams: Math.max(0, Math.round(Number(cell(row, "Variant Grams")) || 0)),
    tracked: cell(row, "Variant Inventory Tracker").toLowerCase() === "shopify",
    quantity: Math.round(Number(cell(row, "Variant Inventory Qty")) || 0),
    price: cell(row, "Variant Price"),
    compareAtPrice: cell(row, "Variant Compare At Price"),
    imageSrc: cell(row, "Variant Image"),
  };
}

function readStatus(row: Record<string, string>): ShopifyProduct["status"] {
  const status = cell(row, "Status").toLowerCase();
  if (status === "active" || status === "draft" || status === "archived") return status;
  return cell(row, "Published").toLowerCase() === "false" ? "draft" : "active";
}

export function cell(row: Record<string, string>, ...columns: string[]): string {
  for (const column of columns) {
    const value = row[column]?.trim();
    if (value) return value;
  }
  return "";
}

export function splitList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== ""),
    ),
  ];
}
