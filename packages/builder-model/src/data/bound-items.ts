import type { EditableField } from "../components/component-definition.js";
import type { PageNode } from "../document/page-document.schema.js";

/**
 * The data a page can show besides what is typed into it: the entries a collection list
 * repeats its design for, the entry an item page is for, the shop's products and the site's
 * menu. The website loads it before drawing a page; the builder passes sample data, so the
 * canvas shows real-looking entries.
 */

/** A picture an entry has, as the website delivers it. */
export interface BoundPicture {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** Formatted text from the rich text editor, already cleaned when it was saved. */
export interface BoundHtml {
  html: string;
}

export type BoundValue = string | BoundPicture | BoundHtml | null;

/** What a field shows, so the picker only offers fields that suit an element. */
export type BoundFieldKind = "text" | "image" | "link" | "date" | "html";

/** One entry, ready to show: field paths ("title", "data.price") to values. */
export interface BoundItem {
  id: string;
  fields: Readonly<Record<string, BoundValue>>;
}

export function isBoundPicture(value: BoundValue | undefined): value is BoundPicture {
  return typeof value === "object" && value !== null && "src" in value;
}

export function isBoundHtml(value: BoundValue | undefined): value is BoundHtml {
  return typeof value === "object" && value !== null && "html" in value;
}

/** A field an item has, as the "Show a field" picker lists it. */
export interface BindableField {
  path: string;
  label: string;
  kind: BoundFieldKind;
}

/** The fields every entry has, whatever its blueprint. */
export const entryFields: readonly BindableField[] = [
  { path: "title", label: "Title", kind: "text" },
  { path: "excerpt", label: "Summary", kind: "text" },
  { path: "image", label: "Main picture", kind: "image" },
  { path: "url", label: "Its page’s address", kind: "link" },
  { path: "publishedAt", label: "Date published", kind: "date" },
  { path: "body", label: "Body text", kind: "html" },
];

/** The fields every product has, for product grids and product pages. */
export const productFields: readonly BindableField[] = [
  { path: "title", label: "Name", kind: "text" },
  { path: "excerpt", label: "Short description", kind: "text" },
  { path: "image", label: "First picture", kind: "image" },
  { path: "url", label: "Its page’s address", kind: "link" },
  { path: "price", label: "Price", kind: "text" },
  { path: "body", label: "Description", kind: "html" },
];

/** Which kinds of field a prop can show, from the Content panel field that edits it. */
export function bindableKinds(field: EditableField): readonly BoundFieldKind[] {
  switch (field.kind) {
    case "text":
      return ["text", "date", "link"];
    case "multilineText":
      return ["text", "date", "html"];
    case "image":
      return ["image"];
    case "link":
      return ["link"];
    default:
      return [];
  }
}

/** A collection a collection list can show, with its fields and a few sample entries. */
export interface DataCollection {
  handle: string;
  name: string;
  fields: readonly BindableField[];
  terms: readonly { value: string; label: string }[];
  samples: readonly BoundItem[];
}

/** One entry of a list a page has loaded, with its page links. */
export interface CollectionListData {
  items: readonly BoundItem[];
  page: number;
  totalPages: number;
  previousUrl: string | null;
  nextUrl: string | null;
}

/** Money as the storefront API sends it: the smallest unit, and the currency. */
export interface ShopMoney {
  amount: number;
  currency: string;
}

export interface ShopVariant {
  id: string;
  title: string;
  optionValues: readonly string[];
  price: ShopMoney | null;
  compareAtPrice: ShopMoney | null;
  availableForSale: boolean;
}

export interface ShopProduct {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  url: string;
  images: readonly BoundPicture[];
  options: readonly { name: string; values: readonly string[] }[];
  priceRange: { min: ShopMoney; max: ShopMoney } | null;
  availableForSale: boolean;
  variants: readonly ShopVariant[];
}

export interface ProductListData {
  products: readonly ShopProduct[];
  page: number;
  totalPages: number;
  previousUrl: string | null;
  nextUrl: string | null;
  /** The address of this list in each order, for the sort menu. */
  sortUrls: Readonly<Record<string, string>>;
  sort: string;
}

/** A link of the site's menu, with the links under it. */
export interface DataMenuLink {
  label: string;
  url: string | null;
  current: boolean;
  children: readonly DataMenuLink[];
}

/** What the site shares with every page: for headers, footers and language links. */
export interface DataSite {
  siteName: string;
  homeUrl: string;
  logo: BoundPicture | null;
  menu: readonly DataMenuLink[];
  socialLinks: readonly string[];
  footerText: string;
  languages: readonly { code: string; name: string; url: string; current: boolean }[];
  locale: string;
  /** Where the shop's storefront API is reached from the page: "/_lintel/api". */
  apiBase: string;
}

/** Everything a page's dynamic elements show, by the id of the element that shows it. */
export interface PageData {
  site?: DataSite;
  /** The entry an item page is for, or the page's own entry. */
  item?: BoundItem;
  /** The product a product page is for. */
  product?: ShopProduct;
  lists?: Readonly<Record<string, CollectionListData>>;
  productLists?: Readonly<Record<string, ProductListData>>;
  /** Products chosen by handle in product cards and other shop elements. */
  products?: Readonly<Record<string, ShopProduct>>;
  forms?: Readonly<Record<string, DataForm>>;
}

/** A form from the Forms plugin, as a page draws it. */
export interface DataForm {
  handle: string;
  name: string;
  submitLabel: string;
  acceptingSubmissions: boolean;
  fields: readonly DataFormField[];
  spamProtection: { honeypotField: string; tokenField: string; token: string };
  confirmationMessage: string;
}

export interface DataFormField {
  handle: string;
  type: string;
  label: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  choices: readonly string[];
}

/** The ids of every element of `types` in the tree, so a page loads only what it shows. */
export function findNodesOfType(root: PageNode, types: readonly string[]): PageNode[] {
  const found: PageNode[] = [];
  const visit = (node: PageNode) => {
    if (node.hidden) return;
    if (types.includes(node.type)) found.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return found;
}

/**
 * The props an element shows for one item: its own, with each bound prop replaced by the
 * item's field. Pictures fill a picture prop whole, or a `src` prop with its `alt` beside it.
 * Fields the item doesn't have leave the typed value alone.
 */
export function bindProps(
  props: Readonly<Record<string, unknown>>,
  bindings: Readonly<Record<string, string>> | undefined,
  item: BoundItem | undefined,
): Record<string, unknown> {
  if (!bindings || !item) return { ...props };
  const bound: Record<string, unknown> = { ...props };
  for (const [prop, path] of Object.entries(bindings)) {
    const value = item.fields[path];
    if (value === undefined) continue;
    if (isBoundPicture(value)) {
      if (typeof props[prop] === "object" && props[prop] !== null) {
        bound[prop] = { src: value.src, alt: value.alt, assetId: null };
      } else {
        bound[prop] = value.src;
        if (prop === "src") bound.alt = value.alt;
      }
    } else if (isBoundHtml(value)) {
      bound[prop] = value.html;
    } else {
      bound[prop] = value ?? "";
    }
  }
  return bound;
}

/** Turns an amount in a currency's smallest unit into words: £45.00, ¥4,500. */
export function formatMoney(money: ShopMoney, locale = "en-GB"): string {
  try {
    const format = new Intl.NumberFormat(locale, { style: "currency", currency: money.currency });
    const places = format.resolvedOptions().maximumFractionDigits ?? 2;
    return format.format(money.amount / 10 ** places);
  } catch {
    return `${(money.amount / 100).toFixed(2)} ${money.currency}`;
  }
}

/** A product as a bound item, so headings and pictures in a product's design can show it. */
export function productAsItem(product: ShopProduct, locale?: string): BoundItem {
  const image = product.images[0];
  const price = product.priceRange
    ? product.priceRange.min.amount === product.priceRange.max.amount
      ? formatMoney(product.priceRange.min, locale)
      : `From ${formatMoney(product.priceRange.min, locale)}`
    : "";
  return {
    id: product.id,
    fields: {
      title: product.title,
      excerpt: product.descriptionHtml
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200),
      image: image ?? null,
      url: product.url,
      price,
      body: { html: product.descriptionHtml },
    },
  };
}
