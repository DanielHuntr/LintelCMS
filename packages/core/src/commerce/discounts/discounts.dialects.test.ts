import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database, Transaction } from "../../database/client.js";
import { isUniqueViolation } from "../../database/database-errors.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { insertCheckout } from "../checkouts/checkouts.repository.js";
import type { NewCheckoutRow } from "../checkouts/checkouts.table.js";
import {
  insertProductCollection,
  replaceCollectionItems,
} from "../product-collections/product-collections.repository.js";
import {
  insertProduct,
  insertVariant,
  replaceVariantPrices,
} from "../products/products.repository.js";
import {
  countDiscountUsage,
  countUsedRedemptions,
  deleteDiscountRow,
  findCollectionsOfProducts,
  findDiscountRow,
  findDiscountRowByCode,
  insertDiscount,
  insertRedemption,
  listDiscountRows,
  listDiscountRowsByCodes,
  listLiveAutomaticDiscountRows,
  lockDiscountRows,
  markRedemptionsUsed,
  releaseRedemptions,
  updateDiscountRow,
} from "./discounts.repository.js";
import { discountRedemptionsTable, type NewDiscountRow } from "./discounts.table.js";

const OTHER_TENANT = "other";
const NOW = new Date("2026-06-01T12:00:00.123Z");
const EARLIER = new Date("2026-06-01T11:59:00.123Z");
const LATER = new Date("2026-06-01T12:01:00.123Z");
const LONG_AGO = new Date("2000-01-01T00:00:00.000Z");
const ADA = "ada@example.com";
const GRACE = "grace@example.com";

function addDiscount(database: Database, values: Partial<NewDiscountRow> = {}) {
  return insertDiscount(database, {
    title: "Summer",
    method: "code",
    code: "SUMMER",
    kind: "percentage",
    percentOff: 20,
    ...values,
  });
}

function addAutomaticDiscount(database: Database, values: Partial<NewDiscountRow> = {}) {
  return addDiscount(database, {
    title: "Automatic",
    method: "automatic",
    code: null,
    startsAt: EARLIER,
    ...values,
  });
}

function addCheckout(database: Database, values: Partial<NewCheckoutRow> = {}) {
  return insertCheckout(database, {
    marketId: randomUUID(),
    email: ADA,
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
    ...values,
  });
}

