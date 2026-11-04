// Throwaway database servers in Docker, for the scripts here that run on request: their data is
// in memory, so there are no volumes to clean up. Remove them with `removeServer`, pass or fail.
//
//   LINTEL_TEST_CONTAINER_PREFIX              the start of each container's name
//   LINTEL_TEST_POSTGRES_CONTAINER            one name for the Postgres container
//   LINTEL_TEST_POSTGRES_PORT, LINTEL_TEST_MYSQL_PORT, LINTEL_TEST_MARIADB_PORT
//   LINTEL_TEST_POSTGRES_IMAGE, LINTEL_TEST_MYSQL_IMAGE, LINTEL_TEST_MARIADB_IMAGE
import { execFileSync } from "node:child_process";
import { createConnection } from "mysql2/promise";

const PASSWORD = "lintel-test";
const USER = "lintel";
const WAIT_FOR_START_SECONDS = 180;
const prefix = process.env.LINTEL_TEST_CONTAINER_PREFIX ?? "lintel-on-request";

function docker(...args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export const databaseServers = {
  postgres: {
    name: "postgres",
    container: process.env.LINTEL_TEST_POSTGRES_CONTAINER ?? `${prefix}-postgres`,
    image: process.env.LINTEL_TEST_POSTGRES_IMAGE ?? "postgres:17",
    port: process.env.LINTEL_TEST_POSTGRES_PORT ?? "34370",
    innerPort: 5432,
    dataFolder: "/var/lib/postgresql/data",
    environment: [
      `POSTGRES_USER=${USER}`,
      `POSTGRES_PASSWORD=${PASSWORD}`,
      "POSTGRES_DB=lintel_test",
    ],
    flags: ["-c", "max_connections=500"],
  },
  mysql: {
    name: "mysql",
    container: `${prefix}-mysql`,
    image: process.env.LINTEL_TEST_MYSQL_IMAGE ?? "mysql:8.4",
    port: process.env.LINTEL_TEST_MYSQL_PORT ?? "34384",
    innerPort: 3306,
    dataFolder: "/var/lib/mysql",
    environment: [`MYSQL_ROOT_PASSWORD=${PASSWORD}`],
    flags: [
      "--character-set-server=utf8mb4",
      "--collation-server=utf8mb4_0900_bin",
      "--max-connections=1000",
      "--skip-log-bin",
    ],
  },
  mariadb: {
    name: "mariadb",
    container: `${prefix}-mariadb`,
    image: process.env.LINTEL_TEST_MARIADB_IMAGE ?? "mariadb:11.4",
    port: process.env.LINTEL_TEST_MARIADB_PORT ?? "34414",
    innerPort: 3306,
    dataFolder: "/var/lib/mysql",
    environment: [`MARIADB_ROOT_PASSWORD=${PASSWORD}`],
    flags: [
      "--character-set-server=utf8mb4",
      "--collation-server=utf8mb4_nopad_bin",
      "--max-connections=1000",
    ],
  },
};

export function removeServer(server) {
  try {
    docker("rm", "--force", "--volumes", server.container);
  } catch {
    // Already gone.
  }
}

export function urlOf(server, database = "") {
  return server.name === "postgres"
    ? `postgres://${USER}:${PASSWORD}@127.0.0.1:${server.port}/${database}`
    : `mysql://root:${PASSWORD}@127.0.0.1:${server.port}/${database}`;
}

function waitForPostgres(server, deadline) {
  for (;;) {
    try {
      // Over TCP, because the image's first start listens only on a local socket.
      docker("exec", server.container, "pg_isready", "--host=127.0.0.1", `--username=${USER}`);
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`${server.image} didn't start in time.`, { cause: error });
      }
    }
  }
}

async function waitForMysql(server, deadline) {
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

/** Starts one server, with its data in memory, and waits until it takes connections. */
export async function startServer(server) {
  removeServer(server);
  docker(
    "run",
    "--detach",
    "--name",
    server.container,
    "--publish",
    `127.0.0.1:${server.port}:${server.innerPort}`,
    "--tmpfs",
    server.dataFolder,
    ...server.environment.flatMap((setting) => ["--env", setting]),
    server.image,
    ...server.flags,
  );
  const deadline = Date.now() + WAIT_FOR_START_SECONDS * 1000;
  if (server.name === "postgres") waitForPostgres(server, deadline);
  else await waitForMysql(server, deadline);
}

/** A new, empty database on a server, ready for `urlOf(server, name)`. */
export async function createDatabase(server, name) {
  if (server.name === "postgres") {
    docker("exec", server.container, "createdb", `--username=${USER}`, name);
    return;
  }
  const connection = await createConnection({ uri: urlOf(server) });
  await connection.query(`create database \`${name}\``);
  await connection.end();
}
