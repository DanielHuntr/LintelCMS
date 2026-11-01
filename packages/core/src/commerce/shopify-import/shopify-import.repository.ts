import { and, count, desc, eq, isNull, lt, or } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { type CustomerRow, customersTable } from "../customers/customers.table.js";
import {
  type ArchivedOrderRow,
  archivedOrdersTable,
  type NewArchivedOrderRow,
  type ShopifyImportRow,
  shopifyImportsTable,
} from "./shopify-import.table.js";

/** Database reads and writes for Shopify imports and the archived orders they bring. */

export async function insertImport(
  database: DatabaseOrTransaction,
  values: Omit<typeof shopifyImportsTable.$inferInsert, "tenantId">,
): Promise<ShopifyImportRow> {
  const [row] = await database
    .insert(shopifyImportsTable)
    .values({ ...values, tenantId: DEFAULT_TENANT_ID })
    .returning();
  if (!row) throw new Error("Saving the import returned nothing");
  return row;
}

export async function findImportRow(
  database: DatabaseOrTransaction,
  importId: string,
): Promise<ShopifyImportRow | undefined> {
  const [row] = await database
    .select()
    .from(shopifyImportsTable)
    .where(
      and(
        eq(shopifyImportsTable.tenantId, DEFAULT_TENANT_ID),
        eq(shopifyImportsTable.id, importId),
      ),
    )
    .limit(1);
  return row;
}

export async function listImportRows(database: DatabaseOrTransaction): Promise<ShopifyImportRow[]> {
  return database
    .select()
    .from(shopifyImportsTable)
    .where(eq(shopifyImportsTable.tenantId, DEFAULT_TENANT_ID))
    .orderBy(desc(shopifyImportsTable.createdAt))
    .limit(20);
}

export async function updateImportRow(
  database: DatabaseOrTransaction,
  importId: string,
  changes: Partial<typeof shopifyImportsTable.$inferInsert>,
): Promise<void> {
  await database
    .update(shopifyImportsTable)
    .set(changes)
    .where(eq(shopifyImportsTable.id, importId));
}

/**
 * Takes the import for one batch, unless another window holds it. The lease runs out on
 * its own, so a closed tab or a restart never leaves an import stuck.
 */
export async function claimImport(
  database: DatabaseOrTransaction,
  importId: string,
  now: Date,
  until: Date,
): Promise<ShopifyImportRow | undefined> {
  const [row] = await database
    .update(shopifyImportsTable)
    .set({ leaseUntil: until })
    .where(
      and(
        eq(shopifyImportsTable.id, importId),
        or(isNull(shopifyImportsTable.leaseUntil), lt(shopifyImportsTable.leaseUntil, now)),
      ),
    )
    .returning();
  return row;
}

/** Adds a customer unless one with the email exists; null when they were already there. */
export async function insertCustomerIfNew(
  database: DatabaseOrTransaction,
  customer: Pick<CustomerRow, "email" | "name" | "phone" | "addresses" | "note">,
): Promise<CustomerRow | null> {
  const [row] = await database
    .insert(customersTable)
    .values({ ...customer, tenantId: DEFAULT_TENANT_ID })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function findCustomerIdByEmail(
  database: DatabaseOrTransaction,
  email: string,
): Promise<string | null> {
  const [row] = await database
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, DEFAULT_TENANT_ID), eq(customersTable.email, email)))
    .limit(1);
  return row?.id ?? null;
}

/** Saves an archived order unless one with the name came from the same place. */
export async function insertArchivedOrderIfNew(
  database: DatabaseOrTransaction,
  order: Omit<NewArchivedOrderRow, "tenantId">,
): Promise<boolean> {
  const inserted = await database
    .insert(archivedOrdersTable)
    .values({ ...order, tenantId: DEFAULT_TENANT_ID })
    .onConflictDoNothing()
    .returning({ id: archivedOrdersTable.id });
  return inserted.length > 0;
}

export async function archivedOrderExists(
  database: DatabaseOrTransaction,
  name: string,
): Promise<boolean> {
  const [row] = await database
    .select({ id: archivedOrdersTable.id })
    .from(archivedOrdersTable)
    .where(
      and(
        eq(archivedOrdersTable.tenantId, DEFAULT_TENANT_ID),
        eq(archivedOrdersTable.source, "shopify"),
        eq(archivedOrdersTable.name, name),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function listArchivedOrderRows(
  database: DatabaseOrTransaction,
  filter: { customerId?: string },
  page: { page: number; perPage: number },
): Promise<{ rows: ArchivedOrderRow[]; total: number }> {
  const where = and(
    eq(archivedOrdersTable.tenantId, DEFAULT_TENANT_ID),
    filter.customerId ? eq(archivedOrdersTable.customerId, filter.customerId) : undefined,
  );
  const rows = await database
    .select()
    .from(archivedOrdersTable)
    .where(where)
    .orderBy(desc(archivedOrdersTable.placedAt))
    .limit(page.perPage)
    .offset((page.page - 1) * page.perPage);
  const [total] = await database.select({ value: count() }).from(archivedOrdersTable).where(where);
  return { rows, total: Number(total?.value ?? 0) };
}
