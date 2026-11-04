import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import {
  type NewPrivacyRequestRow,
  type PrivacyRequestRow,
  privacyRequestsTable as privacyRequestsDefinition,
} from "./privacy.table.js";
import { insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { likeIgnoringCase } from "../database/dialect/expressions.js";

/** Database reads and writes for the record of privacy requests, nothing else. */

export async function insertPrivacyRequest(
  database: DatabaseOrTransaction,
  request: NewPrivacyRequestRow,
): Promise<PrivacyRequestRow> {
  const privacyRequestsTable = tableFor(database, privacyRequestsDefinition);
  const [inserted] = await insertReturning(database, privacyRequestsTable, request);
  if (!inserted) throw new Error("The database did not return the privacy request record.");
  return inserted;
}

export function listPrivacyRequests(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<PrivacyRequestRow[]> {
  const privacyRequestsTable = tableFor(database, privacyRequestsDefinition);
  return database
    .select()
    .from(privacyRequestsTable)
    .where(eq(privacyRequestsTable.tenantId, tenantId))
    .orderBy(desc(privacyRequestsTable.createdAt))
    .limit(limit);
}

/**
 * The site's privacy page: the one the cookie notice links to, or else a published page
 * whose address has "privacy" in it. Only its published content is read.
 */
export async function findPrivacyPage(
  database: DatabaseOrTransaction,
  tenantId: string,
  pageId: string | null,
): Promise<{ id: string; slug: string; publishedData: unknown } | undefined> {
  const entriesTable = tableFor(database, entriesDefinition);
  const columns = {
    id: entriesTable.id,
    slug: entriesTable.slug,
    publishedData: entriesTable.publishedData,
  };
  const published = and(eq(entriesTable.tenantId, tenantId), isNotNull(entriesTable.publishedData));
  if (pageId) {
    const [chosen] = await database
      .select(columns)
      .from(entriesTable)
      .where(and(published, eq(entriesTable.id, pageId)))
      .limit(1);
    if (chosen) return chosen;
  }
  const [bySlug] = await database
    .select(columns)
    .from(entriesTable)
    .where(and(published, likeIgnoringCase(database, entriesTable.slug, "%privacy%")))
    .orderBy(asc(entriesTable.createdAt))
    .limit(1);
  return bySlug;
}
