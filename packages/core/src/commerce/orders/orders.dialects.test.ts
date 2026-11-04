import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database, Transaction } from "../../database/client.js";
import { isUniqueViolation } from "../../database/database-errors.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { addTestUser, describeOnEveryDatabase } from "../../testing/every-database.js";
import { usersTable } from "../../users/users.table.js";
import { customersTable } from "../customers/customers.table.js";
import {
  countOrdersPaidSince,
  countUnfulfilledOrders,
  findOrderRow,
  findOrderRowByCheckout,
  findOrderRowByPaymentIntent,
  insertOrder,
  insertOrderEvent,
  insertOrderLines,
  listOrderEventRows,
  listOrderLineRows,
  listOrderRows,
  lockOrderRow,
  updateOrderLineRow,
  updateOrderRow,
} from "./orders.repository.js";
import {
  type NewOrderRow,
  orderEventsTable,
  orderLinesTable,
  ordersTable,
} from "./orders.table.js";

const OTHER_TENANT = "other";
const PAID_AT = new Date("2026-06-01T12:00:00.123Z");
const LONG_AGO = new Date("2000-01-01T00:00:00.000Z");
const firstPage = { page: 1, perPage: 10 };

class PlacingFailed extends Error {}

const ADDRESS = {
  name: "Zoë O'Neil",
  company: "",
  line1: "1 Rue de l'Été",
  line2: "",
  city: "Malmö",
  region: "",
  postalCode: "AB1 2CD",
  country: "SE",
  phone: "",
};
const SHIPPING = { rateId: "rate-1", name: "Standard", amount: 395, taxAmount: 0 };

function addOrder(database: Database, number: number, values: Partial<NewOrderRow> = {}) {
  return insertOrder(database, {
    number,
    name: `#${number}`,
    checkoutId: randomUUID(),
    email: "ada@example.com",
    currency: "GBP",
    shippingAddress: ADDRESS as never,
    shippingLine: SHIPPING,
    subtotalAmount: 1000,
    discountAmount: 100,
    shippingAmount: 395,
    taxAmount: 50,
    totalAmount: 1345,
    taxesIncluded: true,
    paidAt: PAID_AT,
    ...values,
  });
}

async function addCustomer(database: Database, email = "ada@example.com") {
  const [customer] = await insertReturning(database, tableFor(database, customersTable), { email });
  if (!customer) throw new Error("The customer was not saved.");
  return customer;
}

function line(orderId: string, position: number, productTitle: string) {
  return {
    orderId,
    position,
    productTitle,
    variantTitle: "Large",
    quantity: 2,
    unitAmount: 500,
    subtotalAmount: 1000,
    discountAmount: 0,
    taxAmount: 0,
  };
}

function deleteOrder(database: Database, orderId: string) {
  const orders = tableFor(database, ordersTable);
  return database.delete(orders).where(eq(orders.id, orderId));
}

