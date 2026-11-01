import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type NewTerm, type Term, taxonomiesTable, termsTable } from "./taxonomies.table.js";

/** Database reads and writes for terms, nothing else. */

/** A term with the handle of its taxonomy, as the API and the delivery API show it. */
export type TermWithTaxonomy = Term & { taxonomyHandle: string };

function selectWithTaxonomy(database: DatabaseOrTransaction) {
  return database
    .select({ term: termsTable, taxonomyHandle: taxonomiesTable.handle })
    .from(termsTable)
    .innerJoin(taxonomiesTable, eq(taxonomiesTable.id, termsTable.taxonomyId));
}

function toTermWithTaxonomy(row: { term: Term; taxonomyHandle: string }): TermWithTaxonomy {
  return { ...row.term, taxonomyHandle: row.taxonomyHandle };
}

/** Alphabetical, the order people expect to find a category or tag in. */
export async function listTermsInTaxonomy(
  database: DatabaseOrTransaction,
  taxonomyId: string,
): Promise<TermWithTaxonomy[]> {
  const rows = await selectWithTaxonomy(database)
    .where(eq(termsTable.taxonomyId, taxonomyId))
    .orderBy(asc(sql`lower(${termsTable.title})`), asc(termsTable.createdAt));
  return rows.map(toTermWithTaxonomy);
}

export async function findTermById(
  database: DatabaseOrTransaction,
  termId: string,
): Promise<TermWithTaxonomy | undefined> {
  const [row] = await selectWithTaxonomy(database).where(eq(termsTable.id, termId)).limit(1);
  return row ? toTermWithTaxonomy(row) : undefined;
}

export async function findTermBySlug(
  database: DatabaseOrTransaction,
  taxonomyId: string,
  slug: string,
): Promise<TermWithTaxonomy | undefined> {
  const [row] = await selectWithTaxonomy(database)
    .where(and(eq(termsTable.taxonomyId, taxonomyId), eq(termsTable.slug, slug)))
    .limit(1);
  return row ? toTermWithTaxonomy(row) : undefined;
}

/** Several terms at once, in any taxonomy, for the delivery API. Unknown ids are left out. */
export async function findTermsByIds(
  database: DatabaseOrTransaction,
  termIds: readonly string[],
): Promise<TermWithTaxonomy[]> {
  if (termIds.length === 0) {
    return [];
  }
  const rows = await selectWithTaxonomy(database).where(inArray(termsTable.id, [...termIds]));
  return rows.map(toTermWithTaxonomy);
}

/** Which of these ids are terms of the taxonomy with this handle. */
export async function findTermIdsInTaxonomy(
  database: DatabaseOrTransaction,
  taxonomyHandle: string,
  termIds: readonly string[],
): Promise<string[]> {
  if (termIds.length === 0) {
    return [];
  }
  const rows = await selectWithTaxonomy(database).where(
    and(eq(taxonomiesTable.handle, taxonomyHandle), inArray(termsTable.id, [...termIds])),
  );
  return rows.map((row) => row.term.id);
}

/** Slugs in the taxonomy that are `base` or `base-<something>`. */
export async function findTermSlugsStartingWith(
  database: DatabaseOrTransaction,
  taxonomyId: string,
  base: string,
  exceptTermId?: string,
): Promise<string[]> {
  const rows = await database
    .select({ id: termsTable.id, slug: termsTable.slug })
    .from(termsTable)
    .where(
      and(
        eq(termsTable.taxonomyId, taxonomyId),
        or(eq(termsTable.slug, base), sql`${termsTable.slug} like ${`${base}-%`}`),
      ),
    );
  return rows.filter((row) => row.id !== exceptTermId).map((row) => row.slug);
}

export async function insertTerm(database: DatabaseOrTransaction, term: NewTerm): Promise<Term> {
  const [inserted] = await database.insert(termsTable).values(term).returning();
  if (!inserted) {
    throw new Error("The database did not return the new term.");
  }
  return inserted;
}

/** Inserts the term unless its taxonomy already has one with the same slug. */
export async function insertTermIfMissing(
  database: DatabaseOrTransaction,
  term: NewTerm,
): Promise<void> {
  await database
    .insert(termsTable)
    .values(term)
    .onConflictDoNothing({
      target: [termsTable.tenantId, termsTable.taxonomyId, termsTable.slug],
    });
}

export async function updateTermRow(
  database: DatabaseOrTransaction,
  termId: string,
  changes: Partial<Pick<Term, "title" | "slug" | "description">>,
): Promise<void> {
  await database
    .update(termsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(termsTable.id, termId));
}

export async function deleteTermRow(database: DatabaseOrTransaction, termId: string) {
  await database.delete(termsTable).where(eq(termsTable.id, termId));
}

export async function listTermIdsInTaxonomy(
  database: DatabaseOrTransaction,
  taxonomyId: string,
): Promise<string[]> {
  const rows = await database
    .select({ id: termsTable.id })
    .from(termsTable)
    .where(eq(termsTable.taxonomyId, taxonomyId));
  return rows.map((row) => row.id);
}
