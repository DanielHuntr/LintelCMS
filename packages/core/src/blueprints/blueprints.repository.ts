import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type Blueprint,
  blueprintsTable as blueprintsDefinition,
  type NewBlueprint,
} from "./blueprints.table.js";
import {
  insertIfNewReturning,
  insertReturning,
  updateReturning,
} from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for blueprints, nothing else. */

export async function listBlueprintRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Blueprint[]> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  return database
    .select()
    .from(blueprintsTable)
    .where(eq(blueprintsTable.tenantId, tenantId))
    .orderBy(asc(blueprintsTable.name));
}

export async function findBlueprintByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Blueprint | undefined> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const [blueprint] = await database
    .select()
    .from(blueprintsTable)
    .where(and(eq(blueprintsTable.tenantId, tenantId), eq(blueprintsTable.handle, handle)))
    .limit(1);
  return blueprint;
}

export async function findBlueprintById(
  database: DatabaseOrTransaction,
  blueprintId: string,
): Promise<Blueprint | undefined> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const [blueprint] = await database
    .select()
    .from(blueprintsTable)
    .where(eq(blueprintsTable.id, blueprintId))
    .limit(1);
  return blueprint;
}

export async function insertBlueprint(
  database: DatabaseOrTransaction,
  blueprint: NewBlueprint,
): Promise<Blueprint> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const [inserted] = await insertReturning(database, blueprintsTable, blueprint);
  if (!inserted) {
    throw new Error("The database did not return the new blueprint.");
  }
  return inserted;
}

/** Inserts the blueprint unless one with its handle exists; returns undefined if it did. */
export async function insertBlueprintIfMissing(
  database: DatabaseOrTransaction,
  blueprint: NewBlueprint,
): Promise<Blueprint | undefined> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const [inserted] = await insertIfNewReturning(database, blueprintsTable, blueprint, {
    target: [blueprintsTable.tenantId, blueprintsTable.handle],
  });
  return inserted;
}

/** Saves a new name and fields, and moves the version on by one. */
export async function updateBlueprintFields(
  database: DatabaseOrTransaction,
  blueprintId: string,
  changes: Pick<Blueprint, "name" | "fields">,
): Promise<Blueprint> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  const [updated] = await updateReturning(
    database,
    blueprintsTable,
    { ...changes, version: sql`${blueprintsTable.version} + 1` },
    eq(blueprintsTable.id, blueprintId),
  );
  if (!updated) {
    throw new Error("The database did not return the updated blueprint.");
  }
  return updated;
}

export async function deleteBlueprintRow(
  database: DatabaseOrTransaction,
  blueprintId: string,
): Promise<void> {
  const blueprintsTable = tableFor(database, blueprintsDefinition);
  await database.delete(blueprintsTable).where(eq(blueprintsTable.id, blueprintId));
}
