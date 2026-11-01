import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import type { SeoDefaults } from "./seo-defaults.schema.js";
import type { UpdateSeoDefaultsRequest } from "./seo.schema.js";

/** The site-wide SEO settings, kept in the `seoDefaults` setting. */

export async function readSeoDefaults(database: DatabaseOrTransaction): Promise<SeoDefaults> {
  return readSetting(database, "seoDefaults");
}

/** Changes only what is sent; everything else stays as it was. */
export async function updateSeoDefaults(
  database: DatabaseOrTransaction,
  changes: UpdateSeoDefaultsRequest,
): Promise<SeoDefaults> {
  const current = await readSeoDefaults(database);
  const updated = { ...current, ...changes };
  await writeSetting(database, "seoDefaults", updated);
  return updated;
}
