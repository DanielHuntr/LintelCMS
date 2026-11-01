import type { DatabaseOrTransaction } from "../../database/client.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { restock } from "../inventory/inventory.service.js";
import { stripeKeyMode } from "../payments/stripe-keys.js";
import { describeOrder, describeOrderSummary } from "./order-descriptions.js";
import { refundableAmount } from "./order-totals.js";
import { OrderAlreadyFulfilledError, OrderCancelledError } from "./orders.errors.js";
import {
  findOrderRow,
  insertOrderEvent,
  listOrderEventRows,
  listOrderLineRows,
  listOrderRows,
  lockOrderRow,
  updateOrderRow,
} from "./orders.repository.js";
import type { CancelOrderRequest, ListOrdersQuery, Order, OrderSummary } from "./orders.schema.js";
import { listFulfilmentRows, listRefundRows } from "./refunds-and-fulfilments.repository.js";
import { refundOrder } from "./refunds.service.js";

/** Orders as staff work with them. Refunds and fulfilments have their own files. */

export async function listOrders(
  database: DatabaseOrTransaction,
  query: ListOrdersQuery,
): Promise<{ items: OrderSummary[]; total: number }> {
  const { rows, total } = await listOrderRows(database, query, query);
  const items: OrderSummary[] = [];
  for (const row of rows) {
    const lines = await listOrderLineRows(database, row.id);
    items.push(
      describeOrderSummary(
        row,
        lines.reduce((sum, line) => sum + line.quantity, 0),
      ),
    );
  }
  return { items, total };
}

export async function findOrder(shop: ShopContext, orderId: string): Promise<Order> {
  const row = await findOrderRow(shop.database, orderId);
  if (!row) {
    throw new ShopRecordNotFoundError("order");
  }
  const keys = await shop.stripeKeys();
  return describeOrder(row, {
    lines: await listOrderLineRows(shop.database, orderId),
    refunds: await listRefundRows(shop.database, orderId),
    fulfilments: await listFulfilmentRows(shop.database, orderId),
    events: await listOrderEventRows(shop.database, orderId),
    refundable: await refundableAmount(shop.database, row),
    stripeMode: keys.secretKey ? stripeKeyMode(keys.secretKey.value) : null,
  });
}

export async function addOrderNote(
  shop: ShopContext,
  orderId: string,
  message: string,
  createdBy: string,
): Promise<Order> {
  if (!(await findOrderRow(shop.database, orderId))) {
    throw new ShopRecordNotFoundError("order");
  }
  await insertOrderEvent(shop.database, { orderId, kind: "note", message, createdBy });
  return findOrder(shop, orderId);
}

/**
 * Cancels an order nothing has been sent from yet. By default the money still held is
 * refunded and the items go back into stock. The refund comes first: if Stripe refuses it,
 * the order stays as it was.
 */
export async function cancelOrder(
  shop: ShopContext,
  orderId: string,
  request: CancelOrderRequest,
  cancelledBy: string,
): Promise<Order> {
  const order = await findOrderRow(shop.database, orderId);
  if (!order) {
    throw new ShopRecordNotFoundError("order");
  }
  if (order.cancelledAt) {
    throw new OrderCancelledError(order.name);
  }
  if (order.fulfilmentStatus !== "unfulfilled") {
    throw new OrderAlreadyFulfilledError(order.name);
  }
  const refundable = await refundableAmount(shop.database, order);
  if (request.refund && refundable > 0) {
    await refundOrder(
      shop,
      orderId,
      {
        amount: refundable,
        lines: [],
        reason: request.reason || "Order cancelled",
        restock: false,
        notifyCustomer: request.notifyCustomer,
      },
      cancelledBy,
    );
  }

  await shop.database.transaction(async (transaction) => {
    const locked = await lockOrderRow(transaction, orderId);
    if (!locked || locked.cancelledAt) return;
    const lines = await listOrderLineRows(transaction, orderId);
    if (request.restock) {
      await restock(
        transaction,
        lines.flatMap((line) => {
          const quantity = line.quantity - line.refundedQuantity;
          return line.variantId && quantity > 0 ? [{ variantId: line.variantId, quantity }] : [];
        }),
      );
    }
    await updateOrderRow(transaction, orderId, {
      cancelledAt: shop.now(),
      cancelReason: request.reason || null,
    });
    await insertOrderEvent(transaction, {
      orderId,
      kind: "cancelled",
      message: `Order cancelled${request.reason ? `: ${request.reason}` : ""}${request.restock ? ". Items put back in stock" : ""}`,
      createdBy: cancelledBy,
    });
  });
  return findOrder(shop, orderId);
}
