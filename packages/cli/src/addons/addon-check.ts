import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  AddonPackageError,
  findMysqlMigrationGaps,
  loadAddonInFolder,
  readAddonPackage,
} from "@lintel/core/data-tools";
import {
  namesProperty,
  postgresOnlyCodeIn,
  tablesNotThroughTableFor,
} from "@lintel/core/postgres-only-rules";
import { lintelVersion } from "@lintel/core/updates";
import ts from "typescript";
import { CommandError, type Terminal } from "../terminal.js";

/**
 * Whether an add-on keeps its promise to run on MySQL and MariaDB, as far as reading it can
 * tell. It finds what only Postgres has, tables that skip `tableFor`, and migrations behind
 * the tables. Queries are built as the code runs, so this can't see everything: running the
 * add-on's tests on those databases is the rest of the check (see "Building add-ons").
 */

export interface PortabilityFindings {
  /** It names `mysqlMigrationsFolder`, so it says it runs on MySQL and MariaDB. */
  saysItRunsOnMysql: boolean;
  /** It has tables of its own, so it stays off on MySQL unless it says otherwise. */
  hasTables: boolean;
  /** One line each, with where it is. */
  problems: string[];
}

interface CodeFile {
  /** As shown to people. */
  name: string;
  source: string;
}

function allFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  });
}

function serverSourceFiles(addonFolder: string): CodeFile[] {
  const folder = join(addonFolder, "src", "server");
  if (!existsSync(folder)) return [];
  return allFiles(folder)
    .filter((path) => /\.ts$/.test(path) && !/\.test\.ts$/.test(path))
    .map((path) => ({
      name: relative(addonFolder, path).replaceAll("\\", "/"),
      source: readFileSync(path, "utf8"),
    }));
}

function findings(files: readonly CodeFile[], checkTables: boolean): PortabilityFindings {
  const problems = files.flatMap(({ name, source }) => {
    const found = Object.entries(postgresOnlyCodeIn(ts, name, source)).map(
      ([rule, count]) => `${name}: only Postgres has this: ${rule} (${count})`,
    );
    const lines = checkTables ? tablesNotThroughTableFor(ts, name, source) : [];
    return [...found, ...lines.map((line) => `${name}:${line}: get this table through tableFor`)];
  });
  const names = (property: string) =>
    files.some(({ name, source }) => namesProperty(ts, name, source, property));
  return {
    saysItRunsOnMysql: names("mysqlMigrationsFolder"),
    hasTables: names("migrationsFolder"),
    problems,
  };
}

/** Reads an add-on's source: for `lintel addons build` and `check`. */
export function readAddonSourceForMysql(addonFolder: string): PortabilityFindings {
  return findings(serverSourceFiles(addonFolder), true);
}

/** Reads a built add-on's bundle: all there is once it's installed. */
export function readAddonBundleForMysql(serverFile: string): PortabilityFindings {
  const name = serverFile.replaceAll("\\", "/").split("/").at(-1) ?? serverFile;
  return findings([{ name, source: readFileSync(serverFile, "utf8") }], false);
}

/** Whether what was found breaks what the add-on says about itself. */
export function breaksItsPromise({ saysItRunsOnMysql, hasTables, problems }: PortabilityFindings) {
  return problems.length > 0 && (saysItRunsOnMysql || !hasTables);
}

/** `lintel addons check`: says what's wrong, and whether it's safe to publish. */
export async function checkAddon(addonFolder: string, terminal: Terminal): Promise<number> {
  const addonPackage = await readAddonPackage(addonFolder).catch((error: unknown) => {
    throw error instanceof AddonPackageError ? new CommandError(error.message) : error;
  });
  if (addonPackage.dataOnly) {
    terminal.say(`${addonPackage.packageName} has no code, so it runs on every database.`);
    return 0;
  }
  const found = readAddonSourceForMysql(addonFolder);
  const problems = breaksItsPromise(found) ? [...found.problems] : [];
  if (found.saysItRunsOnMysql) {
    if (existsSync(join(addonFolder, addonPackage.manifest.server))) {
      const plugin = await loadAddonInFolder(addonFolder, lintelVersion());
      problems.push(...(await findMysqlMigrationGaps(plugin)));
    } else {
      terminal.warn("It hasn't been built, so its MySQL migrations weren't compared with it.");
    }
  }
  if (found.hasTables && !found.saysItRunsOnMysql) {
    terminal.say(
      `${addonPackage.packageName} has tables and no mysqlMigrationsFolder, so it stays off on ` +
        "MySQL and MariaDB. Postgres and the built-in database are fine.",
    );
    return 0;
  }
  if (problems.length > 0) {
    terminal.say(`${addonPackage.packageName} wouldn't run on MySQL and MariaDB:`);
    for (const problem of problems) terminal.say(`  ${problem}`);
    return 1;
  }
  terminal.say(
    `${addonPackage.packageName}: nothing here is only for Postgres. Run its tests on MySQL ` +
      "and MariaDB too, with TEST_DATABASE_URL.",
  );
  return 0;
}
