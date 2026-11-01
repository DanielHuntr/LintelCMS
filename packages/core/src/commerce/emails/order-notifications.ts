import type { ShopContext } from "../commerce.context.js";
import { findOrderRow, listOrderLineRows, insertOrderEvent } from "../orders/orders.repository.js";
import type { FulfilmentRow, RefundRow } from "../orders/orders.table.js";
import { readShopSettings } from "../settings/shop-settings.service.js";
import type { EmailMessage } from "./email-provider.js";
import { orderConfirmationEmail, orderRefundedEmail, orderShippedEmail } from "./order-emails.js";

/**
 * Sends an order's emails after the change is saved. Email failing never undoes an order,
 * a refund or a shipment: it's logged and noted on the order's timeline, so staff can tell
 * the customer another way.
 */

export async function sendOrderConfirmation(shop: ShopContext, orderId: string): Promise<void> {
  await sendAbout(shop, orderId, async (order, lines, identity) =>
    orderConfirmationEmail(order, lines, identity),
  );
}

export async function sendOrderShipped(
  shop: ShopContext,
  orderId: string,
  fulfilment: FulfilmentRow,
): Promise<void> {
  await sendAbout(shop, orderId, async (order, lines, identity) =>
    orderShippedEmail(order, fulfilment, lines, identity),
  );
}

export async function sendOrderRefunded(
  shop: ShopContext,
  orderId: string,
  refund: RefundRow,
): Promise<void> {
  await sendAbout(shop, orderId, async (order, _lines, identity) =>
    orderRefundedEmail(order, refund, identity),
  );
}

type Compose = (
  order: NonNullable<Awaited<ReturnType<typeof findOrderRow>>>,
  lines: Awaited<ReturnType<typeof listOrderLineRows>>,
  identity: { shopName: string; supportEmail: string },
) => Promise<EmailMessage>;

async function sendAbout(shop: ShopContext, orderId: string, compose: Compose): Promise<void> {
  const order = await findOrderRow(shop.database, orderId);
  if (!order) return;
  const settings = await readShopSettings(shop.database);
  const message = await compose(order, await listOrderLineRows(shop.database, orderId), settings);
  try {
    await shop.emails.send(message);
    await insertOrderEvent(shop.database, {
      orderId,
      kind: "email_sent",
      message: `“${message.subject}” email sent to ${message.to}`,
      data: { emailKind: message.kind, provider: shop.emails.name },
    });
  } catch (error) {
    shop.log.error(error, `Sending the ${message.kind} email for order ${order.name} failed`);
    await insertOrderEvent(shop.database, {
      orderId,
      kind: "email_failed",
      message: `The “${message.subject}” email couldn't be sent to ${message.to}`,
      data: { emailKind: message.kind },
    });
  }
}
