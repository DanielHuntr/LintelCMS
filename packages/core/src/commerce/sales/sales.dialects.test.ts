import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { ordersTable } from "../orders/orders.table.js";
import { sumDailySales, sumSalesByCurrency } from "./sales.repository.js";

const since = new Date("2026-11-01T00:00:00.000Z");
let orderNumber = 1;

async function addOrder(
  database: Database,
  totalAmount: number,
  createdAt: Date,
  extra: { isTest?: boolean; cancelledAt?: Date; refundedAmount?: number } = {},
) {
  orderNumber += 1;
  await database.insert(tableFor(database, ordersTable)).values({
    number: orderNumber,
    name: `#${orderNumber}`,
    checkoutId: randomUUID(),
    email: "ada@example.com",
    currency: "GBP",
    shippingAddress: {} as never,
    shippingLine: {} as never,
    subtotalAmount: totalAmount,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount,
    taxesIncluded: true,
    paidAt: createdAt,
    createdAt,
    ...extra,
  });
}

describeOnEveryDatabase("Sales summary", (handle) => {
  it("adds up sales, leaving out cancelled and test orders and taking off refunds", async () => {
    const { database } = handle;
    const day = new Date("2026-11-02T12:00:00.000Z");
    await addOrder(database, 1000, day);
    await addOrder(database, 500, day, { refundedAmount: 100 });
    await addOrder(database, 9999, day, { isTest: true });
    await addOrder(database, 9999, day, { cancelledAt: day });
    await addOrder(database, 9999, new Date("2026-10-30T12:00:00.000Z"));

    expect(await sumSalesByCurrency(database, since)).toEqual([
      { currency: "GBP", amount: 1400, orderCount: 2 },
    ]);
  });

  it("groups by UTC day, in order", async () => {
    const { database } = handle;
    await addOrder(database, 300, new Date("2026-11-03T00:00:00.000Z"));
    await addOrder(database, 100, new Date("2026-11-02T23:59:59.999Z"));
    await addOrder(database, 200, new Date("2026-11-02T00:00:00.000Z"));

    expect(await sumDailySales(database, since, "GBP")).toEqual([
      { date: "2026-11-02", amount: 300, orderCount: 2 },
      { date: "2026-11-03", amount: 300, orderCount: 1 },
    ]);
  });
});
