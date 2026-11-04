import { join } from "node:path";
import { definePlugin, packageFolder } from "@lintel/core/plugin";
import { createInstagramClient, type FetchFunction } from "./instagram-api.js";
import { instagramFeedBlock, readWholeNumber, renderFeedHtml } from "./instagram-feed.js";
import { instagramRoutes } from "./instagram.routes.js";
import { defaultInstagramSettings, instagramSettingsSchema } from "./instagram.schema.js";
import {
  hasConnectedAccount,
  listPublicPosts,
  refreshTokenIfDue,
  syncPosts,
} from "./instagram.service.js";
import { instagramAccountTable, instagramPostsTable } from "./instagram.table.js";

/**
 * The server half of the Instagram feed add-on. The site owner pastes a long-lived access
 * token; the server copies the newest posts and their pictures into its own tables every
 * hour, and the website shows them from there, so visitors never load anything from
 * Instagram. The admin half is in src/admin.
 *
 * `createInstagramAddon` takes the `fetch` to reach Instagram with, so tests can answer for it.
 */
export function createInstagramAddon(options: { fetch: FetchFunction }) {
  const client = createInstagramClient(options.fetch);

  return definePlugin({
    id: "instagram",
    name: "Instagram feed",
    description: "Your latest Instagram posts on your website, kept on your own server.",
    version: "0.1.0",
    settings: { schema: instagramSettingsSchema, defaults: defaultInstagramSettings },
    database: {
      tables: [instagramAccountTable, instagramPostsTable],
      migrationsFolder: join(packageFolder(import.meta.url), "migrations"),
      mysqlMigrationsFolder: join(packageFolder(import.meta.url), "migrations-mysql"),
    },
    routes: instagramRoutes(client),

    // An element for the builder's Insert menu.
    blocks: [instagramFeedBlock],

    // For Liquid templates:
    //   {% instagram_feed %}                          the newest posts in a grid of 3
    //   {% instagram_feed limit: 6, columns: 2 %}     fewer posts, wider pictures
    //   {% instagram_feed profile_link: false %}      without the link to the profile
    liquid: {
      tags: [
        {
          name: "instagram_feed",
          render: async ({ options: tagOptions }, { database, readSettings }) => {
            const { postCount } = await readSettings();
            const limit = readWholeNumber(tagOptions.limit, postCount, 1, 24);
            const feed = await listPublicPosts(database, limit);
            return renderFeedHtml(feed, {
              columns: readWholeNumber(tagOptions.columns, 3, 1, 6),
              showProfileLink: tagOptions.profile_link !== false,
            });
          },
        },
      ],
    },

    jobs: [
      {
        id: "sync",
        name: "Copying the newest Instagram posts",
        everyMinutes: 60,
        run: async ({ database, readSettings, log }) => {
          if (!(await hasConnectedAccount(database))) return;
          const summary = await syncPosts(database, client, await readSettings());
          if (summary.lastError) log.info(`Instagram: ${summary.lastError}`);
        },
      },
      {
        id: "refresh-token",
        name: "Keeping the Instagram access token fresh",
        everyMinutes: 60 * 24,
        run: async ({ database, log }) => {
          if (await refreshTokenIfDue(database, client)) {
            log.info("The Instagram access token was renewed for another 60 days.");
          }
        },
      },
    ],
  });
}

export default createInstagramAddon({ fetch: (url, init) => fetch(url, init) });
