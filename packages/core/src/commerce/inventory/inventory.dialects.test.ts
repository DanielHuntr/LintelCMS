import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database, Transaction } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { insertCheckout } from "../checkouts/checkouts.repository.js";
import { checkoutsTable } from "../checkouts/checkouts.table.js";
import { insertProduct, insertVariant } from "../products/products.repository.js";
import { variantsTable } from "../products/products.table.js";
import {
  changeOnHand,
  deleteLocationRow,
  finishCheckoutReservations,
  insertLocation,
  insertReservations,
  listLevelRows,
  listLocationRows,
  lockLevelRows,
  lockVariantRows,
  releaseExpiredReservationRows,
  sumHeldQuantities,
  updateLocationRow,
  upsertLevel,
} from "./inventory.repository.js";
import { inventoryLevelsTable, inventoryReservationsTable } from "./inventory.table.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const NOW = new Date("2026-06-01T12:00:00.123Z");
const EARLIER = new Date("2026-06-01T11:59:00.123Z");
const LATER = new Date("2026-06-01T12:01:00.123Z");
const LONG_AGO = new Date("2000-01-01T00:00:00.000Z");

async function addVariant(database: Database, values: { inventoryTracked?: boolean } = {}) {
  const suffix = randomUUID();
  const product = await insertProduct(database, { title: "Mug", handle: `mug-${suffix}` });
  return insertVariant(database, { productId: product.id, title: "Large", ...values });
}

function addLocation(database: Database, name = "Warehouse", position = 0) {
  return insertLocation(database, { tenantId: TENANT, name, position });
}

function addCheckout(database: Database) {
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
    expiresAt: LATER,
  });
}

