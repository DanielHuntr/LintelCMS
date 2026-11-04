import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import {
  countRows,
  emptyTables,
  findExistingTables,
  readAllRows,
  rowsOf,
  type TableRow,
} from "../backups/database-snapshot.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { PluginCatalogue } from "../plugins/plugin-catalogue.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { findPluginJobRun } from "../plugins/plugin-jobs.js";
import { listRegisteredPluginRoutes } from "../plugins/plugin-routes.js";
import { PluginNotFoundError } from "../plugins/plugins.errors.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import {
  personalColumnsOf,
  personalDataDeclarationSchema,
} from "../privacy/personal-data-declaration.js";
import { deleteSettingValue } from "../settings/settings.repository.js";
import { declarationsOf, isLintelTable } from "./addon-tables.js";
import { csvCell } from "../forms/submissions-csv.js";
import { AddonStillOnError, AddonTableNotFoundError } from "./addons.errors.js";
import type { AddonDetails } from "./addons.schema.js";
import type { AddonsState, LoadedAddon } from "./load-addons.js";

/**
 * One add-on in full, for Build → Add-ons: what it says it keeps and does, set against what
 * Lintel can see for itself. Also exporting its data, and deleting it before it is removed.
 */

interface Found {
  plugin: LintelPlugin;
  addon: LoadedAddon | undefined;
}

function findAddon(catalogue: PluginCatalogue, addons: AddonsState, id: string): Found {
  const entry = catalogue.entries.find(
    ({ plugin, source }) => plugin.id === id && source === "installed",
  );
  if (!entry) throw new PluginNotFoundError(id);
  return { plugin: entry.plugin, addon: addons.loaded.find(({ plugin }) => plugin.id === id) };
}

/** What it says in `personalData`, in its code or its package.json, as Privacy reads it. */
function ownPersonalData({ plugin, addon }: Found) {
  const parsed = personalDataDeclarationSchema.safeParse(plugin.personalData);
  return parsed.success ? parsed.data : addon?.addonPackage.manifest.personalData;
}

/** Tables are named after the plugin: "gift-cards" owns "gift_cards" and "gift_cards_…". */
function ownsTableName(pluginId: string, table: string): boolean {
  const prefix = pluginId.replaceAll("-", "_");
  return table === prefix || table.startsWith(`${prefix}_`);
}

async function listTableNames(database: DatabaseOrTransaction): Promise<string[]> {
  const result = await database.execute(
    sql`select table_name from information_schema.tables
        where table_schema = current_schema() and table_type = 'BASE TABLE'`,
  );
  return rowsOf(result).map((row) => String(row.table_name));
}

async function listColumnNames(database: DatabaseOrTransaction, table: string): Promise<string[]> {
  const result = await database.execute(
    sql`select column_name from information_schema.columns
        where table_schema = current_schema() and table_name = ${table}`,
  );
  return rowsOf(result).map((row) => String(row.column_name));
}

async function measure(database: DatabaseOrTransaction, table: string) {
  const rows = await countRows(database, table);
  try {
    const result = await database.execute(
      sql`select pg_total_relation_size(${table}::regclass)::bigint as bytes`,
    );
    return { rows, bytes: Number(rowsOf(result)[0]?.bytes ?? 0) };
  } catch {
    return { rows, bytes: null };
  }
}

/** Tables named under `personalData` alone, with only their personal columns to show. */
function tablesOnlyInPersonalData(found: Found, described: readonly { name: string }[]) {
  const personalData = ownPersonalData(found);
  const known = new Set(described.map((table) => table.name));
  return (personalData?.tables ?? [])
    .filter((table) => !known.has(table.name))
    .map((table) => ({
      name: table.name,
      purpose: "",
      columns: personalColumnsOf(personalData, table.name).map((name) => ({
        name,
        purpose: "",
        personalData: true,
      })),
    }));
}

/**
 * The tables this add-on keeps data in: those it declares, in `tables` or `personalData`, and
 * any others with its name. The details, Export and Delete data all go by this list.
 */
