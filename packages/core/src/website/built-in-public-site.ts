import type { PublicSite } from "../production/public-site.js";
import { addWebsiteRoutes } from "./website-routes.js";

/**
 * The built-in website in production: the same pages `pnpm dev` serves on SITE_PORT, at
 * every address the API (/api) and the admin (ADMIN_PATH) don't use, on the one server
 * `pnpm start` runs (see src/production). It reads through that server's database, media
 * lookup and rendered pages cache, so it always follows what editors publish.
 */
export const builtInPublicSite: PublicSite = async (server, options) => {
  // An address under /api that isn't an API route is the API's 404, not a website page.
  server.addHook("onRequest", async (request, reply) => {
    if (request.url === options.apiPrefix || request.url.startsWith(`${options.apiPrefix}/`)) {
      return reply.callNotFound();
    }
    return undefined;
  });

  addWebsiteRoutes(server, { api: server, ...options });
};