/** What happens when a second transaction asks for a lock the first one holds. */
async function stepsOfTwoLocks(
  database: Database,
  lock: (transaction: Transaction) => Promise<unknown>,
): Promise<string[]> {
  const steps: string[] = [];
  let letGo = () => {};
  const mayLetGo = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  let sayHeld = () => {};
  const held = new Promise<void>((resolve) => {
    sayHeld = resolve;
  });
  const first = database.transaction(async (transaction) => {
    await lock(transaction);
    sayHeld();
    await mayLetGo;
    steps.push("first let go");
  });
  await held;
  const second = database.transaction(async (transaction) => {
    await lock(transaction);
    steps.push("second has it");
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  steps.push("waited");
  letGo();
  await Promise.all([first, second]);
  return steps;
}

describeOnEveryDatabase("Orders", (handle) => {
  const numbersFound = async (filter: Parameters<typeof listOrderRows>[1]) => {
    const { rows } = await listOrderRows(handle.database, filter, firstPage);
    return rows.map((row) => row.number);
  };

  it("saves an order with the table's defaults", async () => {
    const { database } = handle;
    const order = await addOrder(database, 1001);
    expect(order).toMatchObject({
      tenantId: "default",
      number: 1001,
      name: "#1001",
      customerId: null,
      marketId: null,
      discounts: [],
      refundedAmount: 0,
      paymentStatus: "paid",
      fulfilmentStatus: "unfulfilled",
      paymentProvider: "stripe",
      providerPaymentId: null,
      stripePaymentIntentId: null,
      paidAt: PAID_AT,
      cancelledAt: null,
      cancelReason: null,
    });
    expect(order.taxesIncluded).toBe(true);
    expect(order.isTest).toBe(false);
    expect(order.createdAt).toBeInstanceOf(Date);
  });

  it("keeps addresses, shipping and discounts as given", async () => {
    const { database } = handle;
    const discounts = [
      { code: "SUMMER", title: "Summer — 20%", amount: 100, discountId: randomUUID() },
      { code: "", title: "Free delivery", amount: 395, freeShipping: true },
    ];
    const { id } = await addOrder(database, 1001, { discounts, taxesIncluded: false });
    const found = await findOrderRow(database, id);
    expect(found?.shippingAddress).toEqual(ADDRESS);
    expect(found?.shippingLine).toEqual(SHIPPING);
    expect(found?.discounts).toEqual(discounts);
    expect(found?.taxesIncluded).toBe(false);
  });

  it("gives each number and each checkout to one order only", async () => {
    const { database } = handle;
    const { checkoutId } = await addOrder(database, 1001);
    await expect(addOrder(database, 1001)).rejects.toSatisfy((error) => isUniqueViolation(error));
    await expect(addOrder(database, 1002, { checkoutId })).rejects.toSatisfy((error) =>
      isUniqueViolation(error),
    );
    const theirs = await addOrder(database, 1001, { tenantId: OTHER_TENANT });
    expect(theirs.tenantId).toBe(OTHER_TENANT);
  });

  it("finds an order by id within this tenant", async () => {
    const { database } = handle;
    const order = await addOrder(database, 1001);
    const theirs = await addOrder(database, 1002, { tenantId: OTHER_TENANT });
    expect((await findOrderRow(database, order.id))?.number).toBe(1001);
    expect(await findOrderRow(database, randomUUID())).toBeUndefined();
    expect(await findOrderRow(database, theirs.id)).toBeUndefined();
  });

  it("locks an order within this tenant", async () => {
    const { database } = handle;
    const order = await addOrder(database, 1001);
    const theirs = await addOrder(database, 1002, { tenantId: OTHER_TENANT });
    await database.transaction(async (transaction) => {
      expect((await lockOrderRow(transaction, order.id))?.number).toBe(1001);
      expect(await lockOrderRow(transaction, theirs.id)).toBeUndefined();
      expect(await lockOrderRow(transaction, randomUUID())).toBeUndefined();
    });
  });

  it("makes a second refund wait for a locked order", async () => {
    const { database } = handle;
    const { id } = await addOrder(database, 1001);
    const steps = await stepsOfTwoLocks(database, (transaction) => lockOrderRow(transaction, id));
    expect(steps).toEqual(["waited", "first let go", "second has it"]);
  });

  it("finds an order by its checkout or its payment", async () => {
    const { database } = handle;
    const order = await addOrder(database, 1001, { stripePaymentIntentId: "pi_123" });
    await addOrder(database, 1002);
    expect((await findOrderRowByCheckout(database, order.checkoutId))?.id).toBe(order.id);
    expect(await findOrderRowByCheckout(database, randomUUID())).toBeUndefined();
    expect((await findOrderRowByPaymentIntent(database, "pi_123"))?.id).toBe(order.id);
    expect(await findOrderRowByPaymentIntent(database, "PI_123")).toBeUndefined();
    expect(await findOrderRowByPaymentIntent(database, "pi_456")).toBeUndefined();
  });

  it("lists the highest number first, a page at a time, with the total", async () => {
    const { database } = handle;
    await addOrder(database, 1001);
    await addOrder(database, 1003);
    await addOrder(database, 1002);
    await addOrder(database, 1004, { tenantId: OTHER_TENANT });

    const first = await listOrderRows(database, {}, { page: 1, perPage: 2 });
    expect(first.total).toBe(3);
    expect(first.rows.map((row) => row.number)).toEqual([1003, 1002]);
    const second = await listOrderRows(database, {}, { page: 2, perPage: 2 });
    expect(second.total).toBe(3);
    expect(second.rows.map((row) => row.number)).toEqual([1001]);
    const beyond = await listOrderRows(database, {}, { page: 3, perPage: 2 });
    expect(beyond).toEqual({ rows: [], total: 3 });
  });

  it("filters by status, cancellation and customer", async () => {
    const { database } = handle;
    const customer = await addCustomer(database);
    await addOrder(database, 1001);
    await addOrder(database, 1002, { paymentStatus: "refunded" });
    await addOrder(database, 1003, { fulfilmentStatus: "fulfilled" });
    await addOrder(database, 1004, { cancelledAt: PAID_AT, cancelReason: "Changed their mind" });
    await addOrder(database, 1005, { customerId: customer.id });

    expect(await numbersFound({ paymentStatus: "refunded" })).toEqual([1002]);
    expect(await numbersFound({ fulfilmentStatus: "fulfilled" })).toEqual([1003]);
    expect(await numbersFound({ cancelled: true })).toEqual([1004]);
    expect(await numbersFound({ cancelled: false })).toEqual([1005, 1003, 1002, 1001]);
    expect(await numbersFound({ customerId: customer.id })).toEqual([1005]);
    expect(await numbersFound({ paymentStatus: "paid", cancelled: true })).toEqual([1004]);
    const { total } = await listOrderRows(database, { paymentStatus: "refunded" }, firstPage);
    expect(total).toBe(1);
  });

  it("searches emails, names and numbers whatever the case", async () => {
    const { database } = handle;
    await addOrder(database, 1001, { email: "Ada.Lovelace@Example.com", name: "Order A" });
    await addOrder(database, 1002, { email: "grace@example.com", name: "Order B" });
    await addOrder(database, 2001, { email: "joan@example.com", name: "Special" });

    expect(await numbersFound({ search: "LOVELACE" })).toEqual([1001]);
    expect(await numbersFound({ search: "example.COM" })).toEqual([2001, 1002, 1001]);
    expect(await numbersFound({ search: "special" })).toEqual([2001]);
    expect(await numbersFound({ search: "1002" })).toEqual([1002]);
    expect(await numbersFound({ search: "#2001" })).toEqual([2001]);
    expect(await numbersFound({ search: "100" })).toEqual([]);
    expect(await numbersFound({ search: "#" })).toEqual([2001, 1002, 1001]);
    expect(await numbersFound({ search: "nobody" })).toEqual([]);
  });

  it("searches for %, _ and \\ as themselves", async () => {
    const { database } = handle;
    await addOrder(database, 1001, { email: "fifty%off@example.com" });
    await addOrder(database, 1002, { email: "under_score@example.com" });
    await addOrder(database, 1003, { email: "back\\slash@example.com" });
    await addOrder(database, 1004, { email: "underxscore@example.com" });

    expect(await numbersFound({ search: "%" })).toEqual([1001]);
    expect(await numbersFound({ search: "r_s" })).toEqual([1002]);
    expect(await numbersFound({ search: "k\\s" })).toEqual([1003]);
  });

  it("searches names and emails whatever the case, past plain English letters", async () => {
    const { database } = handle;
    await addOrder(database, 1001, { email: "zoë@example.com", name: "Été 😀" });
    await addOrder(database, 1002, { email: "zoe@example.com", name: "Summer" });
    expect(await numbersFound({ search: "zoë" })).toEqual([1001]);
    expect(await numbersFound({ search: "ZOË" })).toEqual([1001]);
    expect(await numbersFound({ search: "😀" })).toEqual([1001]);
  });

  it("searches a number that still fits an order's", async () => {
    await addOrder(handle.database, 2147483647, { name: "Biggest" });
    expect(await numbersFound({ search: "2147483647" })).toEqual([2147483647]);
  });

  it("searches a number too big to be an order's", async () => {
    expect(await numbersFound({ search: "99999999999" })).toEqual([]);
  });

  it("changes an order, clearing what is set to null", async () => {
    const { database } = handle;
    const { id } = await addOrder(database, 1001, {
      cancelledAt: PAID_AT,
      cancelReason: "Mistake",
    });
    await updateOrderRow(database, id, {
      cancelledAt: null,
      cancelReason: null,
      refundedAmount: 200,
      paymentStatus: "partially_refunded",
      discounts: [{ code: "X", title: "X", amount: 1 }],
      isTest: true,
    });
    const found = await findOrderRow(database, id);
    expect(found).toMatchObject({
      cancelledAt: null,
      cancelReason: null,
      refundedAmount: 200,
      paymentStatus: "partially_refunded",
      discounts: [{ code: "X", title: "X", amount: 1 }],
      paidAt: PAID_AT,
    });
    expect(found?.isTest).toBe(true);
  });

  it("marks an order as changed", async () => {
    const { database } = handle;
    const { id } = await addOrder(database, 1001, { updatedAt: LONG_AGO });
    await updateOrderRow(database, id, { refundedAmount: 1 });
    const found = await findOrderRow(database, id);
    expect(found?.updatedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
  });

  it("undoes an order, its lines and its timeline with the transaction", async () => {
    const { database } = handle;
    let orderId = "";
    await expect(
      database.transaction(async (transaction) => {
        const { id } = await addOrder(transaction as Database, 1001);
        orderId = id;
        await insertOrderLines(transaction, [line(id, 0, "First")]);
        await insertOrderEvent(transaction, { orderId: id, kind: "placed", message: "Placed" });
        expect(await findOrderRow(transaction, id)).toBeDefined();
        throw new PlacingFailed();
      }),
    ).rejects.toBeInstanceOf(PlacingFailed);
    expect(await findOrderRow(database, orderId)).toBeUndefined();
    expect(await listOrderLineRows(database, orderId)).toEqual([]);
    expect(await listOrderEventRows(database, orderId)).toEqual([]);
  });

  it("saves lines and lists them in order", async () => {
    const { database } = handle;
    const { id } = await addOrder(database, 1001);
    const { id: otherId } = await addOrder(database, 1002);
    await insertOrderLines(database, []);
    await insertOrderLines(database, [
      { ...line(id, 1, "Second"), sku: "MUG-L", imageId: randomUUID(), weightGrams: 300 },
      line(id, 0, "First"),
      line(otherId, 0, "Another order's"),
    ]);
    const rows = await listOrderLineRows(database, id);
    expect(rows.map((row) => row.productTitle)).toEqual(["First", "Second"]);
    expect(rows[0]).toMatchObject({
      tenantId: "default",
      variantId: null,
      productId: null,
      sku: null,
      imageId: null,
      weightGrams: 0,
      fulfilledQuantity: 0,
      refundedQuantity: 0,
    });
    expect(rows[1]).toMatchObject({ sku: "MUG-L", weightGrams: 300 });
    expect(await listOrderLineRows(database, randomUUID())).toEqual([]);
  });

  it("changes one line's quantities", async () => {
    const { database } = handle;
    const { id } = await addOrder(database, 1001);
    await insertOrderLines(database, [line(id, 0, "First"), line(id, 1, "Second")]);
    const [first] = await listOrderLineRows(database, id);
    if (!first) throw new Error("The line was not saved.");
    await updateOrderLineRow(database, first.id, { fulfilledQuantity: 2, refundedQuantity: 1 });
    const rows = await listOrderLineRows(database, id);
    expect(rows[0]).toMatchObject({ fulfilledQuantity: 2, refundedQuantity: 1 });
    expect(rows[1]).toMatchObject({ fulfilledQuantity: 0, refundedQuantity: 0 });
  });

  it("writes the timeline, with who did it and what happened", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const { id: orderId } = await addOrder(database, 1001);
    const { id: otherId } = await addOrder(database, 1002);
    await insertOrderEvent(database, { orderId, kind: "placed", message: "Order placed" });
    await insertOrderEvent(database, { orderId: otherId, kind: "placed", message: "Not this one" });
    const data = { amount: 500, lines: [{ quantity: 1 }], note: "café", nothing: null };
    await insertOrderEvent(database, {
      orderId,
      kind: "note",
      message: "Left a note",
      data,
      createdBy: user.id,
    });

    const rows = await listOrderEventRows(database, orderId);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.kind === "placed")).toMatchObject({
      tenantId: "default",
      data: {},
      createdBy: null,
    });
    expect(rows.find((row) => row.kind === "note")).toMatchObject({ data, createdBy: user.id });
  });

  it("lists the timeline newest first, the id settling a tie", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database, 1001);
    const events = tableFor(database, orderEventsTable);
    const [lowerId, higherId] = [randomUUID(), randomUUID()].sort();
    const event = { orderId, kind: "note" };
    const older = new Date(PAID_AT.getTime() - 1);
    const newer = new Date(PAID_AT.getTime() + 1);
    await database.insert(events).values([
      { ...event, message: "older", createdAt: older },
      { ...event, id: lowerId, message: "tied, lower id", createdAt: PAID_AT },
      { ...event, id: higherId, message: "tied, higher id", createdAt: PAID_AT },
      { ...event, message: "newer", createdAt: newer },
    ]);
    const rows = await listOrderEventRows(database, orderId);
    expect(rows.map((row) => row.message)).toEqual([
      "newer",
      "tied, higher id",
      "tied, lower id",
      "older",
    ]);
  });

  it("drops lines and the timeline with the order", async () => {
    const { database } = handle;
    const { id } = await addOrder(database, 1001);
    await insertOrderLines(database, [line(id, 0, "First")]);
    await insertOrderEvent(database, { orderId: id, kind: "placed", message: "Placed" });
    await deleteOrder(database, id);
    expect(await listOrderLineRows(database, id)).toEqual([]);
    expect(await listOrderEventRows(database, id)).toEqual([]);
    const lines = tableFor(database, orderLinesTable);
    expect(await database.select().from(lines).where(eq(lines.orderId, id))).toEqual([]);
  });

  it("keeps orders and events when the people behind them go", async () => {
    const { database } = handle;
    const customer = await addCustomer(database);
    const user = await addTestUser(database);
    const { id } = await addOrder(database, 1001, { customerId: customer.id });
    await insertOrderEvent(database, {
      orderId: id,
      kind: "note",
      message: "Note",
      createdBy: user.id,
    });

    const customers = tableFor(database, customersTable);
    await database.delete(customers).where(eq(customers.id, customer.id));
    const users = tableFor(database, usersTable);
    await database.delete(users).where(eq(users.id, user.id));

    expect((await findOrderRow(database, id))?.customerId).toBeNull();
    expect((await listOrderEventRows(database, id))[0]?.createdBy).toBeNull();
  });

  it("counts orders one provider was paid for since a moment", async () => {
    const { database } = handle;
    const just = new Date(PAID_AT.getTime() - 1);
    await addOrder(database, 1001, { paymentProvider: "paypal", paidAt: PAID_AT });
    await addOrder(database, 1002, { paymentProvider: "paypal", paidAt: just });
    await addOrder(database, 1003, { paymentProvider: "mollie", paidAt: PAID_AT });

    expect(await countOrdersPaidSince(database, "paypal", PAID_AT)).toBe(1);
    expect(await countOrdersPaidSince(database, "paypal", just)).toBe(2);
    expect(await countOrdersPaidSince(database, "mollie", just)).toBe(1);
    expect(await countOrdersPaidSince(database, "stripe", just)).toBe(0);
  });

  it("counts the real orders still to be sent", async () => {
    const { database } = handle;
    expect(await countUnfulfilledOrders(database)).toBe(0);
    await addOrder(database, 1001);
    await addOrder(database, 1002, { fulfilmentStatus: "partially_fulfilled" });
    await addOrder(database, 1003, { paymentStatus: "partially_refunded" });
    await addOrder(database, 1004, { fulfilmentStatus: "fulfilled" });
    await addOrder(database, 1005, { paymentStatus: "refunded" });
    await addOrder(database, 1006, { cancelledAt: PAID_AT });
    await addOrder(database, 1007, { isTest: true });
    await addOrder(database, 1008, { tenantId: OTHER_TENANT });
    expect(await countUnfulfilledOrders(database)).toBe(3);
  });
});
