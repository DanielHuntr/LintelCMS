import { generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import { slugify } from "../../entries/slugs.js";
import type { RichTextDocument } from "../../fieldtypes/rich-text.js";
import { addressSchema, type Address } from "../customers/address.schema.js";
import { fromDecimalAmount } from "../payments/provider-amounts.js";
import { productRequestSchema, type ProductRequest } from "../products/products.schema.js";
import type { ShopifyCustomer } from "./shopify-customers.js";
import type { ImportOptions, NewArchivedOrderRow } from "./shopify-import.table.js";
import { readShopifyTime, type ShopifyOrder } from "./shopify-orders.js";
import type { ShopifyProduct } from "./shopify-products.js";

/**
 * Turns what was read from Shopify's files into what Lintel saves, checking each against
 * the same rules as the admin's own forms. Pure functions: nothing here touches the database.
 */

export type Mapped<Value> = { ok: true; value: Value } | { ok: false; message: string };

/** Lintel's product, without photos (they're downloaded separately). */
export function mapProduct(
  product: ShopifyProduct,
  options: ImportOptions,
  context: { currency: string; locationId: string },
): Mapped<ProductRequest> {
  if (product.giftCard) {
    return {
      ok: false,
      message: "Gift cards aren't imported. Lintel doesn't sell gift cards yet.",
    };
  }
  if (!product.title) {
    return { ok: false, message: "This product has no title in the file." };
  }
  const variants = [];
  for (const variant of product.variants) {
    const price = fromDecimalAmount(variant.price || "0", context.currency);
    if (price === null) {
      return {
        ok: false,
        message: `The price “${variant.price}” isn't an amount in ${context.currency}.`,
      };
    }
    const compareAt = variant.compareAtPrice
      ? fromDecimalAmount(variant.compareAtPrice, context.currency)
      : null;
    variants.push({
      optionValues: variant.optionValues,
      sku: variant.sku || null,
      barcode: variant.barcode || null,
      weightGrams: variant.grams,
      inventoryTracked: variant.tracked,
      prices: [
        {
          currency: context.currency,
          amount: price,
          compareAtAmount: compareAt !== null && compareAt > price ? compareAt : null,
        },
      ],
      stock: variant.tracked ? [{ locationId: context.locationId, onHand: variant.quantity }] : [],
    });
  }
  const parsed = productRequestSchema.safeParse({
    title: product.title,
    handle: lintelHandle(product.handle),
    description: htmlToRichText(product.bodyHtml),
    status: options.productStatus === "draft" ? "draft" : product.status,
    vendor: product.vendor.slice(0, 100),
    productType: product.productType.slice(0, 100),
    tags: product.tags.map((tag) => tag.slice(0, 50)).slice(0, 50),
    seoTitle: product.seoTitle.slice(0, 200),
    seoDescription: product.seoDescription.slice(0, 500),
    options: product.options,
    variants,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue ? issue.message : "This product couldn't be read." };
  }
  return { ok: true, value: parsed.data };
}

/** Shopify's handles are nearly always fine as they are; the rest are tidied the same way. */
export function lintelHandle(shopifyHandle: string): string {
  const tidy = slugify(shopifyHandle).slice(0, 80).replace(/-+$/, "");
  return tidy || "product";
}

/**
 * Product descriptions arrive as HTML. They are read with the editor's own extensions, so
 * anything it doesn't know (scripts, styles, iframes) is dropped and what's left opens in
 * the product editor.
 */
export function htmlToRichText(html: string): RichTextDocument | null {
  if (!html.trim()) return null;
  try {
    const document = generateJSON(html, [StarterKit]);
    return { ...document, type: "doc" };
  } catch {
    return null;
  }
}

export interface PlannedCollection {
  title: string;
  handle: string;
  kind: "manual" | "automatic";
  /** Shopify handles of the products picked, for manual ones. */
  productHandles: string[];
  /** The tag automatic ones match. */
  tag: string | null;
}

/** The collections to make, from the Collection column and the tags chosen. */
export function planCollections(
  products: readonly ShopifyProduct[],
  options: ImportOptions,
): PlannedCollection[] {
  const planned = new Map<string, PlannedCollection>();
  if (options.collectionsFromColumn) {
    for (const product of products) {
      for (const title of product.collections) {
        const handle = slugify(title) || "collection";
        const collection = planned.get(handle) ?? {
          title,
          handle,
          kind: "manual" as const,
          productHandles: [],
          tag: null,
        };
        collection.productHandles.push(product.handle);
        planned.set(handle, collection);
      }
    }
  }
  for (const tag of options.tagCollections) {
    const handle = slugify(tag) || "collection";
    if (!planned.has(handle)) {
      planned.set(handle, { title: tag, handle, kind: "automatic", productHandles: [], tag });
    }
  }
  return [...planned.values()];
}

export function mapCustomer(customer: ShopifyCustomer): Mapped<{
  email: string;
  name: string;
  phone: string;
  addresses: Address[];
  note: string;
}> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    return { ok: false, message: "This customer has no email address, which Lintel needs." };
  }
  const address = addressSchema.safeParse(customer.address);
  const notes = [
    customer.note,
    customer.tags.length > 0 ? `Shopify tags: ${customer.tags.join(", ")}` : "",
  ];
  return {
    ok: true,
    value: {
      email: customer.email,
      name: customer.name.slice(0, 200),
      phone: customer.phone.slice(0, 40),
      addresses: address.success ? [address.data] : [],
      note: notes.filter(Boolean).join("\n\n").slice(0, 5000),
    },
  };
}

export function mapArchivedOrder(
  order: ShopifyOrder,
): Mapped<Omit<NewArchivedOrderRow, "tenantId">> {
  const currency = order.currency;
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, message: "This order has no currency in the file." };
  }
  const placedAt = readShopifyTime(order.placedAt);
  if (!placedAt) {
    return { ok: false, message: "This order's date couldn't be read." };
  }
  const amount = (value: string) => (value ? (fromDecimalAmount(value, currency) ?? 0) : 0);
  const address = order.shippingAddress ? addressSchema.safeParse(order.shippingAddress) : null;
  return {
    ok: true,
    value: {
      source: "shopify",
      name: order.name,
      email: order.email,
      currency,
      subtotalAmount: amount(order.subtotal),
      discountAmount: amount(order.discountAmount),
      shippingAmount: amount(order.shipping),
      taxAmount: amount(order.taxes),
      totalAmount: amount(order.total),
      refundedAmount: amount(order.refundedAmount),
      paymentStatus: order.financialStatus,
      fulfilmentStatus: order.fulfilmentStatus || "unfulfilled",
      discountCodes: order.discountCodes,
      lines: order.lines.map((line) => ({
        title: line.title,
        sku: line.sku,
        quantity: line.quantity,
        unitAmount: amount(line.price),
      })),
      shippingAddress: address?.success ? address.data : null,
      placedAt,
      cancelledAt: readShopifyTime(order.cancelledAt),
    },
  };
}
