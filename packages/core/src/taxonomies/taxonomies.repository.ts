import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewTaxonomy,
  type Taxonomy,
  taxonomiesTable as taxonomiesDefinition,
  termsTable as termsDefinition,
} from "./taxonomies.table.js";
import { insertIfNewReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for taxonomies, nothing else. Terms are in terms.repository.ts. */

export type TaxonomyWithCount = Taxonomy & { termCount: number };

// Spelled out in full: without a join, Drizzle leaves column names unqualified, and inside
// the subquery a bare "id" would mean the term's.
function termCountColumn(database: DatabaseOrTransaction) {
  const termsTable = tableFor(database, termsDefinition);
  return sql<number>`(
    select count(*) from ${termsTable}
    where ${termsTable.taxonomyId} = ${sql.identifier("taxonomies")}.${sql.identifier("id")}
  )`.mapWith(Number);
}

export async function listTaxonomiesWithCounts(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<TaxonomyWithCount[]> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  const rows = await database
    .select({ taxonomy: taxonomiesTable, termCount: termCountColumn(database) })
    .from(taxonomiesTable)
    .where(eq(taxonomiesTable.tenantId, tenantId))
    .orderBy(asc(taxonomiesTable.name));
  return rows.map(({ taxonomy, termCount }) => ({ ...taxonomy, termCount }));
}

export async function findTaxonomyWithCount(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<TaxonomyWithCount | undefined> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  const [row] = await database
    .select({ taxonomy: taxonomiesTable, termCount: termCountColumn(database) })
    .from(taxonomiesTable)
    .where(and(eq(taxonomiesTable.tenantId, tenantId), eq(taxonomiesTable.handle, handle)))
    .limit(1);
  return row ? { ...row.taxonomy, termCount: row.termCount } : undefined;
}

export async function findTaxonomyByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Taxonomy | undefined> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  const [taxonomy] = await database
    .select()
    .from(taxonomiesTable)
    .where(and(eq(taxonomiesTable.tenantId, tenantId), eq(taxonomiesTable.handle, handle)))
    .limit(1);
  return taxonomy;
}

export async function findTaxonomyById(
  database: DatabaseOrTransaction,
  taxonomyId: string,
): Promise<Taxonomy | undefined> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  const [taxonomy] = await database
    .select()
    .from(taxonomiesTable)
    .where(eq(taxonomiesTable.id, taxonomyId))
    .limit(1);
  return taxonomy;
}

/** Inserts the taxonomy unless one with its handle exists; returns undefined if it did. */
export async function insertTaxonomyIfMissing(
  database: DatabaseOrTransaction,
  taxonomy: NewTaxonomy,
): Promise<Taxonomy | undefined> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  const [inserted] = await insertIfNewReturning(database, taxonomiesTable, taxonomy, {
    target: [taxonomiesTable.tenantId, taxonomiesTable.handle],
  });
  return inserted;
}

export async function updateTaxonomyRow(
  database: DatabaseOrTransaction,
  taxonomyId: string,
  changes: Partial<Pick<Taxonomy, "name" | "siteId">>,
): Promise<void> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  await database
    .update(taxonomiesTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(taxonomiesTable.id, taxonomyId));
}

/** Its terms go with it (the foreign key cascades). */
export async function deleteTaxonomyRow(
  database: DatabaseOrTransaction,
  taxonomyId: string,
): Promise<void> {
  const taxonomiesTable = tableFor(database, taxonomiesDefinition);
  await database.delete(taxonomiesTable).where(eq(taxonomiesTable.id, taxonomyId));
}
