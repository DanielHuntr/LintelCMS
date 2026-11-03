import { DEFAULT_TENANT_ID, type DatabaseOrTransaction, HttpError } from "@lintel/core/plugin";
import type { InstagramClient } from "./instagram-api.js";
import { InstagramNotConnectedError, InstagramPostNotFoundError } from "./instagram.errors.js";
import {
  deleteAccountRow,
  deletePostRowsExcept,
  findAccountRow,
  findKeptInstagramIds,
  findPostPicture,
  insertPostRow,
  listPostRows,
  saveAccountRow,
  updateAccountRow,
  updatePostAltText,
  updatePostDetails,
} from "./instagram.repository.js";
import type {
  InstagramAccountSummary,
  InstagramSettings,
  PublicInstagramPost,
} from "./instagram.schema.js";
import type { InstagramAccountRow, InstagramPostRow } from "./instagram.table.js";

/**
 * The Instagram add-on's rules: connecting an account, copying its newest posts and their
 * pictures here, and handing them out without anything coming from Instagram on the way.
 */

const ONE_DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

/** Where the website shows a post's picture: at its own address, never Instagram's. */
export const PUBLIC_PICTURE_PATH = "/_lintel/api/addons/instagram/images";

export type InstagramPostDetails = Omit<InstagramPostRow, "image">;

export async function readAccountSummary(
  database: DatabaseOrTransaction,
  settings: InstagramSettings,
): Promise<InstagramAccountSummary> {
  return summarise(await findAccountRow(database, DEFAULT_TENANT_ID), settings);
}

/** Whether an account is connected, so the hourly job stays quiet until one is. */
export async function hasConnectedAccount(database: DatabaseOrTransaction): Promise<boolean> {
  return (await findAccountRow(database, DEFAULT_TENANT_ID)) !== undefined;
}

/** Checks the token with Instagram, keeps it, and copies the newest posts straight away. */
export async function connectAccount(
  database: DatabaseOrTransaction,
  client: InstagramClient,
  accessToken: string,
  settings: InstagramSettings,
): Promise<InstagramAccountSummary> {
  const profile = await client.readProfile(accessToken);
  const previous = await findAccountRow(database, DEFAULT_TENANT_ID);
  if (previous && previous.instagramUserId !== profile.userId) {
    // Another account's posts mustn't stay on the site.
    await deletePostRowsExcept(database, DEFAULT_TENANT_ID, []);
  }
  await saveAccountRow(database, {
    tenantId: DEFAULT_TENANT_ID,
    accessToken,
    instagramUserId: profile.userId,
    username: profile.username,
    tokenRefreshedAt: new Date(),
    lastSyncedAt: null,
    lastError: null,
  });
  return syncPosts(database, client, settings);
}

/** Forgets the token and every copied post. */
export async function disconnectAccount(database: DatabaseOrTransaction): Promise<void> {
  await deletePostRowsExcept(database, DEFAULT_TENANT_ID, []);
  await deleteAccountRow(database, DEFAULT_TENANT_ID);
}

/**
 * Copies the newest posts and their pictures, and deletes older ones. A failure is kept in
 * plain words on the account (and shown in the admin) rather than thrown, so the site keeps
 * the posts it has.
 */
export async function syncPosts(
  database: DatabaseOrTransaction,
  client: InstagramClient,
  settings: InstagramSettings,
): Promise<InstagramAccountSummary> {
  const account = await findAccountRow(database, DEFAULT_TENANT_ID);
  if (!account) throw new InstagramNotConnectedError();
  try {
    const media = await client.listMedia(account.accessToken, settings.postCount);
    const instagramIds = media.map((item) => item.instagramId);
    const kept = await findKeptInstagramIds(database, DEFAULT_TENANT_ID, instagramIds);
    for (const item of media) {
      if (kept.has(item.instagramId)) {
        await updatePostDetails(database, DEFAULT_TENANT_ID, item.instagramId, {
          caption: item.caption,
          permalink: item.permalink,
        });
        continue;
      }
      const picture = await client.downloadPicture(item.pictureUrl);
      await insertPostRow(database, {
        tenantId: DEFAULT_TENANT_ID,
        instagramId: item.instagramId,
        caption: item.caption,
        permalink: item.permalink,
        mediaType: item.mediaType,
        postedAt: item.postedAt,
        image: picture.bytes,
        imageType: picture.type,
      });
    }
    await deletePostRowsExcept(database, DEFAULT_TENANT_ID, instagramIds);
    await updateAccountRow(database, DEFAULT_TENANT_ID, {
      lastSyncedAt: new Date(),
      lastError: null,
    });
  } catch (error) {
    await updateAccountRow(database, DEFAULT_TENANT_ID, { lastError: plainMessage(error) });
  }
  return readAccountSummary(database, settings);
}

