import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { checkContentOnlyChange } from "../client-editing/client-editing.service.js";
import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { describePerson } from "./entry-responses.js";
import { RevisionNotFoundError } from "./entries.errors.js";
import { updateEntryRow } from "./entries.repository.js";
import type { EntryResponse, RevisionResponse, RevisionSummaryResponse } from "./entries.schema.js";
import {
  type EntryChangeContext,
  findEntry,
  findEntryOrFail,
  validateForCollection,
} from "./entries.service.js";
import type { EntryData } from "./entries.table.js";
import { recordEvent } from "./revision-log.js";
import {
  findRevisionForEntry,
  listRevisionsForEntry,
  type RevisionRow,
} from "./revisions.repository.js";

/**
 * Revisions are written through revision-log.ts: one per person's run of edits, and one
 * for each publish, unpublish, schedule and restore. This file reads them, and restores one.
 */

function describeRevision(revision: RevisionRow): RevisionSummaryResponse {
  return {
    id: revision.id,
    kind: revision.kind,
    createdAt: revision.createdAt.toISOString(),
    updatedAt: revision.updatedAt.toISOString(),
    restoredFromAt: revision.restoredFromAt?.toISOString() ?? null,
    author: describePerson(revision.authorId, revision.authorName),
  };
}

/** Newest first. */
export async function listRevisions(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<{ revisions: RevisionSummaryResponse[] }> {
  const entry = await findEntryOrFail(database, entryId);
  const revisions = await listRevisionsForEntry(database, entry.id);
  return { revisions: revisions.map(describeRevision) };
}

export async function findRevision(
  database: DatabaseOrTransaction,
  entryId: string,
  revisionId: string,
): Promise<RevisionResponse> {
  const revision = await findRevisionForEntry(database, entryId, revisionId);
  if (!revision) {
    throw new RevisionNotFoundError();
  }
  return { ...describeRevision(revision), data: revision.data };
}

/**
 * Makes an old revision's values the entry's saved values again, checked against the
 * blueprint as it is today. Like any save, it doesn't change what is published. People
 * without builder:design may restore only a revision with the same design as now.
 */
export async function restoreRevision(
  database: DatabaseOrTransaction,
  entryId: string,
  revisionId: string,
  context: EntryChangeContext,
): Promise<EntryResponse> {
  const entry = await findEntryOrFail(database, entryId);
  const revision = await findRevisionForEntry(database, entry.id, revisionId);
  if (!revision) {
    throw new RevisionNotFoundError();
  }
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const data = await validateForCollection(database, collection, revision.data, context);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  checkContentOnlyChange(blueprint.fields, entry.data, data, context.permissions);

  await database.transaction(async (transaction) => {
    await updateEntryRow(transaction, entry.id, { data, updatedBy: context.authorId });
    await recordEvent(transaction, {
      entryId: entry.id,
      authorId: context.authorId,
      kind: "restored",
      data,
      restoredFromAt: revision.createdAt,
    });
  });
  return findEntry(database, entry.id);
}

/**
 * Sets a version aside in History without saving it: what someone had when they chose another
 * person's changes over theirs. It can be restored like any other version, and restoring
 * checks it then. It joins nobody's open revision, so autosaves can't change it.
 */
export async function keepVersion(
  database: DatabaseOrTransaction,
  entryId: string,
  data: EntryData,
  authorId: string,
): Promise<void> {
  const entry = await findEntryOrFail(database, entryId);
  await recordEvent(database, { entryId: entry.id, authorId, kind: "kept", data });
}
