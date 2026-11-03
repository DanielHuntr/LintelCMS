import { z } from "zod";

/** Requests, responses and settings for the Instagram add-on. */

/** The add-on's settings, drawn as a form on the Add-ons screen. */
export const instagramSettingsSchema = z.object({
  postCount: z
    .number({ error: "How many posts should be a number" })
    .int({ error: "How many posts should be a whole number" })
    .min(3, { error: "Show at least 3 posts" })
    .max(24, { error: "Show at most 24 posts" })
    .meta({ title: "How many posts to keep" }),
});
export type InstagramSettings = z.output<typeof instagramSettingsSchema>;
export const defaultInstagramSettings: InstagramSettings = { postCount: 12 };

export const connectRequestSchema = z.object({
  accessToken: z
    .string({ error: "Paste your access token" })
    .trim()
    .min(20, { error: "That looks too short to be an access token. Copy all of it." })
    .max(1000, { error: "That looks too long to be an access token" })
    .regex(/^[A-Za-z0-9_\-|.]+$/, {
      error: "An access token is letters and numbers only. Check nothing else was copied with it.",
    }),
});

export const altTextRequestSchema = z.object({
  altText: z
    .string({ error: "The description should be text" })
    .trim()
    .max(300, { error: "Keep the description under 300 characters" }),
});

export const postIdParamsSchema = z.object({ id: z.uuid() });

/** The account as the admin sees it: never the token, only its last few characters. */
export interface InstagramAccountSummary {
  connected: boolean;
  username: string | null;
  tokenHint: string | null;
  tokenRefreshedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  postCount: number;
}

/** A post for the admin's preview, with its picture's full address on the API. */
export interface AdminInstagramPost {
  id: string;
  image: string;
  caption: string;
  altText: string;
  permalink: string;
  mediaType: string;
  postedAt: string;
}

/** A post for the website, with its picture at the website's own address. */
export interface PublicInstagramPost {
  id: string;
  image: string;
  alt: string;
  permalink: string;
  postedAt: string;
}
