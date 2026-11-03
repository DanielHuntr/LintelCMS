import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  deleteSettingValue,
  findSettingValue,
  insertSettingValueIfMissing,
  upsertSettingValue,
} from "../settings/settings.repository.js";

/**
 * Database reads and writes for a site's navigation and footer sections, in the settings
 * table: `siteSections:<site id>` is what the website shows (no row means the site has never
 * had any), `siteSectionsDraft:<site id>` changes waiting to be published, and
 * `siteSectionsBeforeTemplate:<site id>` the ones a starter template replaced.
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

function draftKey(siteId: string): string {
  return `siteSectionsDraft:${siteId}`;
}

/** Changes made in the builder that aren't on the website yet; undefined when there are none. */
export function findDraftSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<unknown> {
  return findSettingValue(database, DEFAULT_TENANT_ID, draftKey(siteId));
}

export function saveDraftSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
  value: unknown,
): Promise<void> {
  return upsertSettingValue(database, DEFAULT_TENANT_ID, draftKey(siteId), value);
}

export function deleteDraftSiteSections(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<void> {
  return deleteSettingValue(database, DEFAULT_TENANT_ID, draftKey(siteId));
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
