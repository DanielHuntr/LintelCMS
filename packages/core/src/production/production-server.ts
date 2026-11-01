import { buildServer, type ServerOptions } from "../server.js";
import { adminApp } from "./admin-app.js";
import { API_PREFIX } from "./production.config.js";
import { placeholderPublicSite, type PublicSite } from "./public-site.js";

export interface ProductionServerOptions extends Omit<ServerOptions, "apiPrefix" | "compression"> {
  adminPath: string;
  adminBuildFolder: string;
  /** Where the admin's requests go. "/api" unless API_PUBLIC_URL points somewhere else. */
  adminApiUrl: string;
  /** The website at every other address. Defaults to a "coming soon" page. */
  publicSite?: PublicSite;
}

/**
 * Everything in one server, as `pnpm start` and the Docker image run it:
 *
 *   /health, /ready   for the hosting platform
 *   /api/...          the API (the same routes `pnpm dev` serves at the root)
 *   /admin/...        the built admin (ADMIN_PATH)
 *   everything else   the public website (see public-site.ts)
 *
 * Responses are compressed. Tests call this and use `server.inject`, like buildServer.
 */
export function buildProductionServer(options: ProductionServerOptions) {
  const { adminPath, adminBuildFolder, adminApiUrl, publicSite, ...serverOptions } = options;
  const server = buildServer({ ...serverOptions, apiPrefix: API_PREFIX, compression: true });

  server.register(adminApp, { adminPath, buildFolder: adminBuildFolder, apiUrl: adminApiUrl });
  server.register(publicSite ?? placeholderPublicSite, { apiPrefix: API_PREFIX, adminPath });

  return server;
}
