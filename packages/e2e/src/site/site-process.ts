import { seedSite } from "./seed-site.js";
import { startServers } from "./site-servers.js";

/**
 * The entry point of one site's own process (started by test-site.ts):
 *
 *   node --import tsx/esm site-process.ts <folder> [--seed]
 *
 * It starts the API and the admin on the site in <folder>, seeds it first when asked, and
 * prints one line of JSON saying where they are. It stops cleanly on SIGTERM.
 *
 * Each site gets a process because the built-in database holds on to several hundred MB
 * until its process ends; a test worker opening sites one after another would run out.
 */

const [folder, ...flags] = process.argv.slice(2);
if (!folder) {
  throw new Error("Pass the site's folder: site-process.ts <folder> [--seed]");
}

const servers = await startServers(folder);
const seededContent = flags.includes("--seed")
  ? await seedSite(servers.apiUrl, servers.database)
  : undefined;

process.stdout.write(
  `${JSON.stringify({ url: servers.url, apiUrl: servers.apiUrl, seededContent })}\n`,
);

process.once("SIGTERM", () => {
  void servers.stopServers().then(() => process.exit(0));
});
