import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Starts Lintel the way `pnpm dev` does (src/main.ts: the API, the built-in website and the
 * plugins in lintel.config.ts), checks both servers answer, then stops it. Unit tests build servers directly,
 * so only this catches startup mistakes such as adding a hook after the API is listening.
 */

const CORE_FOLDER = fileURLToPath(new URL("..", import.meta.url));
const TSX = join(CORE_FOLDER, "node_modules", ".bin", "tsx");
// Creating a new built-in database and migrating it takes a while on a busy machine.
const STARTUP_TIMEOUT = 120_000;

/** A port nothing is using right now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No port")),
      );
    });
  });
}

function waitForOutput(child: ChildProcess, text: string, output: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (output.join("").includes(text)) resolve();
    };
    child.stdout?.on("data", check);
    child.stderr?.on("data", check);
    child.once("exit", (code) =>
      reject(
        new Error(`Lintel stopped (exit ${code}) before saying "${text}":\n${output.join("")}`),
      ),
    );
  });
}

function waitForExit(child: ChildProcess): Promise<number | null> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) resolve(child.exitCode);
    else child.once("exit", (code) => resolve(code));
  });
}

describe("starting Lintel", () => {
  let child: ChildProcess | undefined;
  let dataFolder: string | undefined;

  afterEach(async () => {
    if (child && child.exitCode === null) {
      child.kill("SIGKILL");
      await waitForExit(child);
    }
    if (dataFolder) await rm(dataFolder, { recursive: true, force: true });
  });

  it(
    "starts the API and the website, answers on both, and stops cleanly",
    async () => {
      dataFolder = await mkdtemp(join(tmpdir(), "lintel-start-"));
      const [apiPort, sitePort] = [await freePort(), await freePort()];
      const output: string[] = [];
      // The same command as `pnpm dev`, without watching for changes.
      child = spawn(
        TSX,
        [
          "--tsconfig",
          "tsconfig.dev.json",
          "--conditions=development",
          "--env-file=development.env",
          "src/main.ts",
        ],
        {
          cwd: CORE_FOLDER,
          env: {
            ...process.env,
            LINTEL_FOLDER: dataFolder,
            API_PORT: String(apiPort),
            SITE_PORT: String(sitePort),
            SITE_ENABLED: "true",
            NODE_ENV: "development",
            DATABASE_URL: "",
          },
        },
      );
      child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
      child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));

      await waitForOutput(child, "Your website is at", output);

      const health = await fetch(`http://127.0.0.1:${apiPort}/health`);
      expect(health.status).toBe(200);
      const website = await fetch(`http://127.0.0.1:${sitePort}/`);
      expect(website.status).toBe(200);
      expect(await website.text()).toContain("<html");

      child.kill("SIGTERM");
      expect(await waitForExit(child)).toBe(0);
      expect(output.join("")).not.toMatch(/FST_ERR|Error:/);
    },
    STARTUP_TIMEOUT,
  );
});
