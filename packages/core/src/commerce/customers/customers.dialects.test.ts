import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { ordersTable } from "../orders/orders.table.js";
import { archivedOrdersTable } from "../shopify-import/shopify-import.table.js";
import {
  findCustomerRow,
  findOrCreateCustomerRow,
  listCustomerRows,
  sumCustomerOrders,
  updateCustomerRow,
} from "./customers.repository.js";

const firstPage = { page: 1, perPage: 10 };
const placedAt = new Date("2026-01-01T00:00:00.000Z");

async function addOrder(database: Database, customerId: string, number: number, amount: number) {
  await database.insert(tableFor(database, ordersTable)).values({
    number,
    name: `#${number}`,
    checkoutId: randomUUID(),
    customerId,
    email: "ada@example.com",
    currency: "GBP",
    shippingAddress: {} as never,
    shippingLine: {} as never,
    subtotalAmount: amount,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount: amount,
    taxesIncluded: true,
    paidAt: placedAt,
  });
}

async function addArchivedOrder(
  database: Database,
  customerId: string,
  name: string,
  cancelledAt: Date | null,
) {
  await database.insert(tableFor(database, archivedOrdersTable)).values({
    customerId,
    name,
    currency: "GBP",
    placedAt,
    totalAmount: 300,
    cancelledAt,
  } as never);
}

describeOnEveryDatabase("Customers", (handle) => {
  it("shares one customer per email, even at the same moment", async () => {
    const { database } = handle;
    const [first, second] = await Promise.all([
      findOrCreateCustomerRow(database, "ada@example.com", "Ada"),
      findOrCreateCustomerRow(database, "ada@example.com", "Ada"),
    ]);
    expect(first.id).toBe(second.id);
    await updateCustomerRow(database, first.id, { note: "Regular" });
    expect((await findCustomerRow(database, first.id))?.note).toBe("Regular");
  });

  it("searches names and emails whatever the case", async () => {
    const { database } = handle;
    await findOrCreateCustomerRow(database, "ada@example.com", "Ada Lovelace");
    await findOrCreateCustomerRow(database, "grace@example.com", "Grace");
    const found = await listCustomerRows(database, "LOVELACE", firstPage);
    expect(found.total).toBe(1);
    expect((await listCustomerRows(database, undefined, firstPage)).total).toBe(2);
  });

  it("adds up orders, old ones too, leaving cancelled ones out of the money", async () => {
    const { database } = handle;
    const { id } = await findOrCreateCustomerRow(database, "ada@example.com", "Ada");
    await addOrder(database, id, 1, 1000);
    await addArchivedOrder(database, id, "#old-1", null);
    await addArchivedOrder(database, id, "#old-2", placedAt);

    expect(await sumCustomerOrders(database, [])).toEqual(new Map());
    const totals = (await sumCustomerOrders(database, [id])).get(id);
    expect(totals?.orderCount).toBe(2);
    expect(totals?.totalSpent).toEqual([{ currency: "GBP", amount: 1300 }]);
    expect(totals?.firstArchivedOrderAt).toEqual(placedAt);
  });
});
