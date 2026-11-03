import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import { findSettingValue, upsertSettingValue } from "../settings/settings.repository.js";

/** Database reads and writes for the cookie notice: its settings row, and published designs. */

const settingKey = "cookieNotice";

export function findStoredCookieNotice(database: DatabaseOrTransaction): Promise<unknown> {
  return findSettingValue(database, DEFAULT_TENANT_ID, settingKey);
}

export function saveStoredCookieNotice(
  database: DatabaseOrTransaction,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey, value);
}

/**
 * The published designs (the `design` field) of one collection's entries kept with one site,
 * in every language. Only the design is read, not the rest of each entry.
 */
export async function listPublishedDesigns(
  database: DatabaseOrTransaction,
  where: { collectionId: string; siteId: string },
): Promise<unknown[]> {
  const design = sql<unknown>`${entriesTable.publishedData} -> 'design'`;
  const rows = await database
    .select({ design })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.tenantId, DEFAULT_TENANT_ID),
        eq(entriesTable.collectionId, where.collectionId),
        eq(entriesTable.siteId, where.siteId),
        isNotNull(entriesTable.publishedData),
        sql`${entriesTable.publishedData} -> 'design' is not null`,
      ),
    );
  return rows.map((row) => row.design);
}