async function findOwnTables(database: DatabaseOrTransaction, found: Found) {
  const described = declarationsOf(found.plugin, found.addon).tables;
  const declared = [...described, ...tablesOnlyInPersonalData(found, described)].filter(
    (table) => !isLintelTable(table.name),
  );
  const inDatabase = await listTableNames(database);
  const declaredNames = new Set(declared.map((table) => table.name));
  const undeclared = inDatabase
    .filter(
      (name) =>
        ownsTableName(found.plugin.id, name) && !declaredNames.has(name) && !isLintelTable(name),
    )
    .sort();
  const present = new Set(inDatabase);
  return { declared, undeclared, present };
}

/** npm's integrity for an installed package, from the add-ons folder's package-lock.json. */
async function findIntegrity(addons: AddonsState, addon: LoadedAddon): Promise<string | null> {
  if (!addons.folder || addon.linked) return null;
  const lockFile = join(addons.folder, "package-lock.json");
  if (!existsSync(lockFile)) return null;
  try {
    const lock = JSON.parse(await readFile(lockFile, "utf8")) as {
      packages?: Record<string, { integrity?: unknown }>;
    };
    const integrity = lock.packages?.[`node_modules/${addon.addonPackage.packageName}`]?.integrity;
    return typeof integrity === "string" ? integrity : null;
  } catch {
    return null;
  }
}

async function fingerprintOf(addon: LoadedAddon): Promise<string | null> {
  const file = join(addon.addonPackage.folder, addon.addonPackage.manifest.server);
  if (!existsSync(file)) return null;
  return `sha256-${createHash("sha256")
    .update(await readFile(file))
    .digest("hex")}`;
}

export async function describeAddon(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  addons: AddonsState,
  id: string,
): Promise<AddonDetails> {
  const found = findAddon(catalogue, addons, id);
  const { plugin, addon } = found;
  const declarations = declarationsOf(plugin, addon);
  const own = await findOwnTables(database, found);
  const personalData = ownPersonalData(found);

  const tables = await Promise.all(
    own.declared.map(async (table) => {
      const checked = own.present.has(table.name);
      const columns = checked ? new Set(await listColumnNames(database, table.name)) : new Set();
      return {
        name: table.name,
        purpose: table.purpose,
        columns: table.columns.map((column) => ({
          name: column.name,
          purpose: column.purpose,
          personalData:
            (column.personalData ?? false) ||
            personalColumnsOf(personalData, table.name).includes(column.name),
          checked: columns.has(column.name),
        })),
        checked,
        ...(checked ? await measure(database, table.name) : { rows: null, bytes: null }),
      };
    }),
  );
  const undeclared = await Promise.all(
    own.undeclared.map(async (name) => ({ name, ...(await measure(database, name)) })),
  );

  const registered = listRegisteredPluginRoutes(plugin.id);
  const isRegistered = (method: string, path: string) =>
    registered.some((route) => route.method === method && route.path === path);
  const publicRoutes = declarations.publicRoutes.map((route) => ({
    ...route,
    checked: isRegistered(route.method, route.path),
  }));

  const jobPurposes = new Map(declarations.jobs.map((job) => [job.id, job.purpose]));
  const jobs: AddonDetails["runs"]["jobs"] = (plugin.jobs ?? []).map((job) => {
    const run = findPluginJobRun(plugin.id, job.id);
    return {
      id: job.id,
      name: job.name,
      everyMinutes: job.everyMinutes,
      purpose: jobPurposes.get(job.id) ?? null,
      lastRunAt: run?.lastRunAt.toISOString() ?? null,
      lastError: run?.lastError ?? null,
      checked: true,
    };
  });
  // Jobs it describes but doesn't run are listed too, so the difference shows.
  for (const job of declarations.jobs) {
    if (jobs.some(({ id: jobId }) => jobId === job.id)) continue;
    jobs.push({
      id: job.id,
      name: job.id,
      everyMinutes: null,
      purpose: job.purpose,
      lastRunAt: null,
      lastError: null,
      checked: false,
    });
  }
  const eventPurposes = new Map(declarations.events.map((event) => [event.event, event.purpose]));
  const handled = Object.keys(plugin.events ?? {});
  const events = [
    ...handled.map((event) => ({
      event,
      purpose: eventPurposes.get(event) ?? null,
      checked: true,
    })),
    ...declarations.events
      .filter(({ event }) => !handled.includes(event))
      .map(({ event, purpose }) => ({ event, purpose, checked: false })),
  ];

  return {
    id: plugin.id,
    stores: { tables, undeclared, settings: plugin.settings !== undefined },
    website: {
      publicRoutes,
      otherRoutes: registered.filter(
        (route) =>
          !declarations.publicRoutes.some(
            (declared) => declared.method === route.method && declared.path === route.path,
          ),
      ).length,
      adminScreens: addon ? addon.addonPackage.manifest.admin !== undefined : true,
      blocks: (plugin.blocks ?? []).map((block) => block.name),
    },
    runs: { jobs, events },
    talksTo: {
      hosts: declarations.hosts,
      consentServices: (plugin.consentServices ?? []).map((service) => service.name),
      consentFromSettings: plugin.consentServicesFromSettings !== undefined,
    },
    origin: {
      packageName: addon?.addonPackage.packageName ?? null,
      version: addon?.addonPackage.version ?? plugin.version ?? null,
      publisher: addon?.addonPackage.origin.publisher ?? null,
      licence: addon?.addonPackage.origin.licence ?? null,
      source: addon?.addonPackage.origin.source ?? null,
      integrity: addon ? await findIntegrity(addons, addon) : null,
      fingerprint: addon ? await fingerprintOf(addon) : null,
    },
    permissions: (plugin.permissions ?? []).map(({ permission, description }) => ({
      permission,
      description,
    })),
  };
}

