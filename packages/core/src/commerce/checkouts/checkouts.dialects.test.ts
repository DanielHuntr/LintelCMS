import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  expireOpenCheckoutRow,
  findCheckoutRow,
  findCheckoutRowBySession,
  insertCheckout,
  listExpiredOpenCheckoutRows,
  listOpenCheckoutIdsForCart,
  listOpenCheckoutRowsForCart,
  listOpenCheckoutRowsForProvider,
  lockCheckoutRow,
  updateCheckoutRow,
} from "./checkouts.repository.js";

const TENANT = "default";
const cartId = randomUUID();
const expiresAt = new Date("2026-11-04T10:00:00.000Z");
const later = new Date("2026-11-04T11:00:00.000Z");

function addCheckout(database: Database) {
  return insertCheckout(database, {
    cartId,
    marketId: randomUUID(),
    email: "ada@example.com",
    shippingAddress: { city: "Leeds" } as never,
    currency: "GBP",
    lines: [{ quantity: 1 }] as never,
    shippingLine: {} as never,
    subtotalAmount: 100,
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    totalAmount: 100,
    taxesIncluded: true,
    taxCalculation: "manual",
    expiresAt,
  });
}

describeOnEveryDatabase("Checkouts", (handle) => {
  it("saves a checkout and finds it each way", async () => {
    const { database } = handle;
    const checkout = await addCheckout(database);
    expect(checkout.lines).toEqual([{ quantity: 1 }]);
    expect((await findCheckoutRow(database, TENANT, checkout.id))?.status).toBe("open");
    await updateCheckoutRow(database, checkout.id, { stripeCheckoutSessionId: "cs_1" });
    expect((await findCheckoutRowBySession(database, "cs_1"))?.id).toBe(checkout.id);
    expect(await listOpenCheckoutRowsForCart(database, cartId)).toHaveLength(1);
    expect(await listOpenCheckoutIdsForCart(database, cartId)).toEqual([checkout.id]);
    expect(await listOpenCheckoutRowsForProvider(database, "stripe")).toHaveLength(1);
  });

  it("locks a checkout inside a transaction", async () => {
    const { database } = handle;
    const checkout = await addCheckout(database);
    await database.transaction(async (transaction) => {
      const locked = await lockCheckoutRow(transaction, TENANT, checkout.id);
      expect(locked?.id).toBe(checkout.id);
    });
  });

  it("expires an open checkout once", async () => {
    const { database } = handle;
    const checkout = await addCheckout(database);
    expect(await listExpiredOpenCheckoutRows(database, later)).toHaveLength(1);
    expect(await expireOpenCheckoutRow(database, checkout.id)).toBe(true);
    expect(await expireOpenCheckoutRow(database, checkout.id)).toBe(false);
    expect(await listExpiredOpenCheckoutRows(database, later)).toEqual([]);
  });
});
