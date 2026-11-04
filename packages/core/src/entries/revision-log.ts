import type { DatabaseOrTransaction } from "../database/client.js";
import type { EntryData, RevisionKind } from "./entries.table.js";
import {
  closeOpenRevisions,
  findLatestRevision,
  insertRevision,
  updateOpenRevision,
} from "./revisions.repository.js";

/**
 * How revisions are written. Autosave sends a save every few seconds while someone types,
 * so a revision per save would bury the history. Instead each person's run of edits goes
 * into one open "edited" revision, updated in place. A new revision starts when:
 *
 *   - someone else edits the entry;
 *   - the open revision is 30 minutes old;
 *   - the person presses Save version (Cmd/Ctrl+S), which closes the revision it saves into;
 *   - anything else happens: publish, unpublish, schedule or restore.
 *
 * See docs/decisions/0011-coalesced-revisions.md.
 */

export const OPEN_REVISION_LIFETIME_MS = 30 * 60 * 1000;

export interface RecordedEdit {
  entryId: string;
  authorId: string | null;
  data: EntryData;
  /** Save version: keep this as a revision of its own; the next edit starts a new one. */
  saveVersion: boolean;
  now?: Date;
  /**
   * People editing together: their stores alternate every few seconds, so an open revision
   * younger than this takes the next person's too, rather than History gaining a line each time.
   */
  joinOthersWithinMs?: number;
}

export async function recordEdit(
  database: DatabaseOrTransaction,
  { entryId, authorId, data, saveVersion, now = new Date(), joinOthersWithinMs = 0 }: RecordedEdit,
): Promise<void> {
  const latest = await findLatestRevision(database, entryId);
  const canJoin =
    latest !== undefined &&
    latest.kind === "edited" &&
    latest.isOpen &&
    authorId !== null &&
    now.getTime() - latest.createdAt.getTime() <
      (latest.authorId === authorId ? OPEN_REVISION_LIFETIME_MS : joinOthersWithinMs);

  if (canJoin) {
    await updateOpenRevision(database, latest.id, { data, isOpen: !saveVersion, updatedAt: now });
    return;
  }
  await closeOpenRevisions(database, entryId);
  await insertRevision(database, {
    entryId,
    authorId,
    kind: "edited",
    data,
    isOpen: !saveVersion,
    at: now,
  });
}

/** Publishing, unpublishing, scheduling and restoring each get a revision of their own. */
export async function recordEvent(
  database: DatabaseOrTransaction,
  event: {
    entryId: string;
    authorId: string | null;
    kind: Exclude<RevisionKind, "edited">;
    data: EntryData;
    restoredFromAt?: Date;
    now?: Date;
  },
): Promise<void> {
  await closeOpenRevisions(database, event.entryId);
  await insertRevision(database, {
    entryId: event.entryId,
    authorId: event.authorId,
    kind: event.kind,
    data: event.data,
    restoredFromAt: event.restoredFromAt ?? null,
    at: event.now,
  });
}
