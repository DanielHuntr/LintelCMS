import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { insertCheckout } from "../checkouts/checkouts.repository.js";
import { findOrCreateCustomerRow, findCustomerRow } from "../customers/customers.repository.js";
import { ordersTable } from "../orders/orders.table.js";
import { findOrCreateShopSettingsRow } from "../settings/shop-settings.repository.js";
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

const TENANT = "default";

async function addOrder(database: Database, number: number, values: { customerId?: string } = {}) {
  const [order] = await insertReturning(database, tableFor(database, ordersTable), {
    number,
    name: `#${number}`,
    checkoutId: randomUUID(),
    email: "ada@example.com",
    currency: "GBP",
    shippingAddress: {} as never,
    shippingLine: {} as never,
    subtotalAmount: 100,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount: 100,
    taxesIncluded: true,
    paidAt: new Date(),
    isTest: true,
    ...values,
  });
  if (!order) throw new Error("The order was not saved.");
  return order;
}

function addTestCheckout(database: Database) {
  return insertCheckout(database, {
    marketId: randomUUID(),
    email: "ada@example.com",
    shippingAddress: {} as never,
    currency: "GBP",
    lines: [],
    shippingLine: {} as never,
    subtotalAmount: 100,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount: 100,
    taxesIncluded: true,
    taxCalculation: "manual",
    paymentProvider: "test",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
  });
}

describeOnEveryDatabase("Clearing test orders", (handle) => {
  it("counts, locks and deletes test orders", async () => {
    const { database } = handle;
    const order = await addOrder(database, 1);
    expect(await countTestOrderRows(database)).toBe(1);
    await database.transaction(async (transaction) => {
      const locked = await lockTestOrderRows(transaction as Database);
      expect(locked.map((row) => row.id)).toEqual([order.id]);
    });
    expect(await findHighestOrderNumber(database)).toBe(1);
    await releaseOrderRedemptions(database, [order.id]);
    await deleteTestOrderRows(database, [order.id]);
    expect(await countTestOrderRows(database)).toBe(0);
    expect(await findHighestOrderNumber(database)).toBeUndefined();
  });

  it("clears test checkouts", async () => {
    const { database } = handle;
    const checkout = await addTestCheckout(database);
    expect(await listOpenTestCheckoutIds(database)).toEqual([checkout.id]);
    await deleteTestCheckoutRows(database, []);
    expect(await listOpenTestCheckoutIds(database)).toEqual([]);
  });

  it("removes a customer only a test order made, and no one else", async () => {
    const { database } = handle;
    const customer = await findOrCreateCustomerRow(database, "ada@example.com", "Ada");
    const other = await findOrCreateCustomerRow(database, "kept@example.com", "Kept");
    const row = { customerId: customer.id, createdAt: customer.createdAt };
    await addOrder(database, 2, { customerId: other.id });
    await deleteCustomersLeftEmpty(database, [
      row,
      { customerId: other.id, createdAt: other.createdAt },
    ]);
    expect(await findCustomerRow(database, customer.id)).toBeUndefined();
    expect(await findCustomerRow(database, other.id)).toBeDefined();
  });

  it("hands back order numbers, if nothing else took one", async () => {
    const { database } = handle;
    await findOrCreateShopSettingsRow(database, TENANT);
    await rewindNextOrderNumber(database, 5, 1);
    expect((await findOrCreateShopSettingsRow(database, TENANT)).nextOrderNumber).toBe(1001);
    await rewindNextOrderNumber(database, 1001, 1);
    expect((await findOrCreateShopSettingsRow(database, TENANT)).nextOrderNumber).toBe(1);
  });
});
