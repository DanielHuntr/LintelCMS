import { countryName } from "../money/currencies.js";
import { formatMoney } from "../money/money-format.js";
import type { FulfilmentRow, OrderLineRow, OrderRow, RefundRow } from "../orders/orders.table.js";
import type { EmailMessage } from "./email-provider.js";

/**
 * The words of the three order emails, as plain text and simple HTML. Plain English, the
 * order number up front, and nothing a spam filter dislikes. Everything from the order is
 * escaped before it goes into HTML.
 */

export interface ShopIdentity {
  shopName: string;
  supportEmail: string;
}

export function orderConfirmationEmail(
  order: OrderRow,
  lines: readonly OrderLineRow[],
  shop: ShopIdentity,
): EmailMessage {
  const price = (amount: number) => formatMoney({ amount, currency: order.currency });
  const itemLines = lines.map(
    (line) => `${line.quantity} × ${lineName(line)}  ${price(line.subtotalAmount)}`,
  );
  const totals = [
    `Subtotal: ${price(order.subtotalAmount)}`,
    ...(order.discountAmount > 0 ? [`Discount: −${price(order.discountAmount)}`] : []),
    `Shipping (${order.shippingLine.name}): ${price(order.shippingAmount)}`,
    order.taxesIncluded
      ? `Including tax: ${price(order.taxAmount)}`
      : `Tax: ${price(order.taxAmount)}`,
    `Total paid: ${price(order.totalAmount)}`,
  ];
  const address = describeAddress(order);
  const text = [
    `Thank you for your order, ${firstName(order)}.`,
    `We've received your payment for order ${order.name} and will let you know when it's on its way.`,
    "",
    ...itemLines,
    "",
    ...totals,
    "",
    "Delivering to:",
    ...address,
    ...signOff(shop),
  ].join("\n");
  return {
    kind: "order_confirmation",
    to: order.email,
    orderId: order.id,
    subject: `Order ${order.name} confirmed`,
    text,
    html: layout(shop, [
      paragraph(`Thank you for your order, ${firstName(order)}.`),
      paragraph(
        `We've received your payment for order ${order.name} and will let you know when it's on its way.`,
      ),
      list(itemLines),
      list(totals),
      paragraph("Delivering to:"),
      list(address),
    ]),
  };
}

export function orderShippedEmail(
  order: OrderRow,
  fulfilment: FulfilmentRow,
  lines: readonly OrderLineRow[],
  shop: ShopIdentity,
): EmailMessage {
  const sent = fulfilment.lines.flatMap((sentLine) => {
    const line = lines.find((candidate) => candidate.id === sentLine.orderLineId);
    return line ? [`${sentLine.quantity} × ${lineName(line)}`] : [];
  });
  const tracking = fulfilment.trackingNumber
    ? [
        `Tracking number: ${fulfilment.trackingNumber}${fulfilment.trackingCompany ? ` (${fulfilment.trackingCompany})` : ""}`,
        ...(fulfilment.trackingUrl ? [`Track it here: ${fulfilment.trackingUrl}`] : []),
      ]
    : [];
  const text = [
    `Good news, ${firstName(order)}: part or all of order ${order.name} is on its way.`,
    "",
    ...sent,
    "",
    ...tracking,
    ...signOff(shop),
  ].join("\n");
  return {
    kind: "order_shipped",
    to: order.email,
    orderId: order.id,
    subject: `Order ${order.name} is on its way`,
    text,
    html: layout(shop, [
      paragraph(
        `Good news, ${firstName(order)}: part or all of order ${order.name} is on its way.`,
      ),
      list(sent),
      tracking.length > 0 ? list(tracking) : "",
    ]),
  };
}

export function orderRefundedEmail(
  order: OrderRow,
  refund: RefundRow,
  shop: ShopIdentity,
): EmailMessage {
  const amount = formatMoney({ amount: refund.amount, currency: refund.currency });
  const lines = [
    `We've refunded ${amount} for order ${order.name}.`,
    "It usually reaches your account within 5 to 10 working days, depending on your bank.",
  ];
  return {
    kind: "order_refunded",
    to: order.email,
    orderId: order.id,
    subject: `Refund for order ${order.name}`,
    text: [`Hello ${firstName(order)},`, "", ...lines, ...signOff(shop)].join("\n"),
    html: layout(shop, [paragraph(`Hello ${firstName(order)},`), ...lines.map(paragraph)]),
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function lineName(line: OrderLineRow): string {
  return line.variantTitle && line.variantTitle !== "Default"
    ? `${line.productTitle} (${line.variantTitle})`
    : line.productTitle;
}

function firstName(order: OrderRow): string {
  return order.shippingAddress.name.trim().split(/\s+/)[0] || "there";
}

function describeAddress(order: OrderRow): string[] {
  const address = order.shippingAddress;
  return [
    address.name,
    address.company,
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode].filter(Boolean).join(", "),
    countryName(address.country),
  ].filter((line) => line !== "");
}

function signOff(shop: ShopIdentity): string[] {
  return [
    "",
    shop.supportEmail ? `Questions? Reply to this email or write to ${shop.supportEmail}.` : "",
    shop.shopName,
  ].filter((line, index) => line !== "" || index === 0);
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`;
}

function list(lines: readonly string[]): string {
  return `<p style="margin:0 0 16px">${lines.map(escapeHtml).join("<br>")}</p>`;
}

function layout(shop: ShopIdentity, parts: readonly string[]): string {
  const footer = shop.supportEmail
    ? paragraph(`Questions? Reply to this email or write to ${shop.supportEmail}.`)
    : "";
  return [
    "<!doctype html>",
    '<html lang="en"><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#1d1d1f;max-width:560px;margin:0 auto;padding:24px">',
    shop.shopName
      ? `<p style="margin:0 0 24px;font-weight:600">${escapeHtml(shop.shopName)}</p>`
      : "",
    ...parts,
    footer,
    "</body></html>",
  ].join("");
}
