import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { SeededContent } from "./seed-site.js";

/**
 * One running copy of Lintel for tests: the API on the built-in database and the built
 * admin in front of it, in a process of its own (see site-process.ts). Everything it writes
 * (database, uploads, resized images) goes to its own temporary folder, so sites never see
 * each other and tests can run in parallel.
 *
 * A site starts either empty (the setup wizard shows) or from a copy of a template made
 * once by global-setup.ts, which is much faster than migrating and seeding every time.
 */

export interface TestSite {
  /** The admin's address, such as http://localhost:51234. */
  url: string;
  /** The API's address through the admin's proxy: `${url}/api`. Same origin as the admin. */
  apiUrl: string;
  /** The temporary folder holding the site's database and files. */
  folder: string;
  /** Stops the site's process and deletes its folder. */
  stop: () => Promise<void>;
}

export interface StartSiteOptions {
  /** A template folder to start from. Leave out for a brand new database. */
  template?: string;
}

export async function startSite(options: StartSiteOptions = {}): Promise<TestSite> {
  const folder = await mkdtemp(join(tmpdir(), "lintel-e2e-site-"));
  if (options.template) {
    await cp(options.template, folder, { recursive: true });
  }
  const running = await startSiteProcess(folder);
  return {
    url: running.url,
    apiUrl: running.apiUrl,
    folder,
    stop: async () => {
      await running.stop();
      await rm(folder, { recursive: true, force: true });
    },
  };
}

interface RunningSite {
  url: string;
  apiUrl: string;
  /** Only when started with `seed: true`. */
  seededContent?: SeededContent;
  stop: () => Promise<void>;
}

const siteProcessScript = fileURLToPath(new URL("./site-process.ts", import.meta.url));
const typescriptLoader = import.meta.resolve("tsx/esm");

/** Starts a site's process on `folder`, which is kept when it stops. */
export async function startSiteProcess(
  folder: string,
  options: { seed?: boolean } = {},
): Promise<RunningSite> {
  const child = spawn(
    process.execPath,
    ["--import", typescriptLoader, siteProcessScript, folder, ...(options.seed ? ["--seed"] : [])],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const started = await readStartLine(child);
  return { ...started, stop: () => stopProcess(child) };
}

function readStartLine(child: ChildProcess): Promise<Omit<RunningSite, "stop">> {
  return new Promise((resolve, reject) => {
    const lines = createInterface({ input: child.stdout! });
    lines.once("line", (line) => resolve(JSON.parse(line) as Omit<RunningSite, "stop">));
    child.once("exit", (code, signal) =>
      reject(new Error(`The test site stopped while starting (exit ${code ?? signal}).`)),
    );
  });
}

function stopProcess(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}
