import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import type { FormsSettingsResponse } from "./forms-settings.schema.js";

/** The site-wide forms settings: today, the optional Cloudflare Turnstile keys. */

export async function readFormsSettings(
  database: DatabaseOrTransaction,
): Promise<FormsSettingsResponse> {
  const { turnstileSiteKey, turnstileSecretKey } = await readSetting(
    database,
    "formsSpamProtection",
  );
  return { turnstileSiteKey, hasTurnstileSecret: turnstileSecretKey !== null };
}

export async function updateFormsSettings(
  database: DatabaseOrTransaction,
  changes: { turnstileSiteKey: string | null; turnstileSecretKey?: string | null },
): Promise<FormsSettingsResponse> {
  const saved = await readSetting(database, "formsSpamProtection");
  await writeSetting(database, "formsSpamProtection", {
    turnstileSiteKey: changes.turnstileSiteKey,
    turnstileSecretKey:
      changes.turnstileSecretKey === undefined
        ? saved.turnstileSecretKey
        : changes.turnstileSecretKey,
  });
  return readFormsSettings(database);
}
