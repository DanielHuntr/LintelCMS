import { customType, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "@lintel/core/plugin";

/**
 * The Instagram add-on's tables. Like every Lintel table each has `tenantId` (see Lintel's
 * docs/decisions/0003), and their names start with the add-on's id, as Lintel asks.
 */

/** Raw bytes: the posts' pictures, kept here so visitors never load them from Instagram. */
const bytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => new Uint8Array(value),
});

/** The Instagram account a site shows, at most one per tenant. */
export const instagramAccountTable = pgTable(
  "instagram_account",
  {
    id: id(),
    tenantId: tenantId(),
    /** The long-lived access token the owner pasted. Never sent back to the admin. */
    accessToken: text("access_token").notNull(),
    instagramUserId: text("instagram_user_id").notNull(),
    username: text("username").notNull(),
    tokenRefreshedAt: timestamp("token_refreshed_at", { withTimezone: true }).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** What went wrong at the last try, in plain words; null when it worked. */
    lastError: text("last_error"),
    ...timestamps(),
  },
  (table) => [uniqueIndex("instagram_account_tenant_idx").on(table.tenantId)],
);

/** One post, with its picture. Only the newest few are kept. */
export const instagramPostsTable = pgTable(
  "instagram_posts",
  {
    id: id(),
    tenantId: tenantId(),
    instagramId: text("instagram_id").notNull(),
    caption: text("caption").notNull().default(""),
    permalink: text("permalink").notNull(),
    /** IMAGE, VIDEO or CAROUSEL_ALBUM, as Instagram says. */
    mediaType: text("media_type").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    image: bytes("image").notNull(),
    imageType: text("image_type").notNull(),
    /** A description for people who can't see the picture, written by an editor. */
    altText: text("alt_text").notNull().default(""),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("instagram_posts_tenant_instagram_id_idx").on(table.tenantId, table.instagramId),
    index("instagram_posts_tenant_posted_at_idx").on(table.tenantId, table.postedAt),
  ],
);

export type InstagramAccountRow = typeof instagramAccountTable.$inferSelect;
export type NewInstagramAccountRow = typeof instagramAccountTable.$inferInsert;
export type InstagramPostRow = typeof instagramPostsTable.$inferSelect;
export type NewInstagramPostRow = typeof instagramPostsTable.$inferInsert;
