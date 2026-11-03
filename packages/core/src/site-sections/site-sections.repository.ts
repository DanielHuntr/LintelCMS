import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  findSettingValue,
  insertSettingValueIfMissing,
  upsertSettingValue,
} from "../settings/settings.repository.js";

/**
 * Database reads and writes for a site's navigation and footer sections: one row in the
 * settings table per site, `siteSections:<site id>`. No row means the site has never had any.
 */

function settingKey(siteId: string): string {
  return `siteSections:${siteId}`;
}

export function findStoredSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return findSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId));
}

export function saveStoredSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, settingKey(siteId), value);
}

function previousKey(siteId: string): string {
  return `siteSectionsBeforeTemplate:${siteId}`;
}

/** The sections a starter template replaced, kept so they can be brought back. */
export function findPreviousSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return findSettingValue(database, DEFAULT_TENANT_ID, previousKey(siteId));
}

export function savePreviousSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, previousKey(siteId), value);
}

/** Saves the sections only if the site has none saved yet. Returns whether it did. */
export function saveStoredSiteSectionsIfMissing(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<boolean> {
  return insertSettingValueIfMissing(database, DEFAULT_TENANT_ID, settingKey(siteId), value);
}
