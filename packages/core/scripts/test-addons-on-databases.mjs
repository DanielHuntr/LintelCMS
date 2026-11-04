// `pnpm test:addons`: runs the tests of Lintel's add-ons with tables on Postgres, MySQL and
// MariaDB, then installs each from a packed .tgz with `lintel addons add` and runs it there.
// Run on request only: ordinary `pnpm test` needs no Docker. Build first (`pnpm build`), as
// the add-ons' tests use the built core.
//
//   LINTEL_TEST_ENGINES=postgres,mysql,mariadb   which to run
//
// See database-containers.mjs for the containers' names, ports and images.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDatabase,
  databaseServers,
  removeServer,
  startServer,
  urlOf,
} from "./database-containers.mjs";

const PACKAGES = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ADDONS = ["addon-newsletter", "addon-instagram", "plugin-example-bookings"];
const engines = (process.env.LINTEL_TEST_ENGINES ?? "postgres,mysql,mariadb").split(",");

function runTests(folder, environment, ...filters) {
  const run = spawnSync("pnpm", ["exec", "vitest", "run", ...filters], {
    cwd: join(PACKAGES, folder),
    env: { ...process.env, ...environment },
    stdio: "inherit",
    shell: true,
  });
  return run.status ?? 1;
}

const chosen = engines.map((engine) => databaseServers[engine]);
const failures = [];
try {
  await Promise.all(chosen.map(startServer));
  for (const server of chosen) {
    for (const addon of ADDONS) {
      const name = `lintel_${addon.replaceAll("-", "_")}`;
      await createDatabase(server, name);
      const code = runTests(addon, { TEST_DATABASE_URL: urlOf(server, name) });
      if (code !== 0) failures.push(`${addon} on ${server.image}`);
    }
    await createDatabase(server, "lintel_packed");
    const code = runTests(
      "cli",
      { LINTEL_PACKED_ADDONS_URL: urlOf(server, "lintel_packed") },
      "src/addons/addons-packed.test.ts",
    );
    if (code !== 0) failures.push(`packed add-ons on ${server.image}`);
  }
} finally {
  chosen.forEach(removeServer);
}
if (failures.length > 0) console.error(`Failed: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
