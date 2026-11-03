import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import {
  deleteUserInterfaceLanguage,
  findUserInterfaceLanguage,
  upsertUserInterfaceLanguage,
} from "./interface-languages.repository.js";
import type { InterfaceLanguageResponse } from "./interface-languages.schema.js";

/**
 * Which language the admin speaks: the person's own choice, else the site's default
 * (Account → Interface language), else the deployment's (LINTEL_DEFAULT_INTERFACE_LANGUAGE
 * or lintel.config.json), else English.
 */

export async function readInterfaceLanguage(
  database: DatabaseOrTransaction,
  userId: string | null,
  deploymentDefault: string,
): Promise<InterfaceLanguageResponse> {
  const siteDefault = (await readSiteDefault(database)) ?? deploymentDefault;
  const personal = userId
    ? ((await findUserInterfaceLanguage(database, DEFAULT_TENANT_ID, userId)) ?? null)
    : null;
  return { personal, siteDefault, active: personal ?? siteDefault };
}

export async function choosePersonalInterfaceLanguage(
  database: DatabaseOrTransaction,
  userId: string,
  language: string | null,
  deploymentDefault: string,
): Promise<InterfaceLanguageResponse> {
  if (language === null) {
    await deleteUserInterfaceLanguage(database, DEFAULT_TENANT_ID, userId);
  } else {
    await upsertUserInterfaceLanguage(database, DEFAULT_TENANT_ID, userId, language);
  }
  return readInterfaceLanguage(database, userId, deploymentDefault);
}

export async function chooseSiteInterfaceLanguage(
  database: DatabaseOrTransaction,
  userId: string,
  language: string | null,
  deploymentDefault: string,
): Promise<InterfaceLanguageResponse> {
  await writeSetting(database, "defaultInterfaceLanguage", language);
  return readInterfaceLanguage(database, userId, deploymentDefault);
}

/** Before setup has a database, there is no saved choice yet. */
async function readSiteDefault(database: DatabaseOrTransaction): Promise<string | null> {
  try {
    return await readSetting(database, "defaultInterfaceLanguage");
  } catch {
    return null;
  }
}
