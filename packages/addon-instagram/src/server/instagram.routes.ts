import {
  ADDON_PUBLIC_PREFIX,
  parseRequest,
  type PluginRouteContext,
  type PluginServer,
  requirePermission,
} from "@lintel/core/plugin";
import { z } from "zod";
import type { InstagramClient } from "./instagram-api.js";
import { InstagramPostNotFoundError } from "./instagram.errors.js";
import {
  type AdminInstagramPost,
  altTextRequestSchema,
  connectRequestSchema,
  type InstagramSettings,
  postIdParamsSchema,
} from "./instagram.schema.js";
import {
  changeAltText,
  connectAccount,
  disconnectAccount,
  listPosts,
  listPublicPosts,
  readAccountSummary,
  readPicture,
  syncPosts,
} from "./instagram.service.js";

/**
 * HTTP only. Lintel answers 404 PLUGIN_NOT_ENABLED for all of these while the add-on is off.
 *
 *   GET    /instagram/account          (settings:read)    -> the account, never its token
 *   PUT    /instagram/account          (settings:update)  { accessToken } -> checked with Instagram, posts copied
 *   DELETE /instagram/account          (settings:update)  -> 204, the token and posts forgotten
 *   POST   /instagram/sync             (settings:update)  -> the account, after copying the newest posts
 *   GET    /instagram/posts            (settings:read)    -> { posts }, for the admin's preview
 *   PATCH  /instagram/posts/:id        (settings:update)  { altText } -> 204
 *
 * For the website's visitors, at `/_lintel/api/addons/instagram/...` on the site:
 *
 *   GET    /delivery/add-ons/instagram/posts?limit=      -> { username, posts }
 *   GET    /delivery/add-ons/instagram/images/:id        -> the picture, cached for a year
 */
export function instagramRoutes(client: InstagramClient) {
  return async function registerInstagramRoutes(
    server: PluginServer,
    { readSettings }: PluginRouteContext<InstagramSettings>,
  ) {
    const canRead = { preHandler: requirePermission("settings:read") };
    const canUpdate = { preHandler: requirePermission("settings:update") };
    const settings = () => readSettings(server.database);

    server.get("/instagram/account", canRead, async () =>
      readAccountSummary(server.database, await settings()),
    );

    server.put("/instagram/account", canUpdate, async (request) => {
      const { accessToken } = parseRequest(connectRequestSchema, request.body);
      return connectAccount(server.database, client, accessToken, await settings());
    });

    server.delete("/instagram/account", canUpdate, async (_request, reply) => {
      await disconnectAccount(server.database);
      return reply.code(204).send();
    });

    server.post("/instagram/sync", canUpdate, async () =>
      syncPosts(server.database, client, await settings()),
    );

    server.get("/instagram/posts", canRead, async (request) => {
      const pictureAddress = `${apiOrigin(request)}${ADDON_PUBLIC_PREFIX}/instagram/images`;
      const posts: AdminInstagramPost[] = (await listPosts(server.database)).map((post) => ({
        id: post.id,
        image: `${pictureAddress}/${post.id}`,
        caption: post.caption,
        altText: post.altText,
        permalink: post.permalink,
        mediaType: post.mediaType,
        postedAt: post.postedAt.toISOString(),
      }));
      return { posts };
    });

    server.patch("/instagram/posts/:id", canUpdate, async (request, reply) => {
      const { altText } = parseRequest(altTextRequestSchema, request.body);
      await changeAltText(server.database, readPostId(request.params), altText);
      return reply.code(204).send();
    });

    server.get(`${ADDON_PUBLIC_PREFIX}/instagram/posts`, async (request, reply) => {
      const { limit } = parseRequest(publicPostsQuerySchema, request.query);
      const feed = await listPublicPosts(server.database, limit ?? (await settings()).postCount);
      return reply.header("cache-control", "public, max-age=300").send(feed);
    });

    server.get(`${ADDON_PUBLIC_PREFIX}/instagram/images/:id`, async (request, reply) => {
      const picture = await readPicture(server.database, readPostId(request.params));
      // A post's picture never changes; a newer post has a new address.
      return reply
        .type(picture.type)
        .header("cache-control", "public, max-age=31536000, immutable")
        .header("x-content-type-options", "nosniff")
        .send(Buffer.from(picture.bytes));
    });
  };
}

const publicPostsQuerySchema = z.object({
  limit: z.coerce
    .number({ error: "limit should be a number" })
    .int({ error: "limit should be a whole number" })
    .min(1, { error: "limit should be 1 or more" })
    .max(24, { error: "limit should be 24 or less" })
    .optional(),
});

/** An id that isn't even a UUID can't be a post, so it gets the same 404. */
function readPostId(params: unknown): string {
  const parsed = postIdParamsSchema.safeParse(params);
  if (!parsed.success) throw new InstagramPostNotFoundError();
  return parsed.data.id;
}

/** Where the admin reached the API, so its preview loads pictures from the same place. */
function apiOrigin(request: { protocol: string; host: string }): string {
  return `${request.protocol}://${request.host}`;
}
