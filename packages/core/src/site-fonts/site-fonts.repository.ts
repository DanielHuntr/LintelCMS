import { and, asc, count, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type NewSiteFontRow, type SiteFontRow, siteFontsTable } from "./site-fonts.table.js";

/** Database reads and writes for site fonts, nothing else. */

export async function listSiteFontRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
): Promise<SiteFontRow[]> {
  return database
    .select()
    .from(siteFontsTable)
    .where(and(eq(siteFontsTable.tenantId, tenantId), eq(siteFontsTable.siteId, siteId)))
    .orderBy(asc(siteFontsTable.createdAt), asc(siteFontsTable.sortOrder));
}

/** Every site's fonts, for finding which still use a file. */
export async function listAllSiteFontRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<SiteFontRow[]> {
  return database.select().from(siteFontsTable).where(eq(siteFontsTable.tenantId, tenantId));
}

export async function findSiteFontRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  fontId: string,
): Promise<SiteFontRow | undefined> {
  const [row] = await database
    .select()
    .from(siteFontsTable)
    .where(
      and(
        eq(siteFontsTable.tenantId, tenantId),
        eq(siteFontsTable.siteId, siteId),
        eq(siteFontsTable.id, fontId),
      ),
    )
    .limit(1);
  return row;
}

export async function findSiteFontRowByFamily(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  family: string,
): Promise<SiteFontRow | undefined> {
  const [row] = await database
    .select()
    .from(siteFontsTable)
    .where(
      and(
        eq(siteFontsTable.tenantId, tenantId),
        eq(siteFontsTable.siteId, siteId),
        sql`lower(${siteFontsTable.family}) = lower(${family})`,
      ),
    )
    .limit(1);
  return row;
}

/** How many fonts a site has. */
export async function countSiteFontRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
): Promise<number> {
  const [row] = await database
    .select({ total: count() })
    .from(siteFontsTable)
    .where(and(eq(siteFontsTable.tenantId, tenantId), eq(siteFontsTable.siteId, siteId)));
  return row?.total ?? 0;
}

export async function insertSiteFontRow(
  database: DatabaseOrTransaction,
  row: NewSiteFontRow,
): Promise<SiteFontRow> {
  const [inserted] = await database.insert(siteFontsTable).values(row).returning();
  if (!inserted) throw new Error("The font could not be saved.");
  return inserted;
}

export async function updateSiteFontRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  fontId: string,
  changes: Partial<
    Pick<NewSiteFontRow, "category" | "files" | "licenceConfirmedAt" | "licenceConfirmedBy">
  >,
): Promise<SiteFontRow> {
  const [updated] = await database
    .update(siteFontsTable)
    .set(changes)
    .where(and(eq(siteFontsTable.tenantId, tenantId), eq(siteFontsTable.id, fontId)))
    .returning();
  if (!updated) throw new Error("The font could not be saved.");
  return updated;
}

export async function deleteSiteFontRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  fontId: string,
): Promise<void> {
  await database
    .delete(siteFontsTable)
    .where(and(eq(siteFontsTable.tenantId, tenantId), eq(siteFontsTable.id, fontId)));
}

/** Removes every family of one Adobe project from a site. */
export async function deleteAdobeProjectRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  projectId: string,
): Promise<void> {
  await database
    .delete(siteFontsTable)
    .where(
      and(
        eq(siteFontsTable.tenantId, tenantId),
        eq(siteFontsTable.siteId, siteId),
        eq(siteFontsTable.source, "adobe"),
        eq(siteFontsTable.sourceId, projectId),
      ),
    );
}
