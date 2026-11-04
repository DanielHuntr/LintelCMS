import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import {
  type DatabaseOrTransaction,
  insertIfNew,
  tableFor,
  updateReturning,
  upsertReturning,
} from "@lintel/core/plugin";
import {
  type InstagramAccountRow,
  instagramAccountTable as instagramAccountDefinition,
  type InstagramPostRow,
  instagramPostsTable as instagramPostsDefinition,
  type NewInstagramAccountRow,
  type NewInstagramPostRow,
} from "./instagram.table.js";

/** Database reads and writes for the Instagram add-on, nothing else. */

export async function findAccountRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<InstagramAccountRow | undefined> {
  const instagramAccountTable = tableFor(database, instagramAccountDefinition);
  const [row] = await database
    .select()
    .from(instagramAccountTable)
    .where(eq(instagramAccountTable.tenantId, tenantId));
  return row;
}

/** Saves the tenant's account, replacing the one it had. */
export async function saveAccountRow(
  database: DatabaseOrTransaction,
  row: NewInstagramAccountRow & { tenantId: string },
): Promise<InstagramAccountRow> {
  const instagramAccountTable = tableFor(database, instagramAccountDefinition);
  const [saved] = await upsertReturning(database, instagramAccountTable, row, {
    target: instagramAccountTable.tenantId,
    set: {
      accessToken: row.accessToken,
      instagramUserId: row.instagramUserId,
      username: row.username,
      tokenRefreshedAt: row.tokenRefreshedAt,
      lastSyncedAt: row.lastSyncedAt ?? null,
      lastError: row.lastError ?? null,
      updatedAt: new Date(),
    },
  });
  return saved as InstagramAccountRow;
}

export async function updateAccountRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  changes: Partial<
    Pick<InstagramAccountRow, "accessToken" | "tokenRefreshedAt" | "lastSyncedAt" | "lastError">
  >,
): Promise<void> {
  const instagramAccountTable = tableFor(database, instagramAccountDefinition);
  await database
    .update(instagramAccountTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(instagramAccountTable.tenantId, tenantId));
}

export async function deleteAccountRow(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<void> {
  const instagramAccountTable = tableFor(database, instagramAccountDefinition);
  await database.delete(instagramAccountTable).where(eq(instagramAccountTable.tenantId, tenantId));
}

/** The posts without their pictures, newest first. */
export async function listPostRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit?: number,
): Promise<Omit<InstagramPostRow, "image">[]> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  const query = database
    .select({
      id: instagramPostsTable.id,
      tenantId: instagramPostsTable.tenantId,
      instagramId: instagramPostsTable.instagramId,
      caption: instagramPostsTable.caption,
      permalink: instagramPostsTable.permalink,
      mediaType: instagramPostsTable.mediaType,
      postedAt: instagramPostsTable.postedAt,
      imageType: instagramPostsTable.imageType,
      altText: instagramPostsTable.altText,
      createdAt: instagramPostsTable.createdAt,
      updatedAt: instagramPostsTable.updatedAt,
    })
    .from(instagramPostsTable)
    .where(eq(instagramPostsTable.tenantId, tenantId))
    .orderBy(desc(instagramPostsTable.postedAt));
  return limit === undefined ? query : query.limit(limit);
}

export async function findPostPicture(
  database: DatabaseOrTransaction,
  tenantId: string,
  postId: string,
): Promise<Pick<InstagramPostRow, "image" | "imageType"> | undefined> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  const [row] = await database
    .select({ image: instagramPostsTable.image, imageType: instagramPostsTable.imageType })
    .from(instagramPostsTable)
    .where(and(eq(instagramPostsTable.tenantId, tenantId), eq(instagramPostsTable.id, postId)));
  return row;
}

/** The Instagram ids of the posts already kept, from those given. */
export async function findKeptInstagramIds(
  database: DatabaseOrTransaction,
  tenantId: string,
  instagramIds: readonly string[],
): Promise<Set<string>> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  if (instagramIds.length === 0) return new Set();
  const rows = await database
    .select({ instagramId: instagramPostsTable.instagramId })
    .from(instagramPostsTable)
    .where(
      and(
        eq(instagramPostsTable.tenantId, tenantId),
        inArray(instagramPostsTable.instagramId, [...instagramIds]),
      ),
    );
  return new Set(rows.map((row) => row.instagramId));
}

export async function insertPostRow(
  database: DatabaseOrTransaction,
  row: NewInstagramPostRow & { tenantId: string },
): Promise<void> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  await insertIfNew(database, instagramPostsTable, row);
}

/** Instagram may change a caption; the picture and the editor's description stay. */
export async function updatePostDetails(
  database: DatabaseOrTransaction,
  tenantId: string,
  instagramId: string,
  details: Pick<InstagramPostRow, "caption" | "permalink">,
): Promise<void> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  await database
    .update(instagramPostsTable)
    .set({ ...details, updatedAt: new Date() })
    .where(
      and(
        eq(instagramPostsTable.tenantId, tenantId),
        eq(instagramPostsTable.instagramId, instagramId),
      ),
    );
}

export async function updatePostAltText(
  database: DatabaseOrTransaction,
  tenantId: string,
  postId: string,
  altText: string,
): Promise<boolean> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  const updated = await updateReturning(
    database,
    instagramPostsTable,
    { altText, updatedAt: new Date() },
    and(eq(instagramPostsTable.tenantId, tenantId), eq(instagramPostsTable.id, postId)),
    { id: instagramPostsTable.id },
  );
  return updated.length > 0;
}

/** Deletes every post but those given (all of them when none are). */
export async function deletePostRowsExcept(
  database: DatabaseOrTransaction,
  tenantId: string,
  keptInstagramIds: readonly string[],
): Promise<void> {
  const instagramPostsTable = tableFor(database, instagramPostsDefinition);
  await database
    .delete(instagramPostsTable)
    .where(
      and(
        eq(instagramPostsTable.tenantId, tenantId),
        keptInstagramIds.length > 0
          ? notInArray(instagramPostsTable.instagramId, [...keptInstagramIds])
          : undefined,
      ),
    );
}
