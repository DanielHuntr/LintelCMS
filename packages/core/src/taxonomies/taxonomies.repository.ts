import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewTaxonomy,
  type Taxonomy,
  taxonomiesTable,
  termsTable,
} from "./taxonomies.table.js";

/** Database reads and writes for taxonomies, nothing else. Terms are in terms.repository.ts. */

export type TaxonomyWithCount = Taxonomy & { termCount: number };

// Spelled out in full: without a join, Drizzle leaves column names unqualified, and inside
// the subquery a bare "id" would mean the term's.
const termCountColumn = sql<number>`(
  select count(*) from ${termsTable}
  where ${termsTable.taxonomyId} = ${sql.identifier("taxonomies")}.${sql.identifier("id")}
)`.mapWith(Number);

export async function listTaxonomiesWithCounts(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<TaxonomyWithCount[]> {
  const rows = await database
    .select({ taxonomy: taxonomiesTable, termCount: termCountColumn })
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
  const [row] = await database
    .select({ taxonomy: taxonomiesTable, termCount: termCountColumn })
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
  const [inserted] = await database
    .insert(taxonomiesTable)
    .values(taxonomy)
    .onConflictDoNothing({ target: [taxonomiesTable.tenantId, taxonomiesTable.handle] })
    .returning();
  return inserted;
}

export async function updateTaxonomyRow(
  database: DatabaseOrTransaction,
  taxonomyId: string,
  changes: Partial<Pick<Taxonomy, "name" | "siteId">>,
): Promise<void> {
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
  await database.delete(taxonomiesTable).where(eq(taxonomiesTable.id, taxonomyId));
}
