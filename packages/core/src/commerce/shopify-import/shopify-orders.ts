import type { CsvTable } from "./csv.js";
import { cell, splitList } from "./shopify-products.js";

/**
 * Reads Shopify's orders export (Orders → Export). One order spans one row per item; the
 * order's own details are on its first row. These become archived records: history to look
 * up, not orders Lintel can refund or send.
 */
export interface ShopifyOrder {
  name: string;
  email: string;
  currency: string;
  financialStatus: string;
  fulfilmentStatus: string;
  subtotal: string;
  shipping: string;
  taxes: string;
  total: string;
  discountAmount: string;
  refundedAmount: string;
  discountCodes: string[];
  placedAt: string;
  cancelledAt: string;
  shippingAddress: {
    name: string;
    company: string;
    line1: string;
    line2: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone: string;
  } | null;
  lines: Array<{ title: string; sku: string; quantity: number; price: string }>;
}

export const ORDER_COLUMN_FIELDS: Record<string, string> = {
  Name: "orderNumber",
  Email: "email",
  Currency: "currency",
  "Financial Status": "paymentStatus",
  "Fulfillment Status": "fulfilmentStatus",
  Subtotal: "totals",
  Shipping: "totals",
  Taxes: "totals",
  Total: "totals",
  "Discount Code": "discounts",
  "Discount Amount": "discounts",
  "Refunded Amount": "totals",
  "Created at": "placedAt",
  "Cancelled at": "placedAt",
  "Lineitem quantity": "items",
  "Lineitem name": "items",
  "Lineitem price": "items",
  "Lineitem sku": "items",
  "Shipping Name": "shippingAddress",
  "Shipping Company": "shippingAddress",
  "Shipping Address1": "shippingAddress",
  "Shipping Address2": "shippingAddress",
  "Shipping City": "shippingAddress",
  "Shipping Zip": "shippingAddress",
  "Shipping Province": "shippingAddress",
  "Shipping Country": "shippingAddress",
  "Shipping Phone": "shippingAddress",
};

export function readShopifyOrders(table: CsvTable): ShopifyOrder[] {
  const orders = new Map<string, ShopifyOrder>();
  for (const row of table.rows) {
    const name = cell(row, "Name");
    if (!name) continue;
    let order = orders.get(name);
    if (!order) {
      order = startOrder(name, row);
      orders.set(name, order);
    }
    const title = cell(row, "Lineitem name");
    if (title) {
      order.lines.push({
        title,
        sku: cell(row, "Lineitem sku"),
        quantity: Math.max(1, Math.round(Number(cell(row, "Lineitem quantity")) || 1)),
        price: cell(row, "Lineitem price"),
      });
    }
  }
  return [...orders.values()];
}

function startOrder(name: string, row: Record<string, string>): ShopifyOrder {
  const line1 = cell(row, "Shipping Address1", "Shipping Street");
  return {
    name,
    email: cell(row, "Email").toLowerCase(),
    currency: cell(row, "Currency").toUpperCase(),
    financialStatus: cell(row, "Financial Status").toLowerCase(),
    fulfilmentStatus: cell(row, "Fulfillment Status").toLowerCase(),
    subtotal: cell(row, "Subtotal"),
    shipping: cell(row, "Shipping"),
    taxes: cell(row, "Taxes"),
    total: cell(row, "Total"),
    discountAmount: cell(row, "Discount Amount"),
    refundedAmount: cell(row, "Refunded Amount"),
    discountCodes: splitList(cell(row, "Discount Code")),
    placedAt: cell(row, "Created at", "Paid at"),
    cancelledAt: cell(row, "Cancelled at"),
    shippingAddress: line1
      ? {
          name: cell(row, "Shipping Name"),
          company: cell(row, "Shipping Company"),
          line1,
          line2: cell(row, "Shipping Address2"),
          city: cell(row, "Shipping City"),
          region: cell(row, "Shipping Province"),
          postalCode: cell(row, "Shipping Zip").replace(/^'/, ""),
          country: cell(row, "Shipping Country").toUpperCase(),
          phone: cell(row, "Shipping Phone"),
        }
      : null,
    lines: [],
  };
}

/** "2026-03-01 10:15:00 +0000", as Shopify writes times. Null when it can't be read. */
export function readShopifyTime(value: string): Date | null {
  if (!value) return null;
  const iso = value
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)/, "$1T$2")
    .replace(/ ?([+-]\d{2})(\d{2})$/, "$1:$2");
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
