// `pnpm test:load`: many people viewing pages while editors save them, on Postgres, MySQL and
// MariaDB, each in a throwaway Docker container. A real server (`dist/main.js`, so run
// `pnpm build` first) answers over HTTP, as it would on a site. Run on request only.
//
// Each engine gets a new database with a site of LINTEL_LOAD_PAGES published pages. Then, for
// LINTEL_LOAD_SECONDS, LINTEL_LOAD_VIEWERS people ask for pages one after another with no pause,
// and LINTEL_LOAD_EDITORS people save pages the same way. Every fifth save is a publish, and
// every tenth goes to one page they all share, so saves meet on the same rows.
//
//   LINTEL_LOAD_ENGINES=postgres,mysql,mariadb   which to run
//   LINTEL_LOAD_SECONDS=30  LINTEL_LOAD_VIEWERS=50  LINTEL_LOAD_EDITORS=10  LINTEL_LOAD_PAGES=100
//   LINTEL_LOAD_API_PORT=35501  LINTEL_LOAD_SITE_PORT=35502
//   LINTEL_LOAD_REPORT=report.json   also writes the numbers to this file
//
// See database-containers.mjs for the containers' names, ports and images. The servers keep
// their data in memory and share a machine with the test, so compare the three with each other;
// they aren't what a real host would do.
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { createWriteStream, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "mysql2/promise";
import {
  createDatabase,
  databaseServers,
  removeServer,
  startServer,
  urlOf,
} from "./database-containers.mjs";

const number = (name, fallback) => Number(process.env[name] ?? fallback);
const SECONDS = number("LINTEL_LOAD_SECONDS", 30);
const VIEWERS = number("LINTEL_LOAD_VIEWERS", 50);
const EDITORS = number("LINTEL_LOAD_EDITORS", 10);
const PAGES = number("LINTEL_LOAD_PAGES", 100);
const API_PORT = number("LINTEL_LOAD_API_PORT", 35501);
const SITE_PORT = number("LINTEL_LOAD_SITE_PORT", 35502);
const WARM_UP_SECONDS = 3;
const SHARED_PAGE_EVERY = 10;
const PUBLISH_EVERY = 5;
const engines = (process.env.LINTEL_LOAD_ENGINES ?? "postgres,mysql,mariadb").split(",");
const coreFolder = join(dirname(fileURLToPath(import.meta.url)), "..");
const api = `http://127.0.0.1:${API_PORT}`;
const site = `http://127.0.0.1:${SITE_PORT}`;

async function waitForServer(child) {
  const deadline = Date.now() + 120_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error("The server stopped as it started.");
    try {
      const [answer] = await Promise.all([
        fetch(`${api}/setup/status`),
        fetch(`${site}/`, { redirect: "manual" }),
      ]);
      if (answer.ok) return;
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error("The server didn't start in time.");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function startLintel(databaseUrl, folder) {
  const log = createWriteStream(join(folder, "server.log"));
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: coreFolder,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: databaseUrl,
      LINTEL_FOLDER: folder,
      API_PORT: String(API_PORT),
      SITE_PORT: String(SITE_PORT),
      API_PUBLIC_URL: api,
      SITE_PUBLIC_URL: site,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

async function json(response, what) {
  const text = await response.text();
  if (!response.ok) throw new Error(`${what} answered ${response.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

/** Finishes setup, and gives back the owner's session cookie. */
async function setUpSite() {
  const response = await fetch(`${api}/setup/finish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      account: { email: "load@example.com", name: "Load", password: "correct horse battery" },
      site: { siteName: "Load test", siteType: "blog" },
    }),
  });
  await json(response, "Setup");
  const cookie = response.headers.getSetCookie().map((line) => line.split(";")[0]);
  return cookie.join("; ");
}

function paragraph(number) {
  return `Paragraph ${number} of a page, long enough to stand for real writing. `.repeat(8);
}

async function addPages(cookie) {
  const send = (method, path, body) =>
    fetch(`${api}${path}`, {
      method,
      headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const pages = [];
  for (let number = 1; number <= PAGES; number += 1) {
    const created = await json(
      await send("POST", "/collections/pages/entries", {
        slug: `page-${number}`,
        data: { title: `Page ${number}`, summary: paragraph(number) },
      }),
      "Adding a page",
    );
    await json(await send("POST", `/entries/${created.id}/publish`), "Publishing a page");
    pages.push({ id: created.id, slug: created.slug });
  }
  return { pages, send };
}

function emptyTally() {
  return { times: [], statuses: {}, failures: 0 };
}

async function timed(tally, request) {
  const started = performance.now();
  try {
    const response = await request();
    await response.arrayBuffer();
    tally.times.push(performance.now() - started);
    tally.statuses[response.status] = (tally.statuses[response.status] ?? 0) + 1;
  } catch {
    tally.failures += 1;
  }
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function viewer(pages, shouldStop, tally) {
  while (!shouldStop()) {
    const page = pick(pages);
    await timed(tally, () => fetch(`${site}/${page.slug}`));
  }
}

async function editor(pages, send, shouldStop, tally, publishTally) {
  for (let turn = 1; !shouldStop(); turn += 1) {
    const page = turn % SHARED_PAGE_EVERY === 0 ? pages[0] : pick(pages);
    await timed(tally, () =>
      send("PATCH", `/entries/${page.id}`, {
        data: { title: `${page.slug} edited ${turn}`, summary: paragraph(turn) },
      }),
    );
    if (turn % PUBLISH_EVERY === 0) {
      await timed(publishTally, () => send("POST", `/entries/${page.id}/publish`));
    }
  }
}

async function runLoad(pages, send, seconds) {
  const tallies = { views: emptyTally(), saves: emptyTally(), publishes: emptyTally() };
  const stopAt = Date.now() + seconds * 1000;
  const shouldStop = () => Date.now() >= stopAt;
  await Promise.all([
    ...Array.from({ length: VIEWERS }, () => viewer(pages, shouldStop, tallies.views)),
    ...Array.from({ length: EDITORS }, () =>
      editor(pages, send, shouldStop, tallies.saves, tallies.publishes),
    ),
  ]);
  return tallies;
}

function percentile(sorted, share) {
  return sorted.length === 0 ? 0 : sorted[Math.floor((sorted.length - 1) * share)];
}

function summarise(tally, seconds) {
  const sorted = [...tally.times].sort((first, second) => first - second);
  const total = tally.failures + sorted.length;
  const serverErrors = Object.entries(tally.statuses)
    .filter(([status]) => Number(status) >= 500)
    .reduce((sum, [, count]) => sum + count, 0);
  return {
    requests: total,
    perSecond: Math.round(total / seconds),
    p50: Math.round(percentile(sorted, 0.5)),
    p95: Math.round(percentile(sorted, 0.95)),
    p99: Math.round(percentile(sorted, 0.99)),
    slowest: Math.round(sorted.at(-1) ?? 0),
    statuses: tally.statuses,
    serverErrors,
    connectionFailures: tally.failures,
  };
}

/** How many deadlocks the database broke, since it started. */
async function countDeadlocks(server, database) {
  if (server.name === "postgres") {
    const output = execFileSync(
      "docker",
      [
        "exec",
        server.container,
        "psql",
        "--username=lintel",
        "--tuples-only",
        "--no-align",
        `--dbname=${database}`,
        "--command=select deadlocks from pg_stat_database where datname = current_database()",
      ],
      { encoding: "utf8" },
    );
    return Number(output.trim());
  }
  const connection = await createConnection({ uri: urlOf(server) });
  try {
    const [rows] = await connection.query(
      server.name === "mysql"
        ? "select count as total from information_schema.innodb_metrics where name = 'lock_deadlocks'"
        : "select variable_value as total from information_schema.global_status where variable_name = 'innodb_deadlocks'",
    );
    return Number(rows[0]?.total ?? 0);
  } finally {
    await connection.end();
  }
}

async function runOn(server) {
  const database = "lintel_load";
  const folder = mkdtempSync(join(tmpdir(), "lintel-load-"));
  await startServer(server);
  await createDatabase(server, database);
  const child = startLintel(urlOf(server, database), folder);
  try {
    await waitForServer(child);
    const cookie = await setUpSite();
    const { pages, send } = await addPages(cookie);
    await runLoad(pages, send, WARM_UP_SECONDS);
    const tallies = await runLoad(pages, send, SECONDS);
    return {
      engine: server.image,
      views: summarise(tallies.views, SECONDS),
      saves: summarise(tallies.saves, SECONDS),
      publishes: summarise(tallies.publishes, SECONDS),
      deadlocks: await countDeadlocks(server, database),
    };
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("close", resolve));
    removeServer(server);
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  }
}

const results = [];
for (const engine of engines) {
  const server = databaseServers[engine];
  console.warn(`${server.image}: ${VIEWERS} viewers and ${EDITORS} editors for ${SECONDS}s`);
  results.push(await runOn(server));
}
const rows = results.flatMap(({ engine, views, saves, publishes, deadlocks }) =>
  Object.entries({ views, saves, publishes }).map(([kind, numbers]) => ({
    engine,
    kind,
    ...numbers,
    statuses: JSON.stringify(numbers.statuses),
    deadlocks,
  })),
);
console.table(rows);
if (process.env.LINTEL_LOAD_REPORT) {
  writeFileSync(process.env.LINTEL_LOAD_REPORT, `${JSON.stringify(results, null, 2)}\n`);
}
const failed = results.some((result) =>
  [result.views, result.saves, result.publishes].some(
    (numbers) => numbers.serverErrors > 0 || numbers.connectionFailures > 0,
  ),
);
process.exit(failed ? 1 : 0);
