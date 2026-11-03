import type { Transaction } from "../../database/client.js";
import { abandonCheckout } from "../checkouts/checkout-expiry.js";
import type { ShopContext } from "../commerce.context.js";
import { lockVariantRows } from "../inventory/inventory.repository.js";
import { restock } from "../inventory/inventory.service.js";
import { listOrderEventRows, listOrderLineRows } from "../orders/orders.repository.js";
import type { OrderLineRow, OrderRow, RefundRow } from "../orders/orders.table.js";
import { listRefundRows } from "../orders/refunds-and-fulfilments.repository.js";
import {
  countTestOrderRows,
  deleteCustomersLeftEmpty,
  deleteTestCheckoutRows,
  deleteTestOrderRows,
  findHighestOrderNumber,
  listOpenTestCheckoutIds,
  lockTestOrderRows,
  releaseOrderRedemptions,
  rewindNextOrderNumber,
} from "./test-orders.repository.js";

/** Clearing away what trying the shop left behind, in one action. */

export async function summariseTestOrders(shop: ShopContext): Promise<{ count: number }> {
  return { count: await countTestOrderRows(shop.database) };
}

/**
 * Deletes every test order and test checkout. Stock comes back unless it already has (a
 * refund or cancelling that restocked), discount uses are given back, customers who only
 * existed because of a test go too, and so do order numbers nothing real has come after.
 * Real orders are never touched: every delete here is limited to test rows.
 */
export async function deleteTestOrders(shop: ShopContext): Promise<{ deleted: number }> {
  return shop.database.transaction(async (transaction) => {
    for (const checkoutId of await listOpenTestCheckoutIds(transaction)) {
      await abandonCheckout(transaction, checkoutId);
    }
    const orders = await lockTestOrderRows(transaction);
    for (const order of orders) {
      await putStockBack(transaction, order);
    }
    const orderIds = orders.map((order) => order.id);
    await releaseOrderRedemptions(transaction, orderIds);
    await deleteTestOrderRows(transaction, orderIds);
    await deleteTestCheckoutRows(
      transaction,
      orders.map((order) => order.checkoutId),
    );
    await deleteCustomersLeftEmpty(
      transaction,
      orders.flatMap((order) => order.customerId ?? []),
    );
    await handBackOrderNumbers(transaction, orders);
    return { deleted: orders.length };
  });
}

async function putStockBack(transaction: Transaction, order: OrderRow): Promise<void> {
  const lines = await listOrderLineRows(transaction, order.id);
  const refunds = await listRefundRows(transaction, order.id);
  const events = await listOrderEventRows(transaction, order.id);
  const cancelledWithRestock = events.some(
    (event) => event.kind === "cancelled" && event.data.restocked === true,
  );
  const variantIds = lines.flatMap((line) => line.variantId ?? []);
  // A product deleted since has no stock to put back, and only tracked items were taken.
  const tracked = new Set(
    (await lockVariantRows(transaction, variantIds))
      .filter((variant) => variant.inventoryTracked)
      .map((variant) => variant.id),
  );
  await restock(
    transaction,
    lines.flatMap((line) => {
      const quantity = line.quantity - alreadyBack(line, refunds, cancelledWithRestock);
      return line.variantId && tracked.has(line.variantId) && quantity > 0
        ? [{ variantId: line.variantId, quantity }]
        : [];
    }),
  );
}

/** How much of a line went back already, by a refund that restocked or by cancelling. */
function alreadyBack(
  line: OrderLineRow,
  refunds: readonly RefundRow[],
  cancelledWithRestock: boolean,
): number {
  const byRefunds = refunds
    .filter((refund) => refund.status === "succeeded" && refund.restock)
    .flatMap((refund) => refund.lines)
    .filter((item) => item.orderLineId === line.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  return cancelledWithRestock ? line.quantity - line.refundedQuantity + byRefunds : byRefunds;
}

async function handBackOrderNumbers(
  transaction: Transaction,
  orders: readonly OrderRow[],
): Promise<void> {
  if (orders.length === 0) return;
  const numbers = orders.map((order) => order.number);
  const lowest = Math.min(...numbers);
  const highest = Math.max(...numbers);
  const stillInUse = await findHighestOrderNumber(transaction);
  if (stillInUse === undefined || stillInUse < lowest) {
    await rewindNextOrderNumber(transaction, highest + 1, lowest);
  }
}
