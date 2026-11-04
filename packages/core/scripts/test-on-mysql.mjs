// `pnpm test:dialects`: runs the *.dialects.test.ts files on MySQL 8.4 and MariaDB 11.4 as
// well as the built-in database. Run on request only: ordinary `pnpm test` needs no Docker.
//
// The databases live in throwaway containers holding their data in memory, so there are no
// volumes to clean up, and the containers are removed at the end, pass or fail.
// LINTEL_TEST_MYSQL_PORT and LINTEL_TEST_MARIADB_PORT change the ports.
// Arguments go to vitest: `pnpm test:dialects src/settings`.
import { execFileSync, spawnSync } from "node:child_process";
import { createConnection } from "mysql2/promise";

const PASSWORD = "lintel-test";
const DATABASE = "lintel_test";
const WAIT_FOR_START_SECONDS = 120;

const servers = [
  {
    urlVariable: "TEST_MYSQL_URL",
    container: "lintel-dialect-test-mysql",
    image: "mysql:8.4",
    port: process.env.LINTEL_TEST_MYSQL_PORT ?? "34084",
    environmentPrefix: "MYSQL",
    collation: "utf8mb4_0900_bin",
  },
  {
    urlVariable: "TEST_MARIADB_URL",
    container: "lintel-dialect-test-mariadb",
    image: "mariadb:11.4",
    port: process.env.LINTEL_TEST_MARIADB_PORT ?? "34114",
    environmentPrefix: "MARIADB",
    collation: "utf8mb4_nopad_bin",
  },
];

function docker(...args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function removeContainer(server) {
  try {
    docker("rm", "--force", "--volumes", server.container);
  } catch {
    // Already gone.
  }
}

function startContainer(server) {
  docker(
    "run",
    "--detach",
    "--name",
    server.container,
    "--publish",
    `127.0.0.1:${server.port}:3306`,
    "--tmpfs",
    "/var/lib/mysql",
    "--env",
    `${server.environmentPrefix}_ROOT_PASSWORD=${PASSWORD}`,
    "--env",
    `${server.environmentPrefix}_DATABASE=${DATABASE}`,
    server.image,
    "--character-set-server=utf8mb4",
    `--collation-server=${server.collation}`,
  );
}

function urlOf(server) {
  return `mysql://root:${PASSWORD}@127.0.0.1:${server.port}/${DATABASE}`;
}

async function waitUntilReady(server) {
  const deadline = Date.now() + WAIT_FOR_START_SECONDS * 1000;
  for (;;) {
    try {
      const connection = await createConnection({ uri: urlOf(server) });
      await connection.end();
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`${server.image} didn't start in time.`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

let exitCode;
try {
  for (const server of servers) {
    removeContainer(server);
    startContainer(server);
  }
  await Promise.all(servers.map(waitUntilReady));

  const urls = Object.fromEntries(servers.map((server) => [server.urlVariable, urlOf(server)]));
  const filters = process.argv.slice(2);
  const run = spawnSync("pnpm", ["exec", "vitest", "run", ...filters, "dialects"], {
    env: { ...process.env, ...urls },
    stdio: "inherit",
    shell: true,
  });
  exitCode = run.status ?? 1;
} finally {
  servers.forEach(removeContainer);
}
process.exit(exitCode ?? 1);