/**
 * Long-lived tokens last 60 days, and Instagram swaps one at least a day old for a fresh
 * one. Doing that daily keeps the feed working for as long as the site runs.
 */
export async function refreshTokenIfDue(
  database: DatabaseOrTransaction,
  client: InstagramClient,
  now = new Date(),
): Promise<boolean> {
  const account = await findAccountRow(database, DEFAULT_TENANT_ID);
  if (!account || now.getTime() - account.tokenRefreshedAt.getTime() < ONE_DAY_MILLISECONDS) {
    return false;
  }
  try {
    const accessToken = await client.refreshToken(account.accessToken);
    await updateAccountRow(database, DEFAULT_TENANT_ID, { accessToken, tokenRefreshedAt: now });
    return true;
  } catch (error) {
    await updateAccountRow(database, DEFAULT_TENANT_ID, { lastError: plainMessage(error) });
    return false;
  }
}

export async function listPosts(
  database: DatabaseOrTransaction,
  limit?: number,
): Promise<InstagramPostDetails[]> {
  return listPostRows(database, DEFAULT_TENANT_ID, limit);
}

export async function readPicture(
  database: DatabaseOrTransaction,
  postId: string,
): Promise<{ bytes: Uint8Array; type: string }> {
  const picture = await findPostPicture(database, DEFAULT_TENANT_ID, postId);
  if (!picture) throw new InstagramPostNotFoundError();
  return { bytes: picture.image, type: picture.imageType };
}

export async function changeAltText(
  database: DatabaseOrTransaction,
  postId: string,
  altText: string,
): Promise<void> {
  if (!(await updatePostAltText(database, DEFAULT_TENANT_ID, postId, altText))) {
    throw new InstagramPostNotFoundError();
  }
}

/** The posts and username as the website shows them. */
export async function listPublicPosts(
  database: DatabaseOrTransaction,
  limit?: number,
): Promise<{ username: string | null; posts: PublicInstagramPost[] }> {
  const account = await findAccountRow(database, DEFAULT_TENANT_ID);
  if (!account) return { username: null, posts: [] };
  const posts = await listPosts(database, limit);
  return {
    username: account.username,
    posts: posts.map((post) => ({
      id: post.id,
      image: `${PUBLIC_PICTURE_PATH}/${post.id}`,
      alt: describePicture(post, account.username),
      permalink: post.permalink,
      postedAt: post.postedAt.toISOString(),
    })),
  };
}

/**
 * The picture's description: the editor's, else the caption's first line without hashtags,
 * else who posted it.
 */
export function describePicture(
  post: Pick<InstagramPostDetails, "altText" | "caption">,
  username: string,
): string {
  if (post.altText) return post.altText;
  const firstLine = (post.caption.split("\n")[0] ?? "")
    .replace(/[#@][\p{L}\p{N}_.]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!firstLine) return `A post by @${username} on Instagram`;
  return firstLine.length > 125 ? `${firstLine.slice(0, 124).trimEnd()}…` : firstLine;
}

function summarise(
  account: InstagramAccountRow | undefined,
  settings: InstagramSettings,
): InstagramAccountSummary {
  return {
    connected: account !== undefined,
    username: account?.username ?? null,
    tokenHint: account ? `…${account.accessToken.slice(-4)}` : null,
    tokenRefreshedAt: account?.tokenRefreshedAt.toISOString() ?? null,
    lastSyncedAt: account?.lastSyncedAt?.toISOString() ?? null,
    lastError: account?.lastError ?? null,
    postCount: settings.postCount,
  };
}

/** Instagram's refusals are already plain words; anything else gets a calm sentence. */
function plainMessage(error: unknown): string {
  if (error instanceof HttpError) return error.message;
  return "Something went wrong copying your posts. Lintel will try again within the hour.";
}
