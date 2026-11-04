import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { isUniqueViolation } from "../../database/database-errors.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { addTestUser, describeOnEveryDatabase } from "../../testing/every-database.js";
import { usersTable } from "../../users/users.table.js";
import { insertOrder } from "./orders.repository.js";
import { fulfilmentsTable, type NewOrderRow, ordersTable } from "./orders.table.js";
import {
  findRefundRow,
  findRefundRowByProviderId,
  findRefundRowByStripeId,
  insertFulfilment,
  insertRefund,
  listFulfilmentRows,
  listOrdersWithPendingRefunds,
  listRefundRows,
  sumRefunds,
  updateRefundRow,
} from "./refunds-and-fulfilments.repository.js";

const EARLIER = new Date("2026-06-01T11:59:00.123Z");
const NOW = new Date("2026-06-01T12:00:00.123Z");
const LATER = new Date("2026-06-01T12:01:00.123Z");

let nextNumber = 1000;

function addOrder(database: Database, values: Partial<NewOrderRow> = {}) {
  nextNumber += 1;
  return insertOrder(database, {
    number: nextNumber,
    name: `#${nextNumber}`,
    checkoutId: randomUUID(),
    email: "ada@example.com",
    currency: "GBP",
    shippingAddress: {} as never,
    shippingLine: {} as never,
    subtotalAmount: 1000,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount: 1000,
    taxesIncluded: true,
    paidAt: NOW,
    ...values,
  });
}

function refund(orderId: string, amount = 100) {
  return { orderId, amount, currency: "GBP" };
}

function deleteOrder(database: Database, orderId: string) {
  const orders = tableFor(database, ordersTable);
  return database.delete(orders).where(eq(orders.id, orderId));
}

function deleteUser(database: Database, userId: string) {
  const users = tableFor(database, usersTable);
  return database.delete(users).where(eq(users.id, userId));
}

