// `pnpm test:postgres`: runs the whole core test suite on a real Postgres 17 server, the
// database the production checklist recommends, and checks migrations on a fresh database
// and on one stopped at an older migration with rows in it. Run on request only: ordinary
// `pnpm test` uses the built-in database and needs no Docker.
//
// The server lives in a throwaway container with its data in memory, so there are no volumes
// to clean up, and the container is removed at the end, pass or fail.
// LINTEL_TEST_POSTGRES_PORT changes the port.
// Arguments go to vitest: `pnpm test:postgres src/settings`.
import { execFileSync, spawnSync } from "node:child_process";

const CONTAINER = "lintel-test-postgres";
const IMAGE = "postgres:17";
const USER = "lintel";
const PASSWORD = "lintel-test";
const PORT = process.env.LINTEL_TEST_POSTGRES_PORT ?? "34170";
const WAIT_FOR_START_SECONDS = 60;

function docker(...args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function removeContainer() {
  try {
    docker("rm", "--force", "--volumes", CONTAINER);
  } catch {
    // Already gone.
  }
}

function urlOf(database) {
  return `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${database}`;
}

async function waitUntilReady() {
  const deadline = Date.now() + WAIT_FOR_START_SECONDS * 1000;
  for (;;) {
    try {
      // Over TCP, because the image's first start listens only on a local socket.
      docker("exec", CONTAINER, "pg_isready", "--host=127.0.0.1", `--username=${USER}`);
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw new Error(`${IMAGE} didn't start in time.`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

function createDatabase(name) {
  docker("exec", CONTAINER, "createdb", `--username=${USER}`, name);
}

let exitCode;
try {
  removeContainer();
  docker(
    "run",
    "--detach",
    "--name",
    CONTAINER,
    "--publish",
    `127.0.0.1:${PORT}:5432`,
    "--tmpfs",
    "/var/lib/postgresql/data",
    "--env",
    `POSTGRES_USER=${USER}`,
    "--env",
    `POSTGRES_PASSWORD=${PASSWORD}`,
    "--env",
    "POSTGRES_DB=lintel_test",
    IMAGE,
  );
  await waitUntilReady();
  createDatabase("lintel_fresh");
  createDatabase("lintel_upgraded");

  const run = spawnSync("pnpm", ["exec", "vitest", "run", ...process.argv.slice(2)], {
    env: {
      ...process.env,
      TEST_DATABASE_URL: urlOf("lintel_test"),
      TEST_FRESH_POSTGRES_URL: urlOf("lintel_fresh"),
      TEST_UPGRADED_POSTGRES_URL: urlOf("lintel_upgraded"),
    },
    stdio: "inherit",
    shell: true,
  });
  exitCode = run.status ?? 1;
} finally {
  removeContainer();
}
process.exit(exitCode ?? 1);
