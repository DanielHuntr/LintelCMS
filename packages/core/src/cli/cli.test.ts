import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lintelFolderAt } from "../database/database-choice.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { runCronCommand } from "./cron-command.js";
import { runDoctorCommand } from "./doctor-command.js";
import { runCommandLine } from "./lintel.js";

const SECRET = "a-long-cron-secret-for-the-command-line-tests";

function captureOutput() {
  let text = "";
  const write = (chunk: string | Uint8Array) => {
    text += String(chunk);
    return true;
  };
  vi.spyOn(process.stdout, "write").mockImplementation(write);
  vi.spyOn(process.stderr, "write").mockImplementation(write);
  return () => text;
}

describe("the lintel command", () => {
  const testDatabase = useTestDatabase();
  let folder: string;
  let server: FastifyInstance | undefined;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-cli-"));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
  });

  it("runs the scheduled jobs through the running Lintel", async () => {
    server = await startTestServer(testDatabase.activeDatabase, {
      apiPrefix: "/api",
      runScheduledJobs: true,
      cronSecret: SECRET,
      lintelFolder: lintelFolderAt(folder),
    });
    await server.listen({ port: 0, host: "127.0.0.1" });
    const environment = {
      PUBLIC_URL: `http://127.0.0.1:${server.addresses()[0]?.port}`,
      CRON_SECRET: SECRET,
      LINTEL_FOLDER: folder,
    };
    const output = captureOutput();

    expect(await runCronCommand([], environment)).toBe(0);
    expect(output()).toMatch(/Ran the scheduled jobs: .*scheduled-publishing/);

    expect(await runCronCommand([], { ...environment, CRON_SECRET: `${SECRET}-wrong` })).toBe(1);
    expect(output()).toContain("That cron secret isn't right");
  });

  it("prints the cron line with the secret Lintel made", async () => {
    const output = captureOutput();

    const code = await runCronCommand(["--print-line"], {
      PUBLIC_URL: "https://example.com",
      LINTEL_FOLDER: folder,
    });

    expect(code).toBe(0);
    expect(output()).toMatch(
      /\*\/5 \* \* \* \* curl -fsS -X POST -H "X-Lintel-Cron-Secret: [\w-]{40,}" https:\/\/example\.com\/api\/system\/run-scheduled-jobs/,
    );
  });

  it("says plainly when Lintel can't be reached", async () => {
    const output = captureOutput();

    const code = await runCronCommand([], {
      PUBLIC_URL: "http://127.0.0.1:1",
      CRON_SECRET: SECRET,
      LINTEL_FOLDER: folder,
    });

    expect(code).toBe(1);
    expect(output()).toContain("Couldn't reach Lintel at http://127.0.0.1:1/api");
  });

  it("checks the settings and the data folder with doctor", async () => {
    const output = captureOutput();

    expect(await runDoctorCommand([], { LINTEL_FOLDER: folder, ADMIN_BUILD_FOLDER: folder })).toBe(
      1,
    );
    expect(output()).toContain("[OK] Data folder");
    expect(output()).toContain("The admin isn't built");

    expect(await runDoctorCommand([], { LINTEL_FOLDER: folder, PORT: "not a port" })).toBe(1);
    expect(output()).toContain("PORT: Should be a port number");
  });

  it("explains unknown commands", async () => {
    const output = captureOutput();
    expect(await runCommandLine(["publish-everything"])).toBe(1);
    expect(output()).toContain('There is no "publish-everything" command');
  });
});
