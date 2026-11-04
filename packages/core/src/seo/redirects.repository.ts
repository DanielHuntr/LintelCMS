import { and, asc, eq, ne } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { RedirectStatus } from "./redirects.schema.js";
import {
  type NewRedirectRow,
  type RedirectRow,
  redirectsTable as redirectsDefinition,
} from "./seo.table.js";
import { deleteReturning, insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for redirects, nothing else. */

export async function listRedirectRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  status?: RedirectStatus,
): Promise<RedirectRow[]> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  return database
    .select()
    .from(redirectsTable)
    .where(
      and(
        eq(redirectsTable.tenantId, tenantId),
        status === undefined ? undefined : eq(redirectsTable.status, status),
      ),
    )
    .orderBy(asc(redirectsTable.fromPath));
}

export async function findRedirectRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  redirectId: string,
): Promise<RedirectRow | undefined> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  const [row] = await database
    .select()
    .from(redirectsTable)
    .where(and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.id, redirectId)))
    .limit(1);
  return row;
}

export async function findRedirectFrom(
  database: DatabaseOrTransaction,
  tenantId: string,
  fromPath: string,
): Promise<RedirectRow | undefined> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  const [row] = await database
    .select()
    .from(redirectsTable)
    .where(and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.fromPath, fromPath)))
    .limit(1);
  return row;
}

export async function insertRedirect(
  database: DatabaseOrTransaction,
  redirect: NewRedirectRow,
): Promise<RedirectRow> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  const [inserted] = await insertReturning(database, redirectsTable, redirect);
  if (!inserted) {
    throw new Error("Saving the redirect returned nothing");
  }
  return inserted;
}

export async function updateRedirectRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  redirectId: string,
  changes: Partial<Pick<RedirectRow, "fromPath" | "toPath" | "statusCode" | "status" | "source">>,
): Promise<void> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  await database
    .update(redirectsTable)
    .set(changes)
    .where(and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.id, redirectId)));
}

/**
 * Points every other redirect aimed at `oldTarget` straight at `newTarget`, so visitors
 * make one hop instead of a chain.
 */
export async function retargetRedirects(
  database: DatabaseOrTransaction,
  tenantId: string,
  oldTarget: string,
  newTarget: string,
  exceptRedirectId: string,
): Promise<void> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  await database
    .update(redirectsTable)
    .set({ toPath: newTarget })
    .where(
      and(
        eq(redirectsTable.tenantId, tenantId),
        eq(redirectsTable.toPath, oldTarget),
        ne(redirectsTable.id, exceptRedirectId),
      ),
    );
}

/** True when a redirect was deleted. */
export async function deleteRedirectRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  redirectId: string,
): Promise<boolean> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  const deleted = await deleteReturning(
    database,
    redirectsTable,
    and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.id, redirectId)),
    { id: redirectsTable.id },
  );
  return deleted.length > 0;
}

export async function deleteRedirectFrom(
  database: DatabaseOrTransaction,
  tenantId: string,
  fromPath: string,
): Promise<void> {
  const redirectsTable = tableFor(database, redirectsDefinition);
  await database
    .delete(redirectsTable)
    .where(and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.fromPath, fromPath)));
}
