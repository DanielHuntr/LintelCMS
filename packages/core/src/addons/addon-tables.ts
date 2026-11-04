import { personalDataDeclarationSchema } from "../privacy/personal-data-declaration.js";
import { getTableName } from "drizzle-orm";
import { listSchemaTables } from "../backups/table-order.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import {
  addonDeclarationsSchema,
  type AddonDeclarations,
  noDeclarations,
} from "./addon-declarations.js";
import type { LoadedAddon } from "./load-addons.js";

/**
 * What a plugin says about itself: an add-on's from its package.json, any other plugin's
 * from `declares` in its definition. One that can't be read says nothing.
 */
export function declarationsOf(
  plugin: LintelPlugin,
  addon: Pick<LoadedAddon, "addonPackage"> | undefined,
): AddonDeclarations {
  if (addon) return addon.addonPackage.manifest;
  const parsed = addonDeclarationsSchema.safeParse(plugin.declares ?? {});
  return parsed.success ? parsed.data : noDeclarations;
}

const lintelTableNames = new Set(listSchemaTables().map((table) => getTableName(table)));

/**
 * Lintel's own tables are never an add-on's, whatever it declares or however its id reads:
 * an add-on called "shop" must not be able to empty shop_orders with Delete data.
 */
export function isLintelTable(name: string): boolean {
  return lintelTableNames.has(name);
}

/** What it says in `personalData`, in its code or its package.json, as Privacy reads it. */
export function ownPersonalData(
  plugin: LintelPlugin,
  addon: Pick<LoadedAddon, "addonPackage"> | undefined,
) {
  const parsed = personalDataDeclarationSchema.safeParse(plugin.personalData);
  return parsed.success ? parsed.data : addon?.addonPackage.manifest.personalData;
}

/**
 * The tables plugins and add-ons keep their own data in, by name, for backups: those they
 * declare, those they name under `personalData`, and those their `database.tables` define.
 * Each once, in the order given.
 */
export function listAddonTableNames(
  plugins: readonly LintelPlugin[],
  loaded: readonly Pick<LoadedAddon, "plugin" | "addonPackage">[],
): string[] {
  const addons = new Map(loaded.map((addon) => [addon.plugin.id, addon]));
  const names = plugins.flatMap((plugin) => [
    ...declarationsOf(plugin, addons.get(plugin.id)).tables.map((table) => table.name),
    ...(ownPersonalData(plugin, addons.get(plugin.id))?.tables ?? []).map((table) => table.name),
    ...(plugin.database?.tables ?? []).map((table) => getTableName(table)),
  ]);
  return [...new Set(names)].filter((name) => !isLintelTable(name));
}
