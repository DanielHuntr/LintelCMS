import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  deleteProductRow,
  deleteVariantRows,
  findProductRow,
  findProductRowByHandle,
  findVariantBySku,
  insertProduct,
  insertVariant,
  listHandlesLike,
  listPriceRows,
  listProductRows,
  listProductRowsById,
  listVariantRows,
  listVariantRowsById,
  replaceVariantPrices,
  updateProductRow,
  updateVariantRow,
} from "./products.repository.js";

const TENANT = "default";
const firstPage = { page: 1, perPage: 10 };

function addProduct(database: Database, title = "Blue Mug", handle = "blue-mug") {
  return insertProduct(database, { title, handle, tags: ["sale"] });
}

describeOnEveryDatabase("Products", (handle) => {
  it("saves a product, finds it and changes it", async () => {
    const { database } = handle;
    const product = await addProduct(database);
    expect(product).toMatchObject({ tags: ["sale"], description: null, status: "draft" });
    await updateProductRow(database, TENANT, product.id, { status: "active" });
    expect((await findProductRow(database, TENANT, product.id))?.status).toBe("active");
    expect((await findProductRowByHandle(database, TENANT, "blue-mug"))?.id).toBe(product.id);
    expect(await listProductRowsById(database, TENANT, [product.id])).toHaveLength(1);
    expect(await deleteProductRow(database, TENANT, product.id)).toBe(true);
    expect(await deleteProductRow(database, TENANT, product.id)).toBe(false);
  });

  it("searches titles whatever the case, and pages through them", async () => {
    const { database } = handle;
    await addProduct(database);
    await addProduct(database, "100% Wool", "wool");
    const found = await listProductRows(database, TENANT, { search: "MUG" }, firstPage);
    expect(found.total).toBe(1);
    expect(found.rows[0]?.title).toBe("Blue Mug");
    const percent = await listProductRows(database, TENANT, { search: "0%" }, firstPage);
    expect(percent.rows.map((row) => row.handle)).toEqual(["wool"]);
    const all = await listProductRows(database, TENANT, {}, { page: 2, perPage: 1 });
    expect(all).toMatchObject({ total: 2 });
    expect(all.rows).toHaveLength(1);
  });

  it("finds the handles already taken", async () => {
    const { database } = handle;
    await addProduct(database);
    await addProduct(database, "Blue Mug", "blue-mug-2");
    await addProduct(database, "Wool", "wool");
    const handles = await listHandlesLike(database, TENANT, "BLUE-MUG");
    expect([...handles].sort()).toEqual(["blue-mug", "blue-mug-2"]);
  });

  it("saves variants, finds them by SKU and deletes them", async () => {
    const { database } = handle;
    const { id: productId } = await addProduct(database);
    const variant = await insertVariant(database, {
      productId,
      title: "Large",
      optionValues: ["Large"],
      sku: "MUG-L",
    });
    await insertVariant(database, { productId, title: "No SKU" });
    await insertVariant(database, { productId, title: "No SKU either" });
    await updateVariantRow(database, variant.id, { weightGrams: 300 });
    expect((await findVariantBySku(database, TENANT, "MUG-L"))?.weightGrams).toBe(300);
    expect(await listVariantRows(database, [productId])).toHaveLength(3);
    expect(await listVariantRowsById(database, TENANT, [variant.id])).toHaveLength(1);
    await deleteVariantRows(database, [variant.id]);
    expect(await findVariantBySku(database, TENANT, "MUG-L")).toBeUndefined();
  });

  it("replaces a variant's prices", async () => {
    const { database } = handle;
    const { id: productId } = await addProduct(database);
    const { id } = await insertVariant(database, { productId, title: "Large" });
    const price = { currency: "GBP", amount: 1000, compareAtAmount: null };
    await replaceVariantPrices(database, TENANT, id, [price]);
    await replaceVariantPrices(database, TENANT, id, [{ ...price, amount: 900 }]);
    const rows = await listPriceRows(database, [id]);
    expect(rows.map((row) => row.amount)).toEqual([900]);
    await replaceVariantPrices(database, TENANT, id, []);
    expect(await listPriceRows(database, [id])).toEqual([]);
  });
});
