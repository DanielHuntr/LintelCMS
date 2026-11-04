import { createEmptyPage, type PageDocument, validatePageDocument } from "@lintel/builder-model";
import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findEntryById, updateEntryRowAtVersion } from "../entries/entries.repository.js";
import { hasUnpublishedChanges } from "../entries/entry-responses.js";
import { type EntryChangeContext, validateForCollection } from "../entries/entries.service.js";
import type { Entry } from "../entries/entries.table.js";
import { recordEdit } from "../entries/revision-log.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { liveLimits } from "./live-limits.js";

/** A design as it is stored, for opening or for seeing what changed. */
export interface StoredDesign {
  entry: Entry;
  document: PageDocument;
}

/** The entry and its design, or null if there's no such entry or field, or it can't be read. */
export async function readStoredDesign(
  database: DatabaseOrTransaction,
  entryId: string,
  fieldHandle: string,
): Promise<StoredDesign | null> {
  const entry = await findEntryById(database, entryId);
  if (!entry) return null;
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  const isPageField = blueprint.fields.some(
    (field) => field.handle === fieldHandle && field.type === "page",
  );
  if (!isPageField) return null;
  const stored = entry.data[fieldHandle];
  if (stored === null || stored === undefined) return { entry, document: createEmptyPage() };
  const checked = validatePageDocument(stored, pageComponentCatalogue);
  return checked.ok ? { entry, document: checked.document } : null;
}

/**
 * Checks one person's change to a design, by the same rules as a save: the design has to be
 * valid, and it goes through what that person may change (code, and for clients, the design).
 * Throws what a save would. This runs on every message, so the server decides, whatever the
 * person's browser did or didn't offer them.
 */
export async function checkDesignChange(
  database: DatabaseOrTransaction,
  entry: Entry,
  fieldHandle: string,
  before: PageDocument,
  after: PageDocument,
  context: Pick<EntryChangeContext, "assetExists" | "permissions">,
): Promise<void> {
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  await validateForCollection(
    database,
    collection,
    { ...entry.data, [fieldHandle]: after },
    context,
    "saving",
    {
      previousData: { ...entry.data, [fieldHandle]: before },
      entryId: entry.id,
      locale: entry.locale,
    },
  );
}

export interface StoredResult {
  entry: Entry;
  hasUnpublishedChanges: boolean;
}

/**
 * Writes a design everyone has been editing into the entry, like a save. Each step was checked
 * against the person who made it, so what may be changed isn't asked again here: nobody is
 * "the person" for a page several people made. The design itself is still checked.
 *
 * Like a save, it only goes over the version it knows: "moved" means the entry has changed
 * since, and the room has to take that in first, or it would put back what was replaced.
 */
export async function storeDesign(
  database: DatabaseOrTransaction,
  entryId: string,
  fieldHandle: string,
  document: PageDocument,
  context: Pick<EntryChangeContext, "assetExists"> & {
    authorId: string | null;
    expectedVersion: number;
  },
): Promise<StoredResult | "moved" | null> {
  const entry = await findEntryById(database, entryId);
  if (!entry) return null;
  if (entry.version !== context.expectedVersion) return "moved";
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const data = await validateForCollection(
    database,
    collection,
    { ...entry.data, [fieldHandle]: document },
    { assetExists: context.assetExists },
  );
  const updated = await database.transaction(async (transaction) => {
    const row = await updateEntryRowAtVersion(transaction, entry.id, entry.version, {
      data,
      updatedBy: context.authorId,
    });
    if (!row) return undefined;
    await recordEdit(transaction, {
      entryId: entry.id,
      authorId: context.authorId,
      data,
      saveVersion: false,
      joinOthersWithinMs: liveLimits.shareHistoryLineForMilliseconds,
    });
    return row;
  });
  if (!updated) return "moved";
  return { entry: updated, hasUnpublishedChanges: hasUnpublishedChanges(updated) };
}