function reservationsOf(database: Database, checkoutId: string) {
  const reservations = tableFor(database, inventoryReservationsTable);
  return database.select().from(reservations).where(eq(reservations.checkoutId, checkoutId));
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

describeOnEveryDatabase("Inventory", (handle) => {
  it("saves a location with the table's defaults", async () => {
    const { database } = handle;
    const location = await insertLocation(database, { tenantId: TENANT, name: "Shop" });
    expect(location).toMatchObject({ tenantId: TENANT, name: "Shop", position: 0 });
    expect(location.isActive).toBe(true);
    expect(location.createdAt).toBeInstanceOf(Date);
  });

  it("lists a tenant's locations by position, then by age", async () => {
    const { database } = handle;
    await insertLocation(database, {
      tenantId: TENANT,
      name: "Second, newer",
      position: 1,
      createdAt: LATER,
    });
    await insertLocation(database, {
      tenantId: TENANT,
      name: "Second, older",
      position: 1,
      createdAt: EARLIER,
    });
    await insertLocation(database, { tenantId: TENANT, name: "First", position: 0 });
    await insertLocation(database, { tenantId: OTHER_TENANT, name: "Theirs", position: 0 });
    const rows = await listLocationRows(database, TENANT);
    expect(rows.map((row) => row.name)).toEqual(["First", "Second, older", "Second, newer"]);
    expect((await listLocationRows(database, OTHER_TENANT)).map((row) => row.name)).toEqual([
      "Theirs",
    ]);
  });

  it("changes a location and says whether it found one", async () => {
    const { database } = handle;
    const { id } = await addLocation(database);
    const changes = { name: "Depot", isActive: false, position: 3 };
    expect(await updateLocationRow(database, TENANT, id, changes)).toBe(true);
    const [row] = await listLocationRows(database, TENANT);
    expect(row).toMatchObject({ name: "Depot", position: 3 });
    expect(row?.isActive).toBe(false);

    // The same values again still found the row.
    expect(await updateLocationRow(database, TENANT, id, changes)).toBe(true);
    expect(await updateLocationRow(database, TENANT, randomUUID(), changes)).toBe(false);
    expect(await updateLocationRow(database, OTHER_TENANT, id, { name: "Stolen" })).toBe(false);
    expect((await listLocationRows(database, TENANT))[0]?.name).toBe("Depot");
  });

  it("deletes a location with its stock levels, within one tenant", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const location = await addLocation(database);
    const kept = await addLocation(database, "Kept");
    const level = { tenantId: TENANT, variantId: variant.id, onHand: 4 };
    await upsertLevel(database, { ...level, locationId: location.id });
    await upsertLevel(database, { ...level, locationId: kept.id });

    expect(await deleteLocationRow(database, OTHER_TENANT, location.id)).toBe(false);
    expect(await listLevelRows(database, [variant.id])).toHaveLength(2);

    expect(await deleteLocationRow(database, TENANT, location.id)).toBe(true);
    expect(await deleteLocationRow(database, TENANT, location.id)).toBe(false);
    const levels = await listLevelRows(database, [variant.id]);
    expect(levels.map((row) => row.locationId)).toEqual([kept.id]);
  });

  it("saves a stock level once for each variant and location", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const other = await addVariant(database);
    const location = await addLocation(database);
    const second = await addLocation(database, "Second");
    const level = { tenantId: TENANT, variantId: variant.id, locationId: location.id };

    await upsertLevel(database, { ...level, onHand: 5 });
    await upsertLevel(database, { ...level, onHand: 9 });
    await upsertLevel(database, { ...level, locationId: second.id, onHand: 1 });
    await upsertLevel(database, { ...level, variantId: other.id, onHand: 2 });

    const rows = await listLevelRows(database, [variant.id]);
    expect(rows.map((row) => row.onHand).sort()).toEqual([1, 9]);
    expect(await listLevelRows(database, [variant.id, other.id])).toHaveLength(3);
    expect(await listLevelRows(database, [randomUUID()])).toEqual([]);
    expect(await listLevelRows(database, [])).toEqual([]);
  });

  it("drops a variant's levels and reservations with it", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const location = await addLocation(database);
    const checkout = await addCheckout(database);
    await upsertLevel(database, {
      tenantId: TENANT,
      variantId: variant.id,
      locationId: location.id,
      onHand: 1,
    });
    await insertReservations(database, [
      { variantId: variant.id, checkoutId: checkout.id, quantity: 1, expiresAt: LATER },
    ]);
    const variants = tableFor(database, variantsTable);
    await database.delete(variants).where(eq(variants.id, variant.id));
    expect(await listLevelRows(database, [variant.id])).toEqual([]);
    expect(await reservationsOf(database, checkout.id)).toEqual([]);
  });

  it("locks levels at active locations, in variant then location order", async () => {
    const { database } = handle;
    const first = await addVariant(database);
    const second = await addVariant(database);
    const [lowerId, higherId] = [first.id, second.id].sort();
    if (!lowerId || !higherId) throw new Error("Two variants were expected.");

    const near = await addLocation(database, "Near", 0);
    const far = await addLocation(database, "Far", 1);
    const closed = await addLocation(database, "Closed", 2);
    await updateLocationRow(database, TENANT, closed.id, { isActive: false });

    const add = (variantId: string, locationId: string, onHand: number) =>
      upsertLevel(database, { tenantId: TENANT, variantId, locationId, onHand });
    await add(higherId, far.id, 4);
    await add(higherId, near.id, 3);
    await add(lowerId, closed.id, 9);
    await add(lowerId, far.id, 2);
    await add(lowerId, near.id, 1);

    await database.transaction(async (transaction) => {
      const rows = await lockLevelRows(transaction, [higherId, lowerId]);
      expect(rows.map((row) => row.onHand)).toEqual([1, 2, 3, 4]);
      expect(rows[0]).toMatchObject({
        tenantId: TENANT,
        variantId: lowerId,
        locationId: near.id,
      });
      expect(rows[0]?.createdAt).toBeInstanceOf(Date);
      expect(await lockLevelRows(transaction, [])).toEqual([]);
    });
  });

  it("makes a second checkout wait for locked levels", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const location = await addLocation(database);
    await upsertLevel(database, {
      tenantId: TENANT,
      variantId: variant.id,
      locationId: location.id,
      onHand: 1,
    });
    const steps = await stepsOfTwoLocks(database, (transaction) =>
      lockLevelRows(transaction, [variant.id]),
    );
    expect(steps).toEqual(["waited", "first let go", "second has it"]);
  });

  it("locks variants in id order and reads whether they are tracked", async () => {
    const { database } = handle;
    const tracked = await addVariant(database);
    const untracked = await addVariant(database, { inventoryTracked: false });
    await database.transaction(async (transaction) => {
      const rows = await lockVariantRows(transaction, [tracked.id, untracked.id, randomUUID()]);
      expect(rows.map((row) => row.id)).toEqual([tracked.id, untracked.id].sort());
      expect(rows.find((row) => row.id === tracked.id)).toEqual({
        id: tracked.id,
        title: "Large",
        inventoryTracked: true,
      });
      expect(rows.find((row) => row.id === untracked.id)?.inventoryTracked).toBe(false);
      expect(await lockVariantRows(transaction, [])).toEqual([]);
    });
  });

  it("makes a second checkout wait for a locked variant", async () => {
    const { database } = handle;
    const { id } = await addVariant(database);
    const steps = await stepsOfTwoLocks(database, (transaction) =>
      lockVariantRows(transaction, [id]),
    );
    expect(steps).toEqual(["waited", "first let go", "second has it"]);
  });

  it("adds to and takes from one stock level", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const location = await addLocation(database);
    const other = await addLocation(database, "Other");
    const level = { tenantId: TENANT, variantId: variant.id, onHand: 5 };
    await upsertLevel(database, { ...level, locationId: location.id });
    await upsertLevel(database, { ...level, locationId: other.id });
    const rows = await listLevelRows(database, [variant.id]);
    const target = rows.find((row) => row.locationId === location.id);
    if (!target) throw new Error("The level was not saved.");

    await changeOnHand(database, target.id, 3);
    await changeOnHand(database, target.id, -10);

    const after = await listLevelRows(database, [variant.id]);
    expect(after.find((row) => row.id === target.id)?.onHand).toBe(-2);
    expect(after.find((row) => row.locationId === other.id)?.onHand).toBe(5);
  });

  it("marks a stock level as changed, however it changes", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const location = await addLocation(database);
    const key = { tenantId: TENANT, variantId: variant.id, locationId: location.id };
    await upsertLevel(database, { ...key, onHand: 1 });
    const levels = tableFor(database, inventoryLevelsTable);
    const readLevel = async () => (await listLevelRows(database, [variant.id]))[0];
    const backdate = () =>
      database.update(levels).set({ updatedAt: LONG_AGO }).where(eq(levels.variantId, variant.id));

    await backdate();
    await upsertLevel(database, { ...key, onHand: 2 });
    expect((await readLevel())?.updatedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());

    await backdate();
    await changeOnHand(database, (await readLevel())?.id ?? "", 1);
    expect((await readLevel())?.updatedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
  });

  it("saves reservations with the table's defaults", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const checkout = await addCheckout(database);
    await insertReservations(database, []);
    await insertReservations(database, [
      { variantId: variant.id, checkoutId: checkout.id, quantity: 2, expiresAt: LATER },
      { variantId: variant.id, checkoutId: checkout.id, quantity: 3, expiresAt: LATER },
    ]);
    const rows = await reservationsOf(database, checkout.id);
    expect(rows.map((row) => row.quantity).sort()).toEqual([2, 3]);
    expect(rows[0]).toMatchObject({ tenantId: TENANT, status: "active", expiresAt: LATER });
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
  });

  it("refuses a reservation for a checkout that doesn't exist", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    await expect(
      insertReservations(database, [
        { variantId: variant.id, checkoutId: randomUUID(), quantity: 1, expiresAt: LATER },
      ]),
    ).rejects.toThrow();
  });

  it("drops a checkout's reservations with it", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const checkout = await addCheckout(database);
    await insertReservations(database, [
      { variantId: variant.id, checkoutId: checkout.id, quantity: 1, expiresAt: LATER },
    ]);
    const checkouts = tableFor(database, checkoutsTable);
    await database.delete(checkouts).where(eq(checkouts.id, checkout.id));
    expect(await reservationsOf(database, checkout.id)).toEqual([]);
  });

  it("adds up what active reservations still hold, by variant", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const other = await addVariant(database);
    const unreserved = await addVariant(database);
    const checkout = await addCheckout(database);
    const second = await addCheckout(database);
    const hold = { variantId: variant.id, checkoutId: checkout.id };
    await insertReservations(database, [
      { ...hold, quantity: 2, expiresAt: LATER },
      { ...hold, quantity: 3, expiresAt: LATER, checkoutId: second.id },
      { ...hold, quantity: 100, expiresAt: NOW },
      { ...hold, quantity: 100, expiresAt: EARLIER },
      { ...hold, quantity: 100, expiresAt: LATER, status: "committed" },
      { ...hold, quantity: 100, expiresAt: LATER, status: "released" },
      { ...hold, quantity: 7, expiresAt: LATER, variantId: other.id },
    ]);

    const ids = [variant.id, other.id, unreserved.id];
    expect(await sumHeldQuantities(database, ids, NOW)).toEqual(
      new Map([
        [variant.id, 5],
        [other.id, 7],
      ]),
    );
    expect(await sumHeldQuantities(database, [variant.id], NOW, [checkout.id])).toEqual(
      new Map([[variant.id, 3]]),
    );
    expect(await sumHeldQuantities(database, [variant.id], NOW, [checkout.id, second.id])).toEqual(
      new Map(),
    );
    expect(await sumHeldQuantities(database, [], NOW)).toEqual(new Map());
  });

  it("finishes a checkout's active reservations and counts them", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const checkout = await addCheckout(database);
    const other = await addCheckout(database);
    const hold = { variantId: variant.id, quantity: 1, expiresAt: LATER };
    await insertReservations(database, [
      { ...hold, checkoutId: checkout.id },
      { ...hold, checkoutId: checkout.id },
      { ...hold, checkoutId: checkout.id, status: "released" },
      { ...hold, checkoutId: other.id },
    ]);

    expect(await finishCheckoutReservations(database, checkout.id, "committed")).toBe(2);
    expect(await finishCheckoutReservations(database, checkout.id, "released")).toBe(0);
    const statuses = (await reservationsOf(database, checkout.id)).map((row) => row.status);
    expect(statuses.sort()).toEqual(["committed", "committed", "released"]);

    expect(await finishCheckoutReservations(database, other.id, "released")).toBe(1);
    expect((await reservationsOf(database, other.id))[0]?.status).toBe("released");
  });

  it("releases reservations whose time is up, naming each checkout once", async () => {
    const { database } = handle;
    const variant = await addVariant(database);
    const lapsed = await addCheckout(database);
    const justLapsed = await addCheckout(database);
    const running = await addCheckout(database);
    const paid = await addCheckout(database);
    const hold = { variantId: variant.id, quantity: 1 };
    await insertReservations(database, [
      { ...hold, checkoutId: lapsed.id, expiresAt: EARLIER },
      { ...hold, checkoutId: lapsed.id, expiresAt: EARLIER },
      { ...hold, checkoutId: justLapsed.id, expiresAt: NOW },
      { ...hold, checkoutId: running.id, expiresAt: LATER },
      { ...hold, checkoutId: paid.id, expiresAt: EARLIER, status: "committed" },
    ]);

    const released = await releaseExpiredReservationRows(database, NOW);
    expect([...released].sort()).toEqual([lapsed.id, justLapsed.id].sort());
    expect((await reservationsOf(database, lapsed.id)).map((row) => row.status)).toEqual([
      "released",
      "released",
    ]);
    expect((await reservationsOf(database, running.id))[0]?.status).toBe("active");
    expect((await reservationsOf(database, paid.id))[0]?.status).toBe("committed");
    expect(await releaseExpiredReservationRows(database, NOW)).toEqual([]);
  });
});
