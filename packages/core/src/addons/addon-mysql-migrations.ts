import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getTableColumns, getTableName } from "drizzle-orm";
import { z } from "zod";
import { mysqlTableFor } from "../database/dialect/mysql-tables.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";

const journalSchema = z.object({ entries: z.array(z.object({ idx: z.number() })) });

const snapshotSchema = z.object({
  tables: z.record(z.string(), z.object({ columns: z.record(z.string(), z.unknown()) })),
});

/**
 * What a plugin's tables have that its MySQL migrations don't make, one sentence each. Reads
 * the last snapshot drizzle-kit wrote, which is the tables as the migrations leave them.
 * A column Lintel can't turn into a MySQL one is reported here too.
 */
export async function findMysqlMigrationGaps(plugin: LintelPlugin): Promise<string[]> {
  const folder = plugin.database?.mysqlMigrationsFolder;
  if (!plugin.database || !folder) return [];
  const journalFile = join(folder, "meta", "_journal.json");
  if (!existsSync(journalFile)) {
    return [`${folder} has no migrations. Run db:generate:mysql, and include it in the package.`];
  }
  const { entries } = journalSchema.parse(JSON.parse(await readFile(journalFile, "utf8")));
  const last = Math.max(...entries.map((entry) => entry.idx));
  const snapshotFile = join(folder, "meta", `${String(last).padStart(4, "0")}_snapshot.json`);
  const { tables } = snapshotSchema.parse(JSON.parse(await readFile(snapshotFile, "utf8")));

  return plugin.database.tables.flatMap((table) => {
    const name = getTableName(table);
    let columns: string[];
    try {
      columns = Object.values(getTableColumns(mysqlTableFor(table))).map((column) => column.name);
    } catch (error) {
      return [error instanceof Error ? error.message : String(error)];
    }
    const migrated = tables[name];
    if (!migrated) return [`The MySQL migrations don't make the table ${name}.`];
    return columns
      .filter((column) => !(column in migrated.columns))
      .map((column) => `The MySQL migrations don't make the column ${name}.${column}.`);
  });
}
