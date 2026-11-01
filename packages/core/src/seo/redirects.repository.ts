import { and, asc, eq, ne } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { RedirectStatus } from "./redirects.schema.js";
import { type NewRedirectRow, type RedirectRow, redirectsTable } from "./seo.table.js";

/** Database reads and writes for redirects, nothing else. */

export async function listRedirectRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  status?: RedirectStatus,
): Promise<RedirectRow[]> {
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
  const [inserted] = await database.insert(redirectsTable).values(redirect).returning();
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
  const deleted = await database
    .delete(redirectsTable)
    .where(and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.id, redirectId)))
    .returning({ id: redirectsTable.id });
  return deleted.length > 0;
}

export async function deleteRedirectFrom(
  database: DatabaseOrTransaction,
  tenantId: string,
  fromPath: string,
): Promise<void> {
  await database
    .delete(redirectsTable)
    .where(and(eq(redirectsTable.tenantId, tenantId), eq(redirectsTable.fromPath, fromPath)));
}
