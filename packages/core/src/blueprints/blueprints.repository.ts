import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type Blueprint, blueprintsTable, type NewBlueprint } from "./blueprints.table.js";

/** Database reads and writes for blueprints, nothing else. */

export async function listBlueprintRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Blueprint[]> {
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
  const [inserted] = await database.insert(blueprintsTable).values(blueprint).returning();
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
  const [inserted] = await database
    .insert(blueprintsTable)
    .values(blueprint)
    .onConflictDoNothing({ target: [blueprintsTable.tenantId, blueprintsTable.handle] })
    .returning();
  return inserted;
}

/** Saves a new name and fields, and moves the version on by one. */
export async function updateBlueprintFields(
  database: DatabaseOrTransaction,
  blueprintId: string,
  changes: Pick<Blueprint, "name" | "fields">,
): Promise<Blueprint> {
  const [updated] = await database
    .update(blueprintsTable)
    .set({ ...changes, version: sql`${blueprintsTable.version} + 1` })
    .where(eq(blueprintsTable.id, blueprintId))
    .returning();
  if (!updated) {
    throw new Error("The database did not return the updated blueprint.");
  }
  return updated;
}

export async function deleteBlueprintRow(
  database: DatabaseOrTransaction,
  blueprintId: string,
): Promise<void> {
  await database.delete(blueprintsTable).where(eq(blueprintsTable.id, blueprintId));
}
