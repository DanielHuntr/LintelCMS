import { is } from "drizzle-orm";
import { type AnyMySqlColumn, type MySqlTable, getTableConfig } from "drizzle-orm/mysql-core";
import { PgTable, customType, pgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "../schema.js";
import { sitesTable } from "../../sites/sites.table.js";
import { mysqlTableFor } from "./mysql-tables.js";

/** The limits MySQL and MariaDB put on a table: checked here so no server is needed. */
const LONGEST_NAME = 64;
const LONGEST_KEY_CHARACTERS = 768;

function everyTable(): MySqlTable[] {
  return Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => mysqlTableFor(table) as unknown as MySqlTable);
}

function characters(column: AnyMySqlColumn): number {
  const match = /^varchar\((\d+)\)$/.exec(column.getSQLType());
  return match ? Number(match[1]) : 2;
}

describe("MySQL tables worked out from the Postgres ones", () => {
  it("has a MySQL form for every table, column and key", () => {
    const configs = everyTable().map((table) => getTableConfig(table));
    expect(configs.length).toBeGreaterThan(80);
    for (const config of configs) {
      expect(config.columns.length, config.name).toBeGreaterThan(0);
    }
  });

  it("keeps names and keys inside MySQL's limits", () => {
    for (const table of everyTable()) {
      const config = getTableConfig(table);
      for (const key of config.foreignKeys) {
        expect(key.getName().length, key.getName()).toBeLessThanOrEqual(LONGEST_NAME);
      }
      for (const { config: index } of config.indexes) {
        expect(index.name.length, index.name).toBeLessThanOrEqual(LONGEST_NAME);
        const columns = index.columns as AnyMySqlColumn[];
        const total = columns.reduce((sum, column) => sum + characters(column), 0);
        expect(total, index.name).toBeLessThanOrEqual(LONGEST_KEY_CHARACTERS);
      }
    }
  });

  it("gives foreign keys the same type as the column they refer to", () => {
    for (const table of everyTable()) {
      const config = getTableConfig(table);
      for (const key of config.foreignKeys) {
        const { columns, foreignColumns } = key.reference();
        columns.forEach((column, position) => {
          const target = foreignColumns[position];
          expect(column.getSQLType(), key.getName()).toBe(target?.getSQLType());
        });
      }
    }
  });

  it("builds a table once, and leaves the Postgres table alone", () => {
    const before = Object.keys(sitesTable);
    expect(mysqlTableFor(sitesTable)).toBe(mysqlTableFor(sitesTable));
    expect(mysqlTableFor(sitesTable)).not.toBe(sitesTable);
    expect(Object.keys(sitesTable)).toEqual(before);
    expect(sitesTable.hostnames.getSQLType()).toBe("text[]");
  });

  it("makes a plugin's bytes a longblob, and refuses a custom type it doesn't know", () => {
    const bytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({
      dataType: () => "bytea",
    });
    const vector = customType<{ data: string }>({ dataType: () => "vector(3)" });
    const pictures = mysqlTableFor(pgTable("pictures", { image: bytes("image").notNull() }));
    expect(pictures.image.getSQLType()).toBe("longblob");
    expect(() => mysqlTableFor(pgTable("embeddings", { value: vector("value") }))).toThrow(
      "embeddings.value is a vector(3)",
    );
  });

  it("maps the types that matter", () => {
    const sites = mysqlTableFor(sitesTable);
    expect(sites.id.getSQLType()).toBe("varchar(36)");
    expect(sites.tenantId.getSQLType()).toBe("varchar(64)");
    expect(sites.handle.getSQLType()).toBe("varchar(255)");
    expect(sites.name.getSQLType()).toBe("longtext");
    expect(sites.branding.getSQLType()).toBe("json");
    expect(sites.hostnames.getSQLType()).toBe("json");
    expect(sites.createdAt.getSQLType()).toBe("datetime(3)");
  });
});
