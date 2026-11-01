import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { NotReadyToPublishError, ScheduleInPastError } from "./entries.errors.js";
import { updateEntryRow } from "./entries.repository.js";
import { findDueScheduledEntryIds, publishIfStillDue } from "./entry-publishing.repository.js";
import type { EntryResponse } from "./entries.schema.js";
import {
  type EntryChangeContext,
  findEntry,
  findEntryOrFail,
  validateForCollection,
} from "./entries.service.js";
import { insertRevision } from "./revisions.repository.js";

/**
 * Publishing copies the saved values into `publishedData`, which is all the public
 * delivery API ever serves. Saving afterwards changes only `data`, so the site keeps
 * showing the published version until the next publish.
 */

/** Puts the saved values live now, and cancels any schedule. */
export async function publishEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  context: EntryChangeContext,
  now = new Date(),
): Promise<EntryResponse> {
  const authorId = context.authorId;
  const entry = await findEntryOrFail(database, entryId);
  await checkReadyToPublish(database, entry, context);
  await database.transaction(async (transaction) => {
    await updateEntryRow(transaction, entry.id, {
      status: "published",
      publishedData: entry.data,
      publishedAt: now,
      scheduledFor: null,
    });
    await insertRevision(transaction, {
      entryId: entry.id,
      authorId,
      action: "published",
      data: entry.data,
    });
  });
  return findEntry(database, entry.id);
}

/** Takes the entry off the site and back to a draft. Its saved values are kept. */
export async function unpublishEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  authorId: string | null,
): Promise<EntryResponse> {
  const entry = await findEntryOrFail(database, entryId);
  await database.transaction(async (transaction) => {
    await updateEntryRow(transaction, entry.id, {
      status: "draft",
      publishedData: null,
      publishedAt: null,
      scheduledFor: null,
    });
    await insertRevision(transaction, {
      entryId: entry.id,
      authorId,
      action: "unpublished",
      data: entry.data,
    });
  });
  return findEntry(database, entry.id);
}

/**
 * Sets the entry to publish its saved values at `publishAt`. If an earlier version is
 * live, it stays live until then. publishDueEntries does the publishing.
 */
export async function scheduleEntry(
  database: DatabaseOrTransaction,
  entryId: string,
  publishAt: Date,
  context: Pick<EntryChangeContext, "assetExists">,
  now = new Date(),
): Promise<EntryResponse> {
  if (publishAt.getTime() <= now.getTime()) {
    throw new ScheduleInPastError();
  }
  const entry = await findEntryOrFail(database, entryId);
  await checkReadyToPublish(database, entry, context);
  await updateEntryRow(database, entry.id, { status: "scheduled", scheduledFor: publishAt });
  return findEntry(database, entry.id);
}

/**
 * Publishes every scheduled entry whose time has passed, each with a "published"
 * revision. The entry's publish date is the time it was scheduled for, not when this
 * happened to run. Returns the ids it published.
 *
 * Run by the scheduler (see src/scheduler) on startup and every minute; safe to run
 * from several servers at once, since each entry is claimed in a single update.
 */
export async function publishDueEntries(
  database: DatabaseOrTransaction,
  now = new Date(),
): Promise<string[]> {
  const published: string[] = [];
  for (const entryId of await findDueScheduledEntryIds(database, now)) {
    const wasPublished = await database.transaction(async (transaction) => {
      const entry = await publishIfStillDue(transaction, entryId, now);
      if (entry) {
        // Nobody pressed a button just now, so the revision has no author.
        await insertRevision(transaction, {
          entryId,
          authorId: null,
          action: "published",
          data: entry.data,
        });
      }
      return entry !== undefined;
    });
    if (wasPublished) {
      published.push(entryId);
    }
  }
  return published;
}

/**
 * Saved drafts may leave required fields empty. Before anything goes live (or is set to)
 * the saved values are checked again with every rule, required fields included.
 */
async function checkReadyToPublish(
  database: DatabaseOrTransaction,
  entry: { collectionId: string; data: Record<string, unknown> },
  context: Pick<EntryChangeContext, "assetExists">,
): Promise<void> {
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  try {
    await validateForCollection(database, collection, entry.data, context, "publishing");
  } catch (error) {
    if (error instanceof InvalidFieldsError) {
      throw new NotReadyToPublishError(error.fields);
    }
    throw error;
  }
}
