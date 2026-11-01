import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { buildServer, LocalDiskStorage, openStartupDatabase } from "@lintel/core";
import { adminBuildFolder } from "./admin-build.js";
import { API_PREFIX, startAdminServer } from "./admin-server.js";

/**
 * The servers of one test site: the API on the built-in database, and the built admin in
 * front of it through admin-server.ts. Runs inside a site's own process (site-process.ts).
 */

/** Where a site keeps things inside its folder. The same names in templates. */
export function siteFolderLayout(folder: string) {
  return {
    lintelFolder: { dataFolder: join(folder, "data"), configFile: join(folder, "config.json") },
    uploadsFolder: join(folder, "uploads"),
    cacheFolder: join(folder, "cache"),
  };
}

/** Starts the API and the admin on the site in `folder`, in this process. */
export async function startServers(folder: string) {
  const layout = siteFolderLayout(folder);
  const database = await openStartupDatabase({
    databaseUrl: undefined,
    lintelFolder: layout.lintelFolder,
  });

  let apiPort = 0;
  const admin = await startAdminServer(adminBuildFolder, () => apiPort);

  const api = buildServer({
    adminOrigin: admin.url,
    database,
    lintelFolder: layout.lintelFolder,
    secureCookies: false,
    logger: false,
    // Uploaded files get absolute URLs, which should point back through the proxy.
    publicApiUrl: `${admin.url}${API_PREFIX}`,
    // Webhook tests send to a receiver on this computer.
    webhooks: { allowPrivateAddresses: true },
    media: {
      storage: new LocalDiskStorage(layout.uploadsFolder),
      transformCacheFolder: layout.cacheFolder,
    },
  });
  api.addHook("onClose", () => database.close());
  await api.listen({ port: 0, host: "127.0.0.1" });
  apiPort = (api.server.address() as AddressInfo).port;

  return {
    url: admin.url,
    apiUrl: `${admin.url}${API_PREFIX}`,
    folder,
    database,
    stopServers: async () => {
      await admin.close();
      await api.close();
    },
  };
}