describeOnEveryDatabase("Refunds and fulfilments", (handle) => {
  it("saves a refund with the table's defaults", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    const saved = await insertRefund(database, refund(orderId, 250));
    expect(saved).toMatchObject({
      tenantId: "default",
      orderId,
      amount: 250,
      currency: "GBP",
      reason: "",
      status: "pending",
      lines: [],
      stripeRefundId: null,
      providerRefundId: null,
      createdBy: null,
    });
    expect(saved.restock).toBe(false);
    expect(saved.notifyCustomer).toBe(true);
    expect(saved.createdAt).toBeInstanceOf(Date);
  });

  it("finds a refund as it was saved, by any of its ids", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const { id: orderId } = await addOrder(database);
    const lines = [{ orderLineId: randomUUID(), quantity: 2 }];
    const { id } = await insertRefund(database, {
      ...refund(orderId),
      reason: "Arrived broken — sorry",
      status: "succeeded",
      lines,
      restock: true,
      notifyCustomer: false,
      stripeRefundId: "re_123",
      providerRefundId: "pp_123",
      createdBy: user.id,
    });

    const found = await findRefundRow(database, id);
    expect(found).toMatchObject({
      reason: "Arrived broken — sorry",
      status: "succeeded",
      lines,
      createdBy: user.id,
    });
    expect(found?.restock).toBe(true);
    expect(found?.notifyCustomer).toBe(false);
    expect((await findRefundRowByStripeId(database, "re_123"))?.id).toBe(id);
    expect((await findRefundRowByProviderId(database, "pp_123"))?.id).toBe(id);

    expect(await findRefundRow(database, randomUUID())).toBeUndefined();
    expect(await findRefundRowByStripeId(database, "RE_123")).toBeUndefined();
    expect(await findRefundRowByStripeId(database, "pp_123")).toBeUndefined();
    expect(await findRefundRowByProviderId(database, "PP_123")).toBeUndefined();
    expect(await findRefundRowByProviderId(database, "re_123")).toBeUndefined();
  });

  it("keeps Stripe's refund ids unique, while any number can have none", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    await insertRefund(database, refund(orderId));
    await insertRefund(database, refund(orderId));
    await insertRefund(database, { ...refund(orderId), stripeRefundId: "re_123" });
    await expect(
      insertRefund(database, { ...refund(orderId), stripeRefundId: "re_123" }),
    ).rejects.toSatisfy((error) => isUniqueViolation(error));
    expect(await listRefundRows(database, orderId)).toHaveLength(3);
  });

  it("refuses a refund for an order that doesn't exist", async () => {
    const { database } = handle;
    await expect(insertRefund(database, refund(randomUUID()))).rejects.toThrow();
  });

  it("changes one refund", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    const { id } = await insertRefund(database, refund(orderId));
    const other = await insertRefund(database, refund(orderId));
    await updateRefundRow(database, id, { status: "succeeded", stripeRefundId: "re_1" });
    await updateRefundRow(database, id, { providerRefundId: "pp_1" });
    expect(await findRefundRow(database, id)).toMatchObject({
      status: "succeeded",
      stripeRefundId: "re_1",
      providerRefundId: "pp_1",
    });
    expect((await findRefundRow(database, other.id))?.status).toBe("pending");
  });

  it("lists an order's refunds, oldest first", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    const { id: otherId } = await addOrder(database);
    await insertRefund(database, { ...refund(orderId, 3), createdAt: LATER });
    await insertRefund(database, { ...refund(orderId, 1), createdAt: EARLIER });
    await insertRefund(database, { ...refund(orderId, 2), createdAt: NOW });
    await insertRefund(database, refund(otherId, 4));
    const rows = await listRefundRows(database, orderId);
    expect(rows.map((row) => row.amount)).toEqual([1, 2, 3]);
    expect(rows[0]?.createdAt).toEqual(EARLIER);
    expect(await listRefundRows(database, randomUUID())).toEqual([]);
  });

  it("adds up what is refunded and what is on its way", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    const { id: otherId } = await addOrder(database);
    expect(await sumRefunds(database, orderId)).toEqual({ succeeded: 0, pending: 0 });

    await insertRefund(database, { ...refund(orderId, 100), status: "succeeded" });
    await insertRefund(database, { ...refund(orderId, 50), status: "succeeded" });
    await insertRefund(database, { ...refund(orderId, 25), status: "pending" });
    await insertRefund(database, { ...refund(orderId, 999), status: "failed" });
    await insertRefund(database, { ...refund(otherId, 999), status: "succeeded" });
    expect(await sumRefunds(database, orderId)).toEqual({ succeeded: 150, pending: 25 });
  });

  it("finds pending refunds of one provider's orders", async () => {
    const { database } = handle;
    const paypal = await addOrder(database, {
      paymentProvider: "paypal",
      providerPaymentId: "capture-1",
    });
    const noPaymentId = await addOrder(database, { paymentProvider: "paypal" });
    const mollie = await addOrder(database, {
      paymentProvider: "mollie",
      providerPaymentId: "tr_1",
    });
    await insertRefund(database, { ...refund(paypal.id), providerRefundId: "refund-1" });
    await insertRefund(database, {
      ...refund(paypal.id),
      providerRefundId: "refund-2",
      status: "succeeded",
    });
    await insertRefund(database, refund(noPaymentId.id));
    await insertRefund(database, { ...refund(mollie.id), providerRefundId: "refund-3" });

    const rows = await listOrdersWithPendingRefunds(database, "paypal");
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ providerPaymentId: "capture-1", providerRefundId: "refund-1" });
    expect(rows).toContainEqual({ providerPaymentId: null, providerRefundId: null });
    expect(await listOrdersWithPendingRefunds(database, "mollie")).toEqual([
      { providerPaymentId: "tr_1", providerRefundId: "refund-3" },
    ]);
    expect(await listOrdersWithPendingRefunds(database, "stripe")).toEqual([]);
  });

  it("saves a fulfilment, with empty tracking unless told", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const { id: orderId } = await addOrder(database);
    const lines = [{ orderLineId: randomUUID(), quantity: 1 }];
    const plain = await insertFulfilment(database, { orderId, lines });
    expect(plain).toMatchObject({
      tenantId: "default",
      lines,
      trackingCompany: "",
      trackingNumber: "",
      trackingUrl: "",
      createdBy: null,
    });
    expect(plain.createdAt).toBeInstanceOf(Date);

    const tracked = await insertFulfilment(database, {
      orderId,
      lines: [],
      trackingCompany: "Royal Mail",
      trackingNumber: "AB123",
      trackingUrl: "https://example.com/track?id=AB123&lang=en",
      createdBy: user.id,
    });
    expect(tracked).toMatchObject({
      lines: [],
      trackingCompany: "Royal Mail",
      trackingNumber: "AB123",
      trackingUrl: "https://example.com/track?id=AB123&lang=en",
      createdBy: user.id,
    });
  });

  it("lists an order's fulfilments, oldest first, within this tenant", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    const { id: otherId } = await addOrder(database);
    const parcel = (trackingNumber: string, createdAt: Date) => ({
      orderId,
      lines: [],
      trackingNumber,
      createdAt,
    });
    await insertFulfilment(database, parcel("third", LATER));
    await insertFulfilment(database, parcel("first", EARLIER));
    await insertFulfilment(database, parcel("second", NOW));
    await insertFulfilment(database, { ...parcel("elsewhere", NOW), orderId: otherId });
    await database
      .insert(tableFor(database, fulfilmentsTable))
      .values({ ...parcel("theirs", NOW), tenantId: "other" });

    const rows = await listFulfilmentRows(database, orderId);
    expect(rows.map((row) => row.trackingNumber)).toEqual(["first", "second", "third"]);
    expect(await listFulfilmentRows(database, randomUUID())).toEqual([]);
  });

  it("drops refunds and fulfilments with the order", async () => {
    const { database } = handle;
    const { id: orderId } = await addOrder(database);
    const { id } = await insertRefund(database, refund(orderId));
    await insertFulfilment(database, { orderId, lines: [] });
    await deleteOrder(database, orderId);
    expect(await findRefundRow(database, id)).toBeUndefined();
    expect(await listRefundRows(database, orderId)).toEqual([]);
    expect(await listFulfilmentRows(database, orderId)).toEqual([]);
  });

  it("keeps refunds and fulfilments when whoever made them goes", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const { id: orderId } = await addOrder(database);
    const { id } = await insertRefund(database, { ...refund(orderId), createdBy: user.id });
    await insertFulfilment(database, { orderId, lines: [], createdBy: user.id });
    await deleteUser(database, user.id);
    expect((await findRefundRow(database, id))?.createdBy).toBeNull();
    expect((await listFulfilmentRows(database, orderId))[0]?.createdBy).toBeNull();
  });
});
