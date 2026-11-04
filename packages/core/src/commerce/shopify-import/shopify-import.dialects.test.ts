import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { addTestUser, describeOnEveryDatabase } from "../../testing/every-database.js";
import { usersTable } from "../../users/users.table.js";
import { customersTable } from "../customers/customers.table.js";
import {
  archivedOrderExists,
  claimImport,
  findCustomerIdByEmail,
  findImportRow,
  insertArchivedOrderIfNew,
  insertCustomerIfNew,
  insertImport,
  listArchivedOrderRows,
  listImportRows,
  updateImportRow,
} from "./shopify-import.repository.js";
import {
  archivedOrdersTable,
  type ImportOptions,
  type ImportPlan,
  type ImportReport,
  type NewArchivedOrderRow,
  shopifyImportsTable,
} from "./shopify-import.table.js";

const OTHER_TENANT = "other";
const EARLIER = new Date("2026-06-01T11:59:00.123Z");
const NOW = new Date("2026-06-01T12:00:00.123Z");
const LATER = new Date("2026-06-01T12:01:00.123Z");
const firstPage = { page: 1, perPage: 10 };

const PLAN: ImportPlan = {
  products: [],
  customers: [],
  orders: [],
  columns: { products: ["Handle", "Título"], customers: ["Email"], orders: [] },
};
const OPTIONS: ImportOptions = {
  productStatus: "keep",
  importImages: false,
  collectionsFromColumn: true,
  tagCollections: ["summer", "été"],
  importCustomers: true,
  importOrders: false,
  productPathPrefix: "/products/",
};
const counts = { created: 1, skipped: 2, failed: 0 };
const REPORT: ImportReport = {
  products: counts,
  collections: counts,
  customers: counts,
  orders: counts,
  images: { downloaded: 0, skipped: 3 },
  problems: [{ stage: "products", item: "mug", message: 'The "price" isn\'t a number' }],
  redirects: [{ fromPath: "/products/mug", toPath: "/shop/mug" }],
  productHandles: { "blue-mug": "blue-mug-2" },
};

type NewImport = Parameters<typeof insertImport>[1];

function addImport(database: Database, values: Partial<NewImport> = {}) {
  return insertImport(database, { plan: PLAN, options: OPTIONS, report: REPORT, ...values });
}

function addArchivedOrder(
  database: Database,
  name: string,
  values: Partial<NewArchivedOrderRow> = {},
) {
  return insertArchivedOrderIfNew(database, { name, currency: "GBP", placedAt: NOW, ...values });
}

function customer(email: string, name = "Ada") {
  return { email, name, phone: "", addresses: [], note: "" };
}

function archivedRows(database: Database) {
  return database.select().from(tableFor(database, archivedOrdersTable));
}

