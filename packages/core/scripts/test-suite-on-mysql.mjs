// `pnpm test:mysql`: runs the whole core test suite on MySQL 8.4 and MariaDB 11.4, in
// throwaway Docker containers holding their data in memory. They are removed at the end,
// pass or fail. Run on request only: ordinary `pnpm test` needs no Docker.
//
// Each engine's suite is split across a few databases that run side by side, since test
// files share a database and can't run together on one.
//
//   LINTEL_TEST_ENGINES=mysql,mariadb   which to run
//   LINTEL_TEST_SHARDS=4                how many databases per engine
//   LINTEL_TEST_MYSQL_PORT, LINTEL_TEST_MARIADB_PORT   the ports
//   LINTEL_TEST_MYSQL_IMAGE, LINTEL_TEST_MARIADB_IMAGE   the versions
//   LINTEL_TEST_CONTAINER_PREFIX                        the start of the containers' names
//
// Arguments go to vitest: `pnpm test:mysql src/settings`. A summary of each run is written
// to LINTEL_TEST_REPORT_FOLDER when it's set.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "mysql2/promise";

const PASSWORD = "lintel-test";
const WAIT_FOR_START_SECONDS = 180;
const shards = Number(process.env.LINTEL_TEST_SHARDS ?? "4");
const engines = (process.env.LINTEL_TEST_ENGINES ?? "mysql,mariadb").split(",");
const reportFolder = process.env.LINTEL_TEST_REPORT_FOLDER;
const prefix = process.env.LINTEL_TEST_CONTAINER_PREFIX ?? "lintel-suite";

const servers = {
  mysql: {
    name: "mysql",
    container: `${prefix}-mysql`,
    image: process.env.LINTEL_TEST_MYSQL_IMAGE ?? "mysql:8.4",
    port: process.env.LINTEL_TEST_MYSQL_PORT ?? "34184",
    environmentPrefix: "MYSQL",
    collation: "utf8mb4_0900_bin",
    flags: ["--skip-log-bin"],
  },
  mariadb: {
    name: "mariadb",
    container: `${prefix}-mariadb`,
    image: process.env.LINTEL_TEST_MARIADB_IMAGE ?? "mariadb:11.4",
    port: process.env.LINTEL_TEST_MARIADB_PORT ?? "34214",
    environmentPrefix: "MARIADB",
    collation: "utf8mb4_nopad_bin",
    flags: [],
  },
};

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
    server.image,
    "--character-set-server=utf8mb4",
    `--collation-server=${server.collation}`,
    "--max-connections=1000",
    "--innodb-flush-log-at-trx-commit=0",
    ...server.flags,
  );
}

function urlOf(server, database = "") {
  return `mysql://root:${PASSWORD}@127.0.0.1:${server.port}/${database}`;
}

async function prepareDatabases(server) {
  const deadline = Date.now() + WAIT_FOR_START_SECONDS * 1000;
  for (;;) {
    try {
      const connection = await createConnection({ uri: urlOf(server) });
      for (let shard = 1; shard <= shards; shard += 1) {
        await connection.query(`create database if not exists lintel_test_${shard}`);
      }
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

function runShard(server, shard) {
  const filters = process.argv.slice(2);
  const reporterArguments = reportFolder
    ? [
        "--reporter=default",
        "--reporter=json",
        `--outputFile.json=${join(reportFolder, `${server.name}-${shard}.json`)}`,
      ]
    : [];
  const ownTemporaryFolder = join(tmpdir(), `lintel-suite-${server.name}-${shard}`);
  mkdirSync(ownTemporaryFolder, { recursive: true });
  return new Promise((resolve) => {
    const run = spawn(
      "pnpm",
      ["exec", "vitest", "run", `--shard=${shard}/${shards}`, ...reporterArguments, ...filters],
      {
        env: {
          ...process.env,
          TEST_DATABASE_URL: urlOf(server, `lintel_test_${shard}`),
          LINTEL_TEST_ENGINE: server.name,
          LINTEL_TEST_CACHE_FOLDER: join(ownTemporaryFolder, "cache"),
          // Some tests write beside their temporary folder, so runs side by side need their own.
          TMP: ownTemporaryFolder,
          TEMP: ownTemporaryFolder,
          TMPDIR: ownTemporaryFolder,
        },
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      },
    );
    const output = [];
    const keep = (chunk) => output.push(chunk);
    run.stdout.on("data", keep);
    run.stderr.on("data", keep);
    run.on("close", (code) => {
      const text = Buffer.concat(output).toString("utf8");
      if (reportFolder) writeFileSync(join(reportFolder, `${server.name}-${shard}.log`), text);
      else process.stdout.write(text);
      resolve(code ?? 1);
    });
  });
}

let exitCode;
const chosen = engines.map((engine) => servers[engine]);
try {
  if (reportFolder) mkdirSync(reportFolder, { recursive: true });
  for (const server of chosen) {
    removeContainer(server);
    startContainer(server);
  }
  await Promise.all(chosen.map(prepareDatabases));
  const runs = chosen.flatMap((server) =>
    Array.from({ length: shards }, (_, place) => runShard(server, place + 1)),
  );
  const codes = await Promise.all(runs);
  exitCode = codes.every((code) => code === 0) ? 0 : 1;
} finally {
  chosen.forEach(removeContainer);
}
process.exit(exitCode ?? 1);
