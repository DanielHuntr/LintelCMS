import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { insertMarket } from "../markets/markets.repository.js";
import { productsTable, variantsTable } from "../products/products.table.js";
import {
  addToCartLine,
  deleteAllCartLines,
  deleteCartLine,
  findCartRow,
  findCartRowByTokenHash,
  insertCart,
  listCartLineRows,
  setCartLineQuantity,
  updateCartRow,
} from "./carts.repository.js";

const tenantId = "default";

async function addCart(database: Database) {
  const market = await insertMarket(database, { name: "UK", handle: "uk", currency: "GBP" });
  return insertCart(database, { tokenHash: "hash", marketId: market.id });
}

async function addVariant(database: Database) {
  const [product] = await insertReturning(database, tableFor(database, productsTable), {
    title: "Mug",
    handle: "mug",
  });
  const [variant] = await insertReturning(database, tableFor(database, variantsTable), {
    productId: product?.id ?? "",
    title: "Blue",
  });
  return variant?.id ?? "";
}

describeOnEveryDatabase("Carts", (handle) => {
  it("saves a cart, finds it and changes it", async () => {
    const { database } = handle;
    const cart = await addCart(database);
    expect(cart.discountCodes).toEqual([]);
    await updateCartRow(database, cart.id, { discountCodes: ["SUMMER"], email: "a@example.com" });
    expect((await findCartRow(database, cart.id))?.discountCodes).toEqual(["SUMMER"]);
    expect((await findCartRowByTokenHash(database, "hash"))?.email).toBe("a@example.com");
  });

  it("adds to a line rather than making a second one", async () => {
    const { database } = handle;
    const { id: cartId } = await addCart(database);
    const variantId = await addVariant(database);
    const line = { tenantId, cartId, variantId, quantity: 2 };
    await addToCartLine(database, line);
    await addToCartLine(database, { ...line, quantity: 3 });
    const rows = await listCartLineRows(database, cartId);
    expect(rows.map((row) => row.quantity)).toEqual([5]);
  });

  it("changes and removes lines, saying if it did", async () => {
    const { database } = handle;
    const { id: cartId } = await addCart(database);
    const variantId = await addVariant(database);
    await addToCartLine(database, { tenantId, cartId, variantId, quantity: 1 });
    const [line] = await listCartLineRows(database, cartId);
    expect(await setCartLineQuantity(database, cartId, line?.id ?? "", 4)).toBe(true);
    expect(await deleteCartLine(database, cartId, line?.id ?? "")).toBe(true);
    expect(await deleteCartLine(database, cartId, line?.id ?? "")).toBe(false);
    expect(await setCartLineQuantity(database, cartId, line?.id ?? "", 4)).toBe(false);

    await addToCartLine(database, { tenantId, cartId, variantId, quantity: 1 });
    await deleteAllCartLines(database, cartId);
    expect(await listCartLineRows(database, cartId)).toEqual([]);
  });
});
