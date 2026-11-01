import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable } from "../users/users.table.js";
import {
  type EntryData,
  type Revision,
  type RevisionKind,
  revisionsTable,
} from "./entries.table.js";

/** Database reads and writes for revisions, nothing else. */

export interface RevisionRow {
  id: string;
  kind: RevisionKind;
  isOpen: boolean;
  restoredFromAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string | null;
  authorName: string | null;
}

const revisionColumns = {
  id: revisionsTable.id,
  kind: revisionsTable.kind,
  isOpen: revisionsTable.isOpen,
  restoredFromAt: revisionsTable.restoredFromAt,
  createdAt: revisionsTable.createdAt,
  updatedAt: revisionsTable.updatedAt,
  authorId: usersTable.id,
  authorName: usersTable.name,
};

export interface NewRevision {
  entryId: string;
  authorId: string | null;
  kind: RevisionKind;
  data: EntryData;
  isOpen?: boolean;
  restoredFromAt?: Date | null;
  at?: Date;
}

export async function insertRevision(
  database: DatabaseOrTransaction,
  { at, ...revision }: NewRevision,
): Promise<Revision> {
  const times = at ? { createdAt: at, updatedAt: at } : {};
  const [inserted] = await database
    .insert(revisionsTable)
    .values({ ...revision, ...times })
    .returning();
  if (!inserted) {
    throw new Error("The database did not return the new revision.");
  }
  return inserted;
}

/** The entry's most recent revision, which is the only one an autosave may update. */
export async function findLatestRevision(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<Revision | undefined> {
  const [latest] = await database
    .select()
    .from(revisionsTable)
    .where(eq(revisionsTable.entryId, entryId))
    .orderBy(desc(revisionsTable.createdAt))
    .limit(1);
  return latest;
}

export async function updateOpenRevision(
  database: DatabaseOrTransaction,
  revisionId: string,
  changes: { data: EntryData; isOpen: boolean; updatedAt: Date },
): Promise<void> {
  await database.update(revisionsTable).set(changes).where(eq(revisionsTable.id, revisionId));
}

/** Nothing more joins an entry's open revision once something else happens to the entry. */
export async function closeOpenRevisions(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<void> {
  await database
    .update(revisionsTable)
    .set({ isOpen: false })
    .where(and(eq(revisionsTable.entryId, entryId), eq(revisionsTable.isOpen, true)));
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
