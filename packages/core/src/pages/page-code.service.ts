import type { DatabaseOrTransaction } from "../database/client.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { PageCodeContext } from "../fieldtypes/fieldtype.js";
import { hasPermission } from "../roles/permissions.js";
import { readSetting } from "../settings/settings.service.js";

/**
 * The page code rules for one save: whether the person may change code, and the site's rule
 * for scripts. Only worked out when a person is saving (`permissions` given) an entry whose
 * blueprint has a page field, so other saves cost nothing extra.
 */
export async function findPageCodeContext(
  database: DatabaseOrTransaction,
  fields: readonly FieldDefinition[],
  permissions: readonly string[] | undefined,
): Promise<PageCodeContext | undefined> {
  if (!permissions || !fields.some((field) => field.type === "page")) return undefined;
  return {
    mayEditCode: hasPermission(permissions, "builder:code"),
    scriptRule: await readSetting(database, "builderCustomScripts"),
  };
}