/** The add-on's tables that are in the database: declared first, then any others it owns. */
async function presentTables(database: DatabaseOrTransaction, found: Found): Promise<string[]> {
  const own = await findOwnTables(database, found);
  return [
    ...(await findExistingTables(
      database,
      own.declared.map((table) => table.name),
    )),
    ...own.undeclared,
  ];
}

/** Every row the add-on keeps, by table, as one JSON document. */
export async function exportAddonData(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  addons: AddonsState,
  id: string,
): Promise<{ addon: string; exportedAt: string; tables: Record<string, TableRow[]> }> {
  const found = findAddon(catalogue, addons, id);
  const tables: Record<string, TableRow[]> = {};
  for (const name of await presentTables(database, found)) {
    tables[name] = await readAllRows(database, name);
  }
  return { addon: id, exportedAt: new Date().toISOString(), tables };
}

/** One of the add-on's tables as CSV, a header row first. */
export async function exportAddonTableCsv(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  addons: AddonsState,
  id: string,
  table: string,
): Promise<string> {
  const found = findAddon(catalogue, addons, id);
  if (!(await presentTables(database, found)).includes(table)) {
    throw new AddonTableNotFoundError(table);
  }
  const columns = await listColumnNames(database, table);
  const rows = await readAllRows(database, table);
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return "";
    return csvCell(typeof value === "object" ? JSON.stringify(value) : String(value));
  };
  return [columns, ...rows.map((row) => columns.map((column) => row[column]))]
    .map((line) => line.map(cell).join(","))
    .join("\r\n")
    .concat("\r\n");
}

/**
 * Empties the add-on's tables and forgets its settings, before it is removed. It must be
 * switched off first. The tables stay, empty, so adding it again just works.
 */
export async function deleteAddonData(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  addons: AddonsState,
  id: string,
): Promise<{ emptied: string[] }> {
  const found = findAddon(catalogue, addons, id);
  if (await isPluginEnabled(database, id)) throw new AddonStillOnError(found.plugin.name);
  const tables = await presentTables(database, found);
  if (tables.length > 0) await emptyTables(database, tables);
  await deleteSettingValue(database, DEFAULT_TENANT_ID, `plugin:${id}`);
  return { emptied: tables };
}