describeOnEveryDatabase("Shopify import", (handle) => {
  it("saves an import with the table's defaults", async () => {
    const { database } = handle;
    const saved = await addImport(database);
    expect(saved).toMatchObject({
      tenantId: "default",
      status: "ready",
      stage: "products",
      position: 0,
      dryRunReport: null,
      leaseUntil: null,
      completedAt: null,
      createdBy: null,
    });
    expect(saved.plan).toEqual(PLAN);
    expect(saved.options).toEqual(OPTIONS);
    expect(saved.report).toEqual(REPORT);
    expect(saved.createdAt).toBeInstanceOf(Date);
  });

  it("finds an import within this tenant", async () => {
    const { database } = handle;
    const { id } = await addImport(database);
    const [theirs] = await insertReturning(database, tableFor(database, shopifyImportsTable), {
      plan: PLAN,
      options: OPTIONS,
      report: REPORT,
      tenantId: OTHER_TENANT,
    });
    expect((await findImportRow(database, id))?.report).toEqual(REPORT);
    expect(await findImportRow(database, randomUUID())).toBeUndefined();
    expect(await findImportRow(database, theirs?.id ?? "")).toBeUndefined();
    expect((await listImportRows(database)).map((row) => row.id)).toEqual([id]);
  });

  it("lists the twenty newest imports, newest first", async () => {
    const { database } = handle;
    const start = EARLIER.getTime();
    for (let position = 0; position < 22; position += 1) {
      await addImport(database, { position, createdAt: new Date(start + position) });
    }
    const rows = await listImportRows(database);
    expect(rows).toHaveLength(20);
    expect(rows[0]?.position).toBe(21);
    expect(rows[19]?.position).toBe(2);
  });

  it("carries an import on, and clears what is set to null", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const { id } = await addImport(database, { leaseUntil: LATER, createdBy: user.id });
    const other = await addImport(database);
    await updateImportRow(database, id, {
      status: "completed",
      stage: "done",
      position: 12,
      dryRunReport: REPORT,
      report: { ...REPORT, redirects: [] },
      leaseUntil: null,
      completedAt: NOW,
    });
    const found = await findImportRow(database, id);
    expect(found).toMatchObject({
      status: "completed",
      stage: "done",
      position: 12,
      leaseUntil: null,
      completedAt: NOW,
    });
    expect(found?.dryRunReport).toEqual(REPORT);
    expect(found?.report.redirects).toEqual([]);
    expect(await findImportRow(database, other.id)).toMatchObject({ status: "ready", position: 0 });

    await updateImportRow(database, id, { dryRunReport: null });
    expect((await findImportRow(database, id))?.dryRunReport).toBeNull();

    const users = tableFor(database, usersTable);
    await database.delete(users).where(eq(users.id, user.id));
    expect((await findImportRow(database, id))?.createdBy).toBeNull();
  });

  it("claims a free import and returns it with the lease", async () => {
    const { database } = handle;
    const { id } = await addImport(database);
    const claimed = await claimImport(database, id, NOW, LATER);
    expect(claimed).toMatchObject({ id, leaseUntil: LATER });
    expect(claimed?.plan).toEqual(PLAN);
    expect((await findImportRow(database, id))?.leaseUntil).toEqual(LATER);
  });

  it("won't claim an import someone holds until the lease has passed", async () => {
    const { database } = handle;
    const { id } = await addImport(database, { leaseUntil: NOW });
    const until = new Date(LATER.getTime() + 1000);
    expect(await claimImport(database, id, EARLIER, until)).toBeUndefined();
    // A lease ending this very moment still counts.
    expect(await claimImport(database, id, NOW, until)).toBeUndefined();
    expect((await findImportRow(database, id))?.leaseUntil).toEqual(NOW);
    expect((await claimImport(database, id, LATER, until))?.leaseUntil).toEqual(until);
    expect(await claimImport(database, randomUUID(), LATER, until)).toBeUndefined();
  });

  it("gives an import to only one of two windows", async () => {
    const { database } = handle;
    const { id } = await addImport(database);
    const claims = await Promise.all([
      claimImport(database, id, NOW, LATER),
      claimImport(database, id, NOW, LATER),
    ]);
    expect(claims.filter((claim) => claim !== undefined)).toHaveLength(1);
  });

  it("adds a customer once, keeping the first", async () => {
    const { database } = handle;
    const address = {
      name: "Zoë",
      company: "",
      line1: "1 High St",
      line2: "",
      city: "Leeds",
      region: "",
      postalCode: "LS1",
      country: "GB",
      phone: "",
    };
    const saved = await insertCustomerIfNew(database, {
      email: "ada@example.com",
      name: "Ada",
      phone: "0123",
      addresses: [address as never],
      note: "Bought in store",
    });
    expect(saved).toMatchObject({
      tenantId: "default",
      email: "ada@example.com",
      name: "Ada",
      phone: "0123",
      addresses: [address],
      note: "Bought in store",
    });
    expect(await insertCustomerIfNew(database, customer("ada@example.com", "Other"))).toBeNull();

    const customers = tableFor(database, customersTable);
    const rows = await database.select().from(customers);
    expect(rows.map((row) => row.name)).toEqual(["Ada"]);
  });

  it("finds a customer's id by exact email, within this tenant", async () => {
    const { database } = handle;
    const saved = await insertCustomerIfNew(database, customer("ada@example.com"));
    await insertReturning(database, tableFor(database, customersTable), {
      email: "theirs@example.com",
      tenantId: OTHER_TENANT,
    });
    expect(await findCustomerIdByEmail(database, "ada@example.com")).toBe(saved?.id);
    expect(await findCustomerIdByEmail(database, "ADA@example.com")).toBeNull();
    expect(await findCustomerIdByEmail(database, "theirs@example.com")).toBeNull();
    expect(await findCustomerIdByEmail(database, "nobody@example.com")).toBeNull();
  });

  it("saves an archived order once for each name and source", async () => {
    const { database } = handle;
    expect(await addArchivedOrder(database, "#1001", { totalAmount: 100 })).toBe(true);
    expect(await addArchivedOrder(database, "#1001", { totalAmount: 200 })).toBe(false);
    expect(await addArchivedOrder(database, "#1001", { source: "woo" })).toBe(true);
    expect(await addArchivedOrder(database, "#1002")).toBe(true);
    const rows = await archivedRows(database);
    expect(rows).toHaveLength(3);
    const kept = rows.find((row) => row.name === "#1001" && row.source === "shopify");
    expect(kept?.totalAmount).toBe(100);
  });

  it("refuses an archived order for a customer who doesn't exist", async () => {
    const { database } = handle;
    await expect(
      addArchivedOrder(database, "#1001", { customerId: randomUUID() }),
    ).rejects.toThrow();
  });

  it("keeps an archived order as it was, with defaults for the rest", async () => {
    const { database } = handle;
    await addArchivedOrder(database, "#1001");
    const lines = [{ title: "Mug — blue", sku: "MUG", quantity: 2, unitAmount: 500 }];
    await addArchivedOrder(database, "#1002", {
      email: "ada@example.com",
      discountCodes: ["SUMMER", "ÉTÉ"],
      lines,
      shippingAddress: { city: "Malmö" } as never,
      cancelledAt: LATER,
      paymentStatus: "paid",
    });
    const { rows } = await listArchivedOrderRows(database, {}, firstPage);
    expect(rows.find((row) => row.name === "#1001")).toMatchObject({
      tenantId: "default",
      source: "shopify",
      email: "",
      customerId: null,
      subtotalAmount: 0,
      totalAmount: 0,
      refundedAmount: 0,
      paymentStatus: "",
      fulfilmentStatus: "",
      discountCodes: [],
      lines: [],
      shippingAddress: null,
      placedAt: NOW,
      cancelledAt: null,
    });
    expect(rows.find((row) => row.name === "#1002")).toMatchObject({
      email: "ada@example.com",
      discountCodes: ["SUMMER", "ÉTÉ"],
      lines,
      shippingAddress: { city: "Malmö" },
      cancelledAt: LATER,
      paymentStatus: "paid",
    });
  });

  it("only knows of Shopify orders in this tenant", async () => {
    const { database } = handle;
    await addArchivedOrder(database, "#1001");
    await addArchivedOrder(database, "#1002", { source: "woo" });
    await insertReturning(database, tableFor(database, archivedOrdersTable), {
      name: "#1003",
      currency: "GBP",
      placedAt: NOW,
      tenantId: OTHER_TENANT,
    });
    expect(await archivedOrderExists(database, "#1001")).toBe(true);
    expect(await archivedOrderExists(database, "#1002")).toBe(false);
    expect(await archivedOrderExists(database, "#1003")).toBe(false);
    expect(await archivedOrderExists(database, "#100")).toBe(false);
  });

  it("lists archived orders newest first, by customer, a page at a time", async () => {
    const { database } = handle;
    const ada = await insertCustomerIfNew(database, customer("ada@example.com"));
    await addArchivedOrder(database, "old", { placedAt: EARLIER, customerId: ada?.id });
    await addArchivedOrder(database, "new", { placedAt: LATER, customerId: ada?.id });
    await addArchivedOrder(database, "middle", { placedAt: NOW });
    await insertReturning(database, tableFor(database, archivedOrdersTable), {
      name: "theirs",
      currency: "GBP",
      placedAt: LATER,
      tenantId: OTHER_TENANT,
    });

    const first = await listArchivedOrderRows(database, {}, { page: 1, perPage: 2 });
    expect(first.total).toBe(3);
    expect(first.rows.map((row) => row.name)).toEqual(["new", "middle"]);
    const second = await listArchivedOrderRows(database, {}, { page: 2, perPage: 2 });
    expect(second.total).toBe(3);
    expect(second.rows.map((row) => row.name)).toEqual(["old"]);

    const byCustomer = await listArchivedOrderRows(database, { customerId: ada?.id }, firstPage);
    expect(byCustomer.total).toBe(2);
    expect(byCustomer.rows.map((row) => row.name)).toEqual(["new", "old"]);

    const nobody = await listArchivedOrderRows(database, { customerId: randomUUID() }, firstPage);
    expect(nobody).toEqual({ rows: [], total: 0 });
  });

  it("keeps an archived order when its customer goes", async () => {
    const { database } = handle;
    const ada = await insertCustomerIfNew(database, customer("ada@example.com"));
    await addArchivedOrder(database, "#1001", { customerId: ada?.id });
    const customers = tableFor(database, customersTable);
    await database.delete(customers).where(eq(customers.id, ada?.id ?? ""));
    const [row] = await archivedRows(database);
    expect(row).toMatchObject({ name: "#1001", customerId: null });
  });
});