function redemptionsOf(database: Database, discountId: string) {
  const redemptions = tableFor(database, discountRedemptionsTable);
  return database.select().from(redemptions).where(eq(redemptions.discountId, discountId));
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

describeOnEveryDatabase("Discounts", (handle) => {
  it("saves a discount with the table's defaults", async () => {
    const { database } = handle;
    const discount = await addDiscount(database);
    expect(discount).toMatchObject({
      tenantId: "default",
      code: "SUMMER",
      percentOff: 20,
      amounts: {},
      buyQuantity: 0,
      getQuantity: 0,
      scope: "order",
      productIds: [],
      collectionIds: [],
      minimumSpend: {},
      minimumQuantity: null,
      endsAt: null,
      usageLimit: null,
      perCustomerLimit: null,
    });
    expect(discount.combinesWithOthers).toBe(true);
    expect(discount.enabled).toBe(true);
    expect(discount.startsAt).toBeInstanceOf(Date);
    expect(discount.createdAt).toBeInstanceOf(Date);
  });

  it("keeps lists, amounts and times exactly as they were given", async () => {
    const { database } = handle;
    const productId = randomUUID();
    const { id } = await addDiscount(database, {
      kind: "fixed_amount",
      scope: "products",
      amounts: { GBP: 1000, EUR: 1200 },
      minimumSpend: { GBP: 5000 },
      productIds: [productId],
      collectionIds: [],
      minimumQuantity: 2,
      usageLimit: 10,
      perCustomerLimit: 1,
      startsAt: EARLIER,
      endsAt: LATER,
      combinesWithOthers: false,
      enabled: false,
    });
    const found = await findDiscountRow(database, id);
    expect(found).toMatchObject({
      kind: "fixed_amount",
      scope: "products",
      amounts: { GBP: 1000, EUR: 1200 },
      minimumSpend: { GBP: 5000 },
      productIds: [productId],
      minimumQuantity: 2,
      usageLimit: 10,
      perCustomerLimit: 1,
      startsAt: EARLIER,
      endsAt: LATER,
    });
    expect(found?.combinesWithOthers).toBe(false);
    expect(found?.enabled).toBe(false);
  });

  it("refuses a code already taken, but only within one tenant", async () => {
    const { database } = handle;
    await addDiscount(database);
    await expect(addDiscount(database)).rejects.toSatisfy((error) => isUniqueViolation(error));
    await expect(addDiscount(database, { tenantId: OTHER_TENANT })).resolves.toMatchObject({
      tenantId: OTHER_TENANT,
    });
  });

  it("lets any number of automatic discounts go without a code", async () => {
    const { database } = handle;
    await addAutomaticDiscount(database);
    await addAutomaticDiscount(database);
    expect(await listDiscountRows(database)).toHaveLength(2);
  });

  it("lists the newest first, the id settling a tie, and only this tenant's", async () => {
    const { database } = handle;
    const [firstId, secondId] = [randomUUID(), randomUUID()].sort();
    await addDiscount(database, { code: "OLD", createdAt: EARLIER });
    await addDiscount(database, { id: secondId, code: "TIE-B", createdAt: NOW });
    await addDiscount(database, { id: firstId, code: "TIE-A", createdAt: NOW });
    await addDiscount(database, { code: "NEW", createdAt: LATER });
    await addDiscount(database, { code: "THEIRS", tenantId: OTHER_TENANT });
    const rows = await listDiscountRows(database);
    expect(rows.map((row) => row.code)).toEqual(["NEW", "TIE-A", "TIE-B", "OLD"]);
  });

  it("finds a discount by id or exact code, within this tenant", async () => {
    const { database } = handle;
    const discount = await addDiscount(database);
    const theirs = await addDiscount(database, { code: "THEIRS", tenantId: OTHER_TENANT });

    expect((await findDiscountRow(database, discount.id))?.title).toBe("Summer");
    expect(await findDiscountRow(database, randomUUID())).toBeUndefined();
    expect(await findDiscountRow(database, theirs.id)).toBeUndefined();

    expect((await findDiscountRowByCode(database, "SUMMER"))?.id).toBe(discount.id);
    expect(await findDiscountRowByCode(database, "summer")).toBeUndefined();
    expect(await findDiscountRowByCode(database, "SUMMER ")).toBeUndefined();
    expect(await findDiscountRowByCode(database, "THEIRS")).toBeUndefined();
  });

  it("finds code discounts by a list of codes", async () => {
    const { database } = handle;
    await addDiscount(database);
    await addDiscount(database, { code: "WINTER" });
    await addDiscount(database, { code: "SPRING" });
    await addAutomaticDiscount(database, { code: "AUTO" });
    await addDiscount(database, { code: "THEIRS", tenantId: OTHER_TENANT });

    const rows = await listDiscountRowsByCodes(database, [
      "SUMMER",
      "WINTER",
      "AUTO",
      "THEIRS",
      "NONE",
    ]);
    expect(rows.map((row) => row.code).sort()).toEqual(["SUMMER", "WINTER"]);
    expect(await listDiscountRowsByCodes(database, [])).toEqual([]);
  });

  it("finds automatic discounts that are on and within their dates", async () => {
    const { database } = handle;
    await addAutomaticDiscount(database, { title: "no end" });
    await addAutomaticDiscount(database, { title: "starts now", startsAt: NOW, endsAt: LATER });
    await addAutomaticDiscount(database, { title: "ends now", endsAt: NOW });
    await addAutomaticDiscount(database, { title: "ended", endsAt: EARLIER });
    await addAutomaticDiscount(database, { title: "not started", startsAt: LATER });
    await addAutomaticDiscount(database, { title: "switched off", enabled: false });
    await addAutomaticDiscount(database, { title: "theirs", tenantId: OTHER_TENANT });
    await addDiscount(database, { title: "a code", startsAt: EARLIER });

    const rows = await listLiveAutomaticDiscountRows(database, NOW);
    expect(rows.map((row) => row.title).sort()).toEqual(["no end", "starts now"]);
  });

  it("changes a discount, clearing what is set to null", async () => {
    const { database } = handle;
    const { id } = await addDiscount(database, {
      endsAt: LATER,
      usageLimit: 5,
      updatedAt: LONG_AGO,
    });
    await updateDiscountRow(database, id, {
      title: "Autumn",
      endsAt: null,
      usageLimit: null,
      enabled: false,
      amounts: { USD: 500 },
    });
    const found = await findDiscountRow(database, id);
    expect(found).toMatchObject({
      title: "Autumn",
      endsAt: null,
      usageLimit: null,
      amounts: { USD: 500 },
      code: "SUMMER",
    });
    expect(found?.enabled).toBe(false);
    expect(found?.updatedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());
  });

  it("leaves another tenant's discount alone", async () => {
    const { database } = handle;
    const { id } = await addDiscount(database, { tenantId: OTHER_TENANT });
    await updateDiscountRow(database, id, { title: "Changed" });
    expect(await deleteDiscountRow(database, id)).toBe(false);
    const [locked] = await lockDiscountRows(database, [id]);
    expect(locked?.title).toBe("Summer");
  });

  it("deletes a discount and its uses, and says whether it did", async () => {
    const { database } = handle;
    const { id } = await addDiscount(database);
    await insertRedemption(database, { discountId: id, checkoutId: randomUUID(), email: ADA });
    expect(await deleteDiscountRow(database, id)).toBe(true);
    expect(await deleteDiscountRow(database, id)).toBe(false);
    expect(await findDiscountRow(database, id)).toBeUndefined();
    expect(await redemptionsOf(database, id)).toEqual([]);
  });

  it("locks discounts in id order", async () => {
    const { database } = handle;
    const first = await addDiscount(database, { code: "A" });
    const second = await addDiscount(database, { code: "B" });
    await addDiscount(database, { code: "C" });
    await database.transaction(async (transaction) => {
      const rows = await lockDiscountRows(transaction, [second.id, first.id, randomUUID()]);
      expect(rows.map((row) => row.id)).toEqual([first.id, second.id].sort());
      expect(await lockDiscountRows(transaction, [])).toEqual([]);
    });
  });

  it("makes a second checkout wait for a locked discount", async () => {
    const { database } = handle;
    const { id } = await addDiscount(database);
    const steps = await stepsOfTwoLocks(database, (transaction) =>
      lockDiscountRows(transaction, [id]),
    );
    expect(steps).toEqual(["waited", "first let go", "second has it"]);
  });

  it("counts placed orders and holds still in time, and nothing else", async () => {
    const { database } = handle;
    const { id: discountId } = await addDiscount(database);
    const untouched = await addDiscount(database, { code: "UNUSED" });

    const placed = randomUUID();
    await insertRedemption(database, { discountId, checkoutId: placed, email: ADA });
    await markRedemptionsUsed(database, placed, randomUUID());

    const open = await addCheckout(database);
    await insertRedemption(database, { discountId, checkoutId: open.id, email: GRACE });

    const timedOut = await addCheckout(database, { expiresAt: NOW });
    await insertRedemption(database, { discountId, checkoutId: timedOut.id, email: ADA });

    const finished = await addCheckout(database, { status: "completed" });
    await insertRedemption(database, { discountId, checkoutId: finished.id, email: ADA });

    await insertRedemption(database, { discountId, checkoutId: randomUUID(), email: ADA });

    const abandoned = await addCheckout(database);
    await insertRedemption(database, { discountId, checkoutId: abandoned.id, email: ADA });
    await releaseRedemptions(database, abandoned.id);

    const ids = [discountId, untouched.id];
    const usage = await countDiscountUsage(database, ids, ADA, NOW);
    expect(usage).toEqual(new Map([[discountId, { total: 2, byCustomer: 1 }]]));

    const anonymous = await countDiscountUsage(database, ids, null, NOW);
    expect(anonymous.get(discountId)).toEqual({ total: 2, byCustomer: 0 });

    const otherCase = await countDiscountUsage(database, ids, "ADA@example.com", NOW);
    expect(otherCase.get(discountId)).toEqual({ total: 2, byCustomer: 0 });

    expect(await countDiscountUsage(database, [], ADA, NOW)).toEqual(new Map());
  });

  it("holds one use for each discount and checkout, keeping the first", async () => {
    const { database } = handle;
    const { id: discountId } = await addDiscount(database);
    const checkoutId = randomUUID();
    await insertRedemption(database, { discountId, checkoutId, email: ADA });
    await insertRedemption(database, { discountId, checkoutId, email: GRACE });
    const rows = await redemptionsOf(database, discountId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: "default",
      checkoutId,
      email: ADA,
      status: "held",
      orderId: null,
    });
  });

  it("refuses a use of a discount that doesn't exist", async () => {
    const { database } = handle;
    await expect(
      insertRedemption(database, {
        discountId: randomUUID(),
        checkoutId: randomUUID(),
        email: ADA,
      }),
    ).rejects.toThrow();
  });

  it("turns one checkout's holds into uses", async () => {
    const { database } = handle;
    const { id: discountId } = await addDiscount(database);
    const [checkoutId, otherCheckoutId, orderId] = [randomUUID(), randomUUID(), randomUUID()];
    await insertRedemption(database, { discountId, checkoutId, email: ADA });
    await insertRedemption(database, { discountId, checkoutId: otherCheckoutId, email: ADA });
    await markRedemptionsUsed(database, checkoutId, orderId);

    const rows = await redemptionsOf(database, discountId);
    expect(rows.find((row) => row.checkoutId === checkoutId)).toMatchObject({
      status: "used",
      orderId,
    });
    expect(rows.find((row) => row.checkoutId === otherCheckoutId)).toMatchObject({
      status: "held",
      orderId: null,
    });
  });

  it("releases a checkout's holds, never a use", async () => {
    const { database } = handle;
    const { id: discountId } = await addDiscount(database);
    const { id: otherDiscountId } = await addDiscount(database, { code: "OTHER" });
    const checkoutId = randomUUID();
    await insertRedemption(database, { discountId, checkoutId, email: ADA });
    await insertRedemption(database, { discountId: otherDiscountId, checkoutId, email: ADA });
    await markRedemptionsUsed(database, checkoutId, randomUUID());
    await releaseRedemptions(database, checkoutId);
    expect((await redemptionsOf(database, discountId))[0]?.status).toBe("used");

    const heldCheckoutId = randomUUID();
    await insertRedemption(database, { discountId, checkoutId: heldCheckoutId, email: ADA });
    await releaseRedemptions(database, heldCheckoutId);
    const rows = await redemptionsOf(database, discountId);
    expect(rows.find((row) => row.checkoutId === heldCheckoutId)?.status).toBe("released");
  });

  it("counts how many orders used each discount", async () => {
    const { database } = handle;
    const { id: discountId } = await addDiscount(database);
    const { id: heldOnly } = await addDiscount(database, { code: "HELD" });
    for (const email of [ADA, GRACE]) {
      const checkoutId = randomUUID();
      await insertRedemption(database, { discountId, checkoutId, email });
      await markRedemptionsUsed(database, checkoutId, randomUUID());
    }
    await insertRedemption(database, { discountId, checkoutId: randomUUID(), email: ADA });
    await insertRedemption(database, {
      discountId: heldOnly,
      checkoutId: randomUUID(),
      email: ADA,
    });

    expect(await countUsedRedemptions(database, [discountId, heldOnly])).toEqual(
      new Map([[discountId, 2]]),
    );
    expect(await countUsedRedemptions(database, [])).toEqual(new Map());
  });

  it("says which collections hold each product, by hand and by rule", async () => {
    const { database } = handle;
    const mug = await insertProduct(database, {
      title: "Blue Mug",
      handle: "mug",
      tags: ["sale"],
      vendor: "Acme",
    });
    const lamp = await insertProduct(database, { title: "Desk Lamp", handle: "lamp" });
    const chair = await insertProduct(database, {
      title: "Chair",
      handle: "chair",
      tags: ["sale"],
    });
    const { id: variantId } = await insertVariant(database, { productId: lamp.id, title: "One" });
    await replaceVariantPrices(database, "default", variantId, [
      { currency: "GBP", amount: 500, compareAtAmount: null },
    ]);

    const picked = await insertProductCollection(database, { title: "Picked", handle: "picked" });
    await replaceCollectionItems(database, "default", picked.id, [mug.id, chair.id]);
    const automatic = (title: string, values: object) =>
      insertProductCollection(database, {
        title,
        handle: title,
        kind: "automatic",
        ...values,
      });
    const onSale = await automatic("sale", {
      rules: [{ field: "tag", operator: "equals", value: "sale" }],
    });
    const lamps = await automatic("lamps", {
      rules: [{ field: "title", operator: "contains", value: "LAMP" }],
    });
    const cheap = await automatic("cheap", {
      rules: [{ field: "price", operator: "lessThan", value: "1000" }],
    });
    const both = await automatic("both", {
      rules: [
        { field: "tag", operator: "equals", value: "sale" },
        { field: "vendor", operator: "equals", value: "acme" },
      ],
    });
    const either = await automatic("either", {
      matchAll: false,
      rules: [
        { field: "title", operator: "equals", value: "desk lamp" },
        { field: "vendor", operator: "contains", value: "CM" },
      ],
    });
    const saleLike = await automatic("sale-like", {
      rules: [{ field: "tag", operator: "contains", value: "SAL" }],
    });
    const noRules = await automatic("no-rules", {});
    const unasked = await automatic("unasked", {
      rules: [{ field: "tag", operator: "equals", value: "sale" }],
    });

    const collectionIds = [
      picked.id,
      onSale.id,
      lamps.id,
      cheap.id,
      both.id,
      either.id,
      saleLike.id,
      noRules.id,
    ];
    const membership = await findCollectionsOfProducts(
      database,
      collectionIds,
      [mug.id, lamp.id],
      "GBP",
    );
    expect(membership).toEqual(
      new Map([
        [mug.id, new Set([picked.id, onSale.id, both.id, either.id, saleLike.id])],
        [lamp.id, new Set([lamps.id, cheap.id, either.id])],
      ]),
    );
    expect(membership.get(mug.id)?.has(unasked.id)).toBe(false);

    const noCurrency = await findCollectionsOfProducts(database, [cheap.id], [lamp.id], null);
    expect(noCurrency).toEqual(new Map());
    const wrongCurrency = await findCollectionsOfProducts(database, [cheap.id], [lamp.id], "EUR");
    expect(wrongCurrency).toEqual(new Map());
    expect(await findCollectionsOfProducts(database, [], [mug.id], "GBP")).toEqual(new Map());
    expect(await findCollectionsOfProducts(database, [picked.id], [], "GBP")).toEqual(new Map());
  });
});
