import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable } from "../users/users.table.js";
import {
  type EntryData,
  type Revision,
  type RevisionAction,
  revisionsTable,
} from "./entries.table.js";

/** Database reads and writes for revisions, nothing else. */

export interface RevisionRow {
  id: string;
  action: RevisionAction;
  createdAt: Date;
  authorId: string | null;
  authorName: string | null;
}

const revisionColumns = {
  id: revisionsTable.id,
  action: revisionsTable.action,
  createdAt: revisionsTable.createdAt,
  authorId: usersTable.id,
  authorName: usersTable.name,
};

export async function insertRevision(
  database: DatabaseOrTransaction,
  revision: { entryId: string; authorId: string | null; action: RevisionAction; data: EntryData },
): Promise<Revision> {
  const [inserted] = await database.insert(revisionsTable).values(revision).returning();
  if (!inserted) {
    throw new Error("The database did not return the new revision.");
  }
  return inserted;
}

export async function listRevisionsForEntry(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<RevisionRow[]> {
  return database
    .select(revisionColumns)
    .from(revisionsTable)
    .leftJoin(usersTable, eq(usersTable.id, revisionsTable.authorId))
    .where(eq(revisionsTable.entryId, entryId))
    .orderBy(desc(revisionsTable.createdAt));
}

export async function findRevisionForEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  revisionId: string,
): Promise<(RevisionRow & { data: EntryData }) | undefined> {
  const [revision] = await database
    .select({ ...revisionColumns, data: revisionsTable.data })
    .from(revisionsTable)
    .leftJoin(usersTable, eq(usersTable.id, revisionsTable.authorId))
    .where(and(eq(revisionsTable.entryId, entryId), eq(revisionsTable.id, revisionId)))
    .limit(1);
  return revision;
}
