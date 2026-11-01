import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import { type EntrySeoRow, entrySeoTable } from "./seo.table.js";

/** Database reads and writes for entries' SEO settings and the sitemap. */

export async function findEntrySeoRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
): Promise<EntrySeoRow | undefined> {
  const [row] = await database
    .select()
    .from(entrySeoTable)
    .where(and(eq(entrySeoTable.tenantId, tenantId), eq(entrySeoTable.entryId, entryId)))
    .limit(1);
  return row;
}

export async function upsertEntrySeoRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
  values: Pick<EntrySeoRow, "title" | "description" | "socialImageId" | "noindex">,
): Promise<void> {
  await database
    .insert(entrySeoTable)
    .values({ tenantId, entryId, ...values })
    .onConflictDoUpdate({
      target: [entrySeoTable.tenantId, entrySeoTable.entryId],
      set: { ...values, updatedAt: new Date() },
    });
}

export interface SitemapEntryRow {
  id: string;
  slug: string;
  locale: string;
  routePattern: string;
  publishedAt: Date | null;
  updatedAt: Date;
  noindex: boolean | null;
}

/** Every published entry in a collection that has pages, with its noindex setting. */
/**
 * The published entries one site shows: its own in per-site collections, and those of
 * shared collections, kept with the default site. Without sites given, every entry.
 */
export async function listSitemapEntryRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
  sites?: { siteId: string; defaultSiteId: string },
): Promise<SitemapEntryRow[]> {
  const rows = await database
    .select({
      id: entriesTable.id,
      slug: entriesTable.slug,
      locale: entriesTable.locale,
      routePattern: collectionsTable.routePattern,
      publishedAt: entriesTable.publishedAt,
      updatedAt: entriesTable.updatedAt,
      noindex: entrySeoTable.noindex,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .leftJoin(entrySeoTable, eq(entrySeoTable.entryId, entriesTable.id))
    .where(
      and(
        eq(entriesTable.tenantId, tenantId),
        isNotNull(entriesTable.publishedData),
        isNotNull(collectionsTable.routePattern),
        sites
          ? or(
              and(
                eq(collectionsTable.siteScope, "per-site"),
                eq(entriesTable.siteId, sites.siteId),
              ),
              and(
                eq(collectionsTable.siteScope, "shared"),
                eq(entriesTable.siteId, sites.defaultSiteId),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(asc(collectionsTable.handle), asc(entriesTable.sortOrder), asc(entriesTable.createdAt))
    .limit(limit);
  return rows.flatMap((row) =>
    row.routePattern === null ? [] : [{ ...row, routePattern: row.routePattern }],
  );
}
