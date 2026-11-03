import { and, eq, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import {
  findSettingUpdatedAt,
  findSettingValue,
  upsertSettingValue,
} from "../settings/settings.repository.js";

/**
 * Database reads and writes for a site's design system: one row in the settings table per
 * site, `siteDesign:<site id>`. Before each site had its own there was one `siteDesign` row
 * for them all; a site that has not saved its own yet still reads that one.
 */

const sharedSettingKey = "siteDesign";

function settingKey(siteId: string): string {
  return `${sharedSettingKey}:${siteId}`;
}

/** The site's own saved design, else the one all sites shared before, else undefined. */
export async function findStoredSiteDesign(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return (
    (await findSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId))) ??
    findSettingValue(database, DEFAULT_TENANT_ID, sharedSettingKey)
  );
}

/** When the site's design was last saved (or the shared one, before it had its own), or null. */
export async function findStoredSiteDesignUpdatedAt(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<Date | null> {
  return (
    (await findSettingUpdatedAt(database, DEFAULT_TENANT_ID, settingKey(siteId))) ??
    findSettingUpdatedAt(database, DEFAULT_TENANT_ID, sharedSettingKey)
  );
}

export function saveStoredSiteDesign(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId), value);
}

/**
 * The site's entries whose saved values may use a variable or shared style (their text names
 * one), with those values, for counting where each is used.
 */
export async function listEntriesUsingSiteDesign(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<{ id: string; data: unknown }[]> {
  return database
    .select({ id: entriesTable.id, data: entriesTable.data })
    .from(entriesTable)
    .where(
      and(
        eq(entriesTable.tenantId, DEFAULT_TENANT_ID),
        eq(entriesTable.siteId, siteId),
        or(
          sql`${entriesTable.data}::text like '%"sharedStyle"%'`,
          sql`${entriesTable.data}::text like '%--lintel-var-%'`,
        ),
      ),
    );
}
