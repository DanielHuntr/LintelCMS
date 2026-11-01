import type { ShopContext } from "../commerce.context.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { announceOrderFulfilled } from "../emails/order-notifications.js";
import { unfulfilledQuantity } from "./order-statuses.js";
import { refreshOrderTotals } from "./order-totals.js";
import {
  InvalidOrderLinesError,
  NothingToFulfilError,
  OrderCancelledError,
} from "./orders.errors.js";
import {
  insertOrderEvent,
  listOrderLineRows,
  lockOrderRow,
  updateOrderLineRow,
} from "./orders.repository.js";
import type { FulfilOrderRequest } from "./orders.schema.js";
import type { FulfilmentRow, LineQuantity } from "./orders.table.js";
import { insertFulfilment } from "./refunds-and-fulfilments.repository.js";

/** Sending an order, or part of it, with a tracking number if there is one. */
export async function fulfilOrder(
  shop: ShopContext,
  orderId: string,
  request: FulfilOrderRequest,
  createdBy: string | null,
): Promise<FulfilmentRow> {
  const fulfilment = await shop.database.transaction(async (transaction) => {
    const order = await lockOrderRow(transaction, orderId);
    if (!order) {
      throw new ShopRecordNotFoundError("order");
    }
    if (order.cancelledAt) {
      throw new OrderCancelledError(order.name);
    }
    const lines = await listOrderLineRows(transaction, orderId);
    const sending: LineQuantity[] =
      request.lines.length > 0
        ? request.lines
        : lines
            .filter((line) => unfulfilledQuantity(line) > 0)
            .map((line) => ({ orderLineId: line.id, quantity: unfulfilledQuantity(line) }));
    if (sending.length === 0) {
      throw new NothingToFulfilError(order.name);
    }
    for (const item of sending) {
      const line = lines.find((candidate) => candidate.id === item.orderLineId);
      if (!line) {
        throw new InvalidOrderLinesError("One of the items isn't part of this order.");
      }
      if (item.quantity > unfulfilledQuantity(line)) {
        throw new InvalidOrderLinesError(
          `Only ${unfulfilledQuantity(line)} of ${line.productTitle} still need sending.`,
        );
      }
      await updateOrderLineRow(transaction, line.id, {
        fulfilledQuantity: line.fulfilledQuantity + item.quantity,
      });
    }

    const saved = await insertFulfilment(transaction, {
      orderId,
      lines: sending,
      trackingCompany: request.trackingCompany,
      trackingNumber: request.trackingNumber,
      trackingUrl: request.trackingUrl,
      createdBy,
    });
    const count = sending.reduce((sum, item) => sum + item.quantity, 0);
    const carrier = request.trackingCompany ? ` with ${request.trackingCompany}` : "";
    const tracking = request.trackingNumber ? `, tracking number ${request.trackingNumber}` : "";
    await insertOrderEvent(transaction, {
      orderId,
      kind: "fulfilled",
      message: `${count} ${count === 1 ? "item" : "items"} sent${carrier}${tracking}`,
      data: { fulfilmentId: saved.id },
      createdBy,
    });
    await refreshOrderTotals(transaction, order);
    return saved;
  });

  await announceOrderFulfilled(shop, orderId, fulfilment, {
    emailTheCustomer: request.notifyCustomer,
  });
  return fulfilment;
}
