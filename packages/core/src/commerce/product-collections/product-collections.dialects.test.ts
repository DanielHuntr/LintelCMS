import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { productsTable } from "../products/products.table.js";
import {
  countCollectionItems,
  deleteProductCollectionRow,
  findProductCollectionRow,
  findProductCollectionRowByHandle,
  insertProductCollection,
  listCollectionProductIds,
  listProductCollectionRows,
  replaceCollectionItems,
  updateProductCollectionRow,
} from "./product-collections.repository.js";

const TENANT = "default";

async function addProduct(database: Database, handle: string) {
  const [product] = await insertReturning(database, tableFor(database, productsTable), {
    title: handle,
    handle,
  });
  return product?.id ?? "";
}

describeOnEveryDatabase("Product collections", (handle) => {
  it("saves a collection, changes it and deletes it once", async () => {
    const { database } = handle;
    const collection = await insertProductCollection(database, { title: "Sale", handle: "sale" });
    expect(collection).toMatchObject({ kind: "manual", rules: [], matchAll: true });
    await updateProductCollectionRow(database, TENANT, collection.id, { title: "Offers" });
    expect((await findProductCollectionRow(database, TENANT, collection.id))?.title).toBe("Offers");
    const byHandle = await findProductCollectionRowByHandle(database, TENANT, "sale");
    expect(byHandle?.id).toBe(collection.id);
    expect(await listProductCollectionRows(database, TENANT)).toHaveLength(1);
    expect(await deleteProductCollectionRow(database, TENANT, collection.id)).toBe(true);
    expect(await deleteProductCollectionRow(database, TENANT, collection.id)).toBe(false);
  });

  it("keeps its products in the order given, and counts them", async () => {
    const { database } = handle;
    const { id } = await insertProductCollection(database, { title: "Sale", handle: "sale" });
    const first = await addProduct(database, "first");
    const second = await addProduct(database, "second");
    await replaceCollectionItems(database, TENANT, id, [second, first]);
    expect(await listCollectionProductIds(database, id)).toEqual([second, first]);
    expect((await countCollectionItems(database, [id])).get(id)).toBe(2);
    expect(await countCollectionItems(database, [])).toEqual(new Map());
    await replaceCollectionItems(database, TENANT, id, []);
    expect(await listCollectionProductIds(database, id)).toEqual([]);
  });
});
