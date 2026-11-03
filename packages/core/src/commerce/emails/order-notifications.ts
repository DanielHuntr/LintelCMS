import type { ShopContext } from "../commerce.context.js";
import { fulfilmentEventData, orderEventData, refundEventData } from "../orders/order-events.js";
import { findOrderRow, insertOrderEvent, listOrderLineRows } from "../orders/orders.repository.js";
import type { FulfilmentRow, OrderRow, RefundRow } from "../orders/orders.table.js";
import { readShopSettings } from "../settings/shop-settings.service.js";
import {
  asTestEmail,
  type OrderEmail,
  orderConfirmationEmail,
  orderRefundedEmail,
  orderShippedEmail,
} from "./order-emails.js";

/**
 * What happens after an order is paid for, sent or refunded and the change is saved: the
 * customer's email (through `server.email`, see src/email) and the event on the bus, which
 * automations listen to. Neither failing undoes the order, the shipment or the refund: an
 * email failure is logged and noted on the order's timeline, so staff can tell the
 * customer another way.
 *
 * A test order's emails say so, and it stays off the event bus, so it never reaches Visitors'
 * goals or an automation that tells a warehouse or an accounts package about a sale.
 */

export async function announceOrderPaid(shop: ShopContext, orderId: string): Promise<void> {
  const order = await findOrderRow(shop.database, orderId);
  if (!order) return;
  await emailCustomer(shop, order, (lines, identity) =>
    orderConfirmationEmail(order, lines, identity),
  );
  if (order.isTest) return;
  await shop.events.publish("order.paid", { order: orderEventData(order) }, { actor: null });
}

export async function announceOrderFulfilled(
  shop: ShopContext,
  orderId: string,
  fulfilment: FulfilmentRow,
  { emailTheCustomer }: { emailTheCustomer: boolean },
): Promise<void> {
  const order = await findOrderRow(shop.database, orderId);
  if (!order) return;
  if (emailTheCustomer) {
    await emailCustomer(shop, order, (lines, identity) =>
      orderShippedEmail(order, fulfilment, lines, identity),
    );
  }
  if (order.isTest) return;
  await shop.events.publish(
    "order.fulfilled",
    { order: orderEventData(order), fulfilment: fulfilmentEventData(fulfilment) },
    { actor: null },
  );
}

export async function announceOrderRefunded(
  shop: ShopContext,
  orderId: string,
  refund: RefundRow,
  { emailTheCustomer }: { emailTheCustomer: boolean },
): Promise<void> {
  const order = await findOrderRow(shop.database, orderId);
  if (!order) return;
  if (emailTheCustomer) {
    await emailCustomer(shop, order, (_lines, identity) =>
      orderRefundedEmail(order, refund, identity),
    );
  }
  if (order.isTest) return;
  await shop.events.publish(
    "order.refunded",
    { order: orderEventData(order), refund: refundEventData(refund) },
    { actor: null },
  );
}

type Compose = (
  lines: Awaited<ReturnType<typeof listOrderLineRows>>,
  identity: { shopName: string; supportEmail: string },
) => OrderEmail;

async function emailCustomer(shop: ShopContext, order: OrderRow, compose: Compose) {
  const settings = await readShopSettings(shop.database);
  const composed = compose(await listOrderLineRows(shop.database, order.id), settings);
  const message = order.isTest ? asTestEmail(composed) : composed;
  try {
    await shop.email.send({
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(settings.supportEmail ? { replyTo: settings.supportEmail } : {}),
    });
    await insertOrderEvent(shop.database, {
      orderId: order.id,
      kind: "email_sent",
      message: `“${message.subject}” email sent to ${message.to}`,
      data: { emailKind: message.kind, sentThrough: shop.email.description },
    });
  } catch (error) {
    shop.log.error(error, `Sending the ${message.kind} email for order ${order.name} failed`);
    await insertOrderEvent(shop.database, {
      orderId: order.id,
      kind: "email_failed",
      message: `The “${message.subject}” email couldn't be sent to ${message.to}`,
      data: { emailKind: message.kind },
    });
  }
}
